<?php

namespace App\Services\Security;

use App\Exceptions\BusinessRuleException;
use App\Models\AlertEvent;
use App\Models\EmergencyAlert;
use App\Models\User;
use App\Notifications\GenericNotification;
use App\Services\AuditLogger;
use App\Services\CodeGenerator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * WF-05 panic / emergency alert state machine:
 * raised → acknowledged → dispatched → resolved | false_alarm; raised → cancelled (by the resident).
 * Security officers are notified on every new alert; unacknowledged alerts escalate to EM/SA.
 */
class AlertService
{
    private const TRANSITIONS = [
        'raised' => ['acknowledged', 'cancelled', 'false_alarm'],
        'acknowledged' => ['dispatched', 'resolved', 'false_alarm'],
        'dispatched' => ['resolved', 'false_alarm'],
    ];

    public function __construct(private readonly CodeGenerator $codes, private readonly AuditLogger $audit) {}

    public function raise(User $user, string $type, ?float $lat, ?float $lng, ?string $description): EmergencyAlert
    {
        $household = $user->household();

        // One active panic per household: a second press returns the open alert instead of a duplicate.
        $open = EmergencyAlert::query()->where('raised_by', $user->id)->whereIn('status', EmergencyAlert::ACTIVE)->latest()->first();
        if ($open) {
            return $open;
        }

        $alert = DB::transaction(function () use ($user, $type, $lat, $lng, $description, $household) {
            $alert = EmergencyAlert::create([
                'reference' => $this->codes->next('emergency_alerts', 'reference', 'EA', 5),
                'type' => $type,
                'raised_by' => $user->id,
                'household_id' => $household?->id,
                'unit_id' => $household?->unit_id,
                'lat' => $lat,
                'lng' => $lng,
                'description' => $description,
                'status' => 'raised',
            ]);
            $this->event($alert, null, 'raised', $user, $description);

            return $alert;
        });

        $where = $household?->unit?->unit_code ? ' at '.$household->unit->unit_code : '';
        Notification::send($this->responders(), new GenericNotification(
            strtoupper($type).' ALERT'.$where,
            $user->name.($description ? ': '.$description : ''),
            '/security/alerts/'.$alert->id,
            'emergency',
            email: true,
        ));
        $this->audit->log('alert.raised', $alert, after: ['type' => $type], actor: $user);

        return $alert;
    }

    public function transition(EmergencyAlert $alert, string $to, User $actor, ?string $note = null, ?int $responderId = null): EmergencyAlert
    {
        $allowed = self::TRANSITIONS[$alert->status] ?? [];
        if (! in_array($to, $allowed, true)) {
            throw BusinessRuleException::invalidState("An alert that is {$alert->status} cannot be marked {$to}.");
        }
        if ($to === 'cancelled' && $alert->raised_by !== $actor->id) {
            throw new BusinessRuleException('Only the person who raised the alert can cancel it.', 'FORBIDDEN', 403);
        }
        if (in_array($to, ['resolved', 'false_alarm'], true) && ! $note) {
            throw new BusinessRuleException('Add a resolution note.', 'VALIDATION_FAILED');
        }

        $from = $alert->status;
        DB::transaction(function () use ($alert, $to, $actor, $note, $responderId, $from) {
            $changes = ['status' => $to];
            if ($to === 'acknowledged') {
                $changes += ['acknowledged_by' => $actor->id, 'acknowledged_at' => now()];
            }
            if ($to === 'dispatched') {
                $changes += ['responder_id' => $responderId ?? $actor->id, 'dispatched_at' => now()];
            }
            if (in_array($to, ['resolved', 'false_alarm'], true)) {
                $changes += ['resolved_by' => $actor->id, 'resolved_at' => now(), 'resolution_note' => $note];
            }
            $alert->update($changes);
            $this->event($alert, $from, $to, $actor, $note);
        });

        if ($alert->raised_by !== $actor->id) {
            $messages = [
                'acknowledged' => 'Security has received your alert and is responding.',
                'dispatched' => 'A security officer is on the way.',
                'resolved' => 'Your alert has been resolved.',
                'false_alarm' => 'Your alert was closed as a false alarm.',
            ];
            $alert->raiser?->notify(new GenericNotification('Alert '.$alert->reference.': '.str_replace('_', ' ', $to), $messages[$to] ?? null, '/resident/emergency', 'emergency'));
        }
        $this->audit->log('alert.'.$to, $alert, ['status' => $from], ['status' => $to, 'note' => $note], $actor);

        return $alert->refresh();
    }

    /** Escalates alerts still unacknowledged after the configured delay. Returns the count escalated. */
    public function escalateStale(): int
    {
        $count = 0;
        EmergencyAlert::query()->where('status', 'raised')->whereNull('escalated_at')
            ->where('created_at', '<=', now()->subSeconds((int) config('estate.security.escalate_after_seconds')))
            ->each(function (EmergencyAlert $alert) use (&$count) {
                $alert->update(['escalated_at' => now()]);
                $managers = User::query()->where('status', 'active')
                    ->whereHas('roles', fn ($q) => $q->whereIn('code', ['estate_manager', 'super_admin']))->get();
                Notification::send($managers, new GenericNotification('ESCALATED: unacknowledged '.$alert->type.' alert '.$alert->reference, 'No security officer has acknowledged this alert.', '/security/alerts/'.$alert->id, 'emergency', email: true));
                $this->event($alert, 'raised', 'raised', null, 'Escalated to estate management');
                $count++;
            });

        return $count;
    }

    private function event(EmergencyAlert $alert, ?string $from, string $to, ?User $actor, ?string $note): void
    {
        AlertEvent::create(['alert_id' => $alert->id, 'actor_id' => $actor?->id, 'from_status' => $from, 'to_status' => $to, 'note' => $note, 'occurred_at' => now()]);
    }

    private function responders()
    {
        return User::query()->where('status', 'active')
            ->whereHas('roles', fn ($q) => $q->whereIn('code', ['security_officer', 'estate_manager']))->get();
    }
}
