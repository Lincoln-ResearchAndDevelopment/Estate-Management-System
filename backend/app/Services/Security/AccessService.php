<?php

namespace App\Services\Security;

use App\Exceptions\BusinessRuleException;
use App\Models\AccessLog;
use App\Models\BlacklistEntry;
use App\Models\Household;
use App\Models\User;
use App\Models\VisitorPass;
use App\Notifications\GenericNotification;
use App\Services\AuditLogger;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * WF-07 visitor access and WF-17 blacklist enforcement at the gate.
 */
class AccessService
{
    public function __construct(private readonly AuditLogger $audit) {}

    public function createPass(User $user, Household $household, array $data): VisitorPass
    {
        do {
            $code = strtoupper(Str::random(6));
        } while (VisitorPass::where('code', $code)->exists() || preg_match('/[O0I1]/', $code));

        $pass = VisitorPass::create([
            'code' => $code,
            'household_id' => $household->id,
            'created_by' => $user->id,
            'visitor_name' => $data['visitor_name'],
            'visitor_phone' => $data['visitor_phone'] ?? null,
            'purpose' => $data['purpose'] ?? null,
            'vehicle_plate' => isset($data['vehicle_plate']) ? strtoupper(str_replace(' ', '', $data['vehicle_plate'])) : null,
            'valid_from' => $data['valid_from'],
            'valid_until' => $data['valid_until'],
            'max_entries' => $data['max_entries'] ?? 1,
            'status' => 'active',
        ]);
        $this->audit->log('pass.created', $pass, after: ['visitor' => $pass->visitor_name], actor: $user);

        return $pass;
    }

    public function cancelPass(VisitorPass $pass, User $user): VisitorPass
    {
        if ($pass->status !== 'active') {
            throw BusinessRuleException::invalidState('Only active passes can be cancelled.');
        }
        $pass->update(['status' => 'cancelled']);

        return $pass;
    }

    /** Matches a person or vehicle against active blacklist / watchlist entries. */
    public function screen(?string $name, ?string $phone, ?string $plate): ?BlacklistEntry
    {
        $plate = $plate ? strtoupper(str_replace(' ', '', $plate)) : null;

        return BlacklistEntry::query()->where('status', 'active')
            ->where(function ($q) use ($name, $phone, $plate) {
                $q->whereRaw('1 = 0');
                if ($phone) {
                    $q->orWhere('phone', $phone);
                }
                if ($plate) {
                    $q->orWhere('plate_number', $plate);
                }
                if ($name) {
                    $q->orWhere(fn ($w) => $w->where('subject_type', 'person')->whereRaw('LOWER(full_name) = ?', [mb_strtolower(trim($name))]));
                }
            })
            ->orderByRaw("CASE WHEN list = 'black' THEN 0 ELSE 1 END")->first();
    }

    /**
     * Gate check of a pass code: validity, remaining entries and blacklist screening.
     *
     * @return array{pass: VisitorPass, valid: bool, reason: ?string, match: ?BlacklistEntry}
     */
    public function verifyCode(string $code): array
    {
        $pass = VisitorPass::query()->with('household.unit', 'creator')->where('code', strtoupper(trim($code)))->first();
        if (! $pass) {
            throw new BusinessRuleException('No pass found with this code.', 'PASS_NOT_FOUND', 404);
        }

        $this->expireIfNeeded($pass);
        $reason = match (true) {
            $pass->status === 'cancelled' => 'This pass was cancelled by the resident.',
            $pass->status === 'expired' || $pass->valid_until->isPast() => 'This pass has expired.',
            $pass->valid_from->isFuture() => 'This pass is not valid until '.$pass->valid_from->timezone('Africa/Lagos')->format('M j, g:i A').'.',
            $pass->status === 'used' || $pass->entries_used >= $pass->max_entries => 'This pass has no entries left.',
            default => null,
        };

        $match = $this->screen($pass->visitor_name, $pass->visitor_phone, $pass->vehicle_plate);
        if ($match?->list === 'black') {
            $reason = 'BLACKLISTED: '.$match->reason;
        }

        return ['pass' => $pass, 'valid' => $reason === null, 'reason' => $reason, 'match' => $match];
    }

    /**
     * Records a gate entry or exit. Pass check-ins consume an entry; blacklisted subjects are refused
     * and the attempt is logged (FR-BLK-03).
     */
    public function record(User $officer, array $data): AccessLog
    {
        // Screening happens before the transaction so refused attempts stay logged (FR-BLK-03).
        $pass = null;
        if (! empty($data['pass_code'])) {
            $check = $this->verifyCode($data['pass_code']);
            $pass = $check['pass'];
            if ($data['direction'] === 'in' && ! $check['valid']) {
                $this->logAttempt($officer, $pass->visitor_name, $pass->vehicle_plate, $check['reason'], $pass);
                throw new BusinessRuleException($check['reason'], 'ENTRY_REFUSED', 422);
            }
        }

        $name = $data['person_name'] ?? $pass?->visitor_name;
        $plate = ! empty($data['plate_number']) ? strtoupper(str_replace(' ', '', $data['plate_number'])) : $pass?->vehicle_plate;
        $match = $data['direction'] === 'in' ? $this->screen($name, $data['phone'] ?? null, $plate) : null;

        if ($match?->list === 'black') {
            $this->logAttempt($officer, $name, $plate, 'Blacklisted: '.$match->reason, $pass);
            throw new BusinessRuleException('Entry refused: this person or vehicle is blacklisted ('.$match->reason.').', 'BLACKLISTED', 422);
        }

        $log = DB::transaction(function () use ($officer, $data, $pass, $name, $plate, $match) {
            $log = AccessLog::create([
                'subject_type' => $data['subject_type'] ?? 'visitor',
                'direction' => $data['direction'],
                'visitor_pass_id' => $pass?->id,
                'household_id' => $pass?->household_id ?? ($data['household_id'] ?? null),
                'person_name' => $name,
                'plate_number' => $plate,
                'gate' => $data['gate'] ?? 'Main Gate',
                'officer_id' => $officer->id,
                'flagged' => $match !== null,
                'flag_reason' => $match ? 'Watchlist: '.$match->reason : null,
                'note' => $data['note'] ?? null,
                'occurred_at' => now(),
            ]);

            if ($pass && $data['direction'] === 'in') {
                $pass->entries_used++;
                if ($pass->entries_used >= $pass->max_entries) {
                    $pass->status = 'used';
                }
                $pass->save();
            }

            return $log;
        });

        if ($pass && $data['direction'] === 'in') {
            $residents = User::query()->whereHas('resident', fn ($q) => $q->where('household_id', $pass->household_id))->get();
            Notification::send($residents, new GenericNotification('Your visitor has arrived', $pass->visitor_name.' checked in at '.$log->gate.'.', '/resident/visitors', 'access'));
        }

        if ($match) {
            $security = User::query()->whereHas('roles', fn ($q) => $q->whereIn('code', ['security_officer', 'estate_manager']))->get();
            Notification::send($security, new GenericNotification('Watchlist match at '.$log->gate, ($name ?? $plate).' — '.$match->reason, '/security/access', 'security'));
        }

        $this->audit->log('access.'.$data['direction'], $log, after: ['name' => $name, 'plate' => $plate], actor: $officer);

        return $log;
    }

    public function expireIfNeeded(VisitorPass $pass): void
    {
        if ($pass->status === 'active' && $pass->valid_until->isPast()) {
            $pass->update(['status' => 'expired']);
        }
    }

    private function logAttempt(User $officer, ?string $name, ?string $plate, string $reason, ?VisitorPass $pass): void
    {
        AccessLog::create([
            'subject_type' => 'visitor',
            'direction' => 'in',
            'visitor_pass_id' => $pass?->id,
            'household_id' => $pass?->household_id,
            'person_name' => $name,
            'plate_number' => $plate,
            'officer_id' => $officer->id,
            'flagged' => true,
            'flag_reason' => 'REFUSED: '.$reason,
            'occurred_at' => now(),
        ]);
    }
}
