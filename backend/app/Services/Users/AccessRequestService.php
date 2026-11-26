<?php

namespace App\Services\Users;

use App\Enums\UserStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\AccessRequest;
use App\Models\Household;
use App\Models\Resident;
use App\Models\User;
use App\Notifications\AccessRequestDecided;
use App\Notifications\AccessRequestReceived;
use App\Notifications\NewAccessRequestForReview;
use App\Services\AuditLogger;
use App\Services\CodeGenerator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;

/**
 * WF-01 Resident access request and approval.
 */
class AccessRequestService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly CodeGenerator $codes,
        private readonly UserAccountService $accounts,
    ) {}

    public function submit(array $data, ?UploadedFile $photo = null): AccessRequest
    {
        $email = strtolower($data['email']);
        $ninHash = AccessRequest::hashNin($data['national_id']);

        if (User::withTrashed()->where('email', $email)->exists()) {
            throw BusinessRuleException::duplicate('An account with this email already exists.');
        }

        $open = AccessRequest::query()->whereIn('status', ['pending', 'info_requested']);
        if ((clone $open)->where('email', $email)->exists() || (clone $open)->where('nin_hash', $ninHash)->exists()) {
            throw BusinessRuleException::duplicate('A request with this email or National ID is already awaiting review.');
        }

        $request = DB::transaction(function () use ($data, $email, $ninHash, $photo) {
            return AccessRequest::create([
                'reference' => $this->codes->next('access_requests', 'reference', 'AR'),
                'full_name' => $data['full_name'],
                'email' => $email,
                'phone' => $data['phone'],
                'relationship' => $data['relationship'],
                'unit_id' => $data['unit_id'],
                'nin_encrypted' => preg_replace('/\D/', '', $data['national_id']),
                'nin_hash' => $ninHash,
                'password_hash' => Hash::make($data['password']),
                'declarations' => [
                    'insideEstate' => (bool) $data['declaration_inside_estate'],
                    'infoCorrect' => (bool) $data['declaration_info_correct'],
                    'agreeRules' => (bool) $data['declaration_agree_rules'],
                ],
                // The optional profile picture is private: stored on the local (non-public) disk.
                'profile_photo_path' => $photo?->store('access-requests/photos', 'local'),
                'status' => 'pending',
            ]);
        });

        Notification::route('mail', $request->email)->notify(new AccessRequestReceived($request));
        Notification::send($this->reviewers(), new NewAccessRequestForReview($request));
        $this->audit->log('access_request.submitted', $request, after: $request->only(['reference', 'full_name', 'email', 'unit_id', 'relationship']));

        return $request;
    }

    public function approve(AccessRequest $request, User $actor): AccessRequest
    {
        $this->guardOpen($request);

        DB::transaction(function () use ($request, $actor) {
            $isHead = in_array($request->relationship, ['primary_resident', 'tenant'], true);
            $household = Household::query()->firstOrCreate(['unit_id' => $request->unit_id]);

            // If the unit already has a head of household, the applicant joins as a household member.
            if ($isHead && $household->head_user_id) {
                $isHead = false;
            }

            $role = $isHead ? 'resident_head' : 'resident_member';

            $user = new User([
                'name' => $request->full_name,
                'email' => $request->email,
                'phone' => User::where('phone', $request->phone)->exists() ? null : $request->phone,
                'status' => UserStatus::Active,
                'primary_role' => $role,
            ]);
            // The applicant chose this password at registration; it is already hashed, and the
            // 'hashed' cast stores an existing hash unchanged.
            $user->forceFill(['password' => $request->password_hash])->save();
            $this->accounts->syncRoles($user, [$role]);

            if ($isHead) {
                $household->update(['head_user_id' => $user->id]);
            }

            Resident::create([
                'household_id' => $household->id,
                'user_id' => $user->id,
                'full_name' => $request->full_name,
                'relationship' => $isHead ? 'primary_resident' : $request->relationship,
                'phone' => $request->phone,
                'status' => 'active',
                'moved_in_date' => now()->toDateString(),
            ]);

            $request->unit()->update(['occupancy_status' => 'occupied']);

            $request->update([
                'status' => 'approved',
                'reviewed_by' => $actor->id,
                'reviewed_at' => now(),
                'created_user_id' => $user->id,
            ]);
        });

        Notification::route('mail', $request->email)->notify(new AccessRequestDecided($request, 'approved'));
        $this->audit->log('access_request.approved', $request, ['status' => 'pending'], ['status' => 'approved'], $actor);

        return $request->refresh();
    }

    public function reject(AccessRequest $request, User $actor, string $reason): AccessRequest
    {
        return $this->decide($request, $actor, 'rejected', $reason);
    }

    public function requestInfo(AccessRequest $request, User $actor, string $reason): AccessRequest
    {
        return $this->decide($request, $actor, 'info_requested', $reason);
    }

    private function decide(AccessRequest $request, User $actor, string $status, string $reason): AccessRequest
    {
        $this->guardOpen($request);
        $before = $request->status;

        $request->update([
            'status' => $status,
            'reviewed_by' => $actor->id,
            'reviewed_at' => now(),
            'decision_reason' => $reason,
        ]);

        Notification::route('mail', $request->email)->notify(new AccessRequestDecided($request, $status));
        $this->audit->log('access_request.'.$status, $request, ['status' => $before], ['status' => $status, 'reason' => $reason], $actor);

        return $request;
    }

    private function guardOpen(AccessRequest $request): void
    {
        if (! in_array($request->status, ['pending', 'info_requested'], true)) {
            throw BusinessRuleException::invalidState('This request has already been decided.');
        }
    }

    /** @return \Illuminate\Support\Collection<int, User> */
    private function reviewers()
    {
        return User::query()
            ->where('status', UserStatus::Active)
            ->whereHas('roles', fn ($q) => $q->whereIn('code', ['super_admin', 'estate_manager']))
            ->get();
    }
}
