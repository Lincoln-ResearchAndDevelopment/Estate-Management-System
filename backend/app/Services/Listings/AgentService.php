<?php

namespace App\Services\Listings;

use App\Enums\UserStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\AgentProfile;
use App\Models\User;
use App\Notifications\AgentApplicationUpdate;
use App\Services\AuditLogger;
use App\Services\Users\UserAccountService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Agent onboarding (FR-LIST-05) and suspension (FR-LIST-20).
 */
class AgentService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly UserAccountService $accounts,
        private readonly ListingService $listings,
    ) {}

    public function apply(array $data, UploadedFile $idDocument, ?UploadedFile $photo): AgentProfile
    {
        $profile = DB::transaction(function () use ($data, $idDocument, $photo) {
            $user = User::create([
                'name' => $data['full_name'],
                'email' => strtolower($data['email']),
                'phone' => $data['phone'],
                'password' => $data['password'],
                'status' => UserStatus::Pending,
                'primary_role' => 'agent',
                'avatar_path' => $photo?->store('avatars', 'public'),
            ]);
            $this->accounts->syncRoles($user, ['agent']);

            return AgentProfile::create([
                'user_id' => $user->id,
                'agency_name' => $data['agency_name'] ?? null,
                'agency_reg_no' => $data['agency_reg_no'] ?? null,
                'id_document_path' => $idDocument->store('agents/id-documents', 'local'),
                'status' => 'pending',
            ]);
        });

        $profile->load('user');
        Notification::send($this->reviewers(), new AgentApplicationUpdate($profile, 'submitted'));
        $this->audit->log('agent.applied', $profile, after: ['user_id' => $profile->user_id, 'agency' => $profile->agency_name], actor: $profile->user);

        return $profile;
    }

    public function approve(AgentProfile $profile, User $admin): AgentProfile
    {
        $this->guard($profile, ['pending', 'rejected'], 'approved');

        DB::transaction(function () use ($profile, $admin) {
            $profile->update(['status' => 'approved', 'verified' => true, 'approved_by' => $admin->id, 'approved_at' => now(), 'decision_reason' => null]);
            $profile->user->forceFill(['status' => UserStatus::Active])->save();
        });

        return $this->finish($profile, $admin, 'approved');
    }

    public function reject(AgentProfile $profile, User $admin, string $reason): AgentProfile
    {
        $this->guard($profile, ['pending'], 'rejected');

        DB::transaction(function () use ($profile, $reason) {
            $profile->update(['status' => 'rejected', 'decision_reason' => $reason]);
            $profile->user->forceFill(['status' => UserStatus::Inactive])->save();
        });

        return $this->finish($profile, $admin, 'rejected', $reason);
    }

    public function suspend(AgentProfile $profile, User $admin, string $reason): AgentProfile
    {
        $this->guard($profile, ['approved'], 'suspended');

        DB::transaction(function () use ($profile, $admin, $reason) {
            $profile->update(['status' => 'suspended', 'decision_reason' => $reason]);
            $this->accounts->setStatus($profile->user, UserStatus::Blocked, $admin, $reason);
            $this->listings->withdrawAllForAgent($profile->user, $admin);
        });

        return $this->finish($profile, $admin, 'suspended', $reason);
    }

    public function reinstate(AgentProfile $profile, User $admin): AgentProfile
    {
        $this->guard($profile, ['suspended'], 'reinstated');

        DB::transaction(function () use ($profile, $admin) {
            $profile->update(['status' => 'approved', 'decision_reason' => null]);
            $this->accounts->setStatus($profile->user, UserStatus::Active, $admin);
        });

        return $this->finish($profile, $admin, 'reinstated');
    }

    private function finish(AgentProfile $profile, User $admin, string $event, ?string $reason = null): AgentProfile
    {
        $profile->user->notify(new AgentApplicationUpdate($profile, $event, $reason));
        $this->audit->log('agent.'.$event, $profile, null, ['reason' => $reason], $admin);

        return $profile->refresh()->load('user');
    }

    /** @param list<string> $allowed */
    private function guard(AgentProfile $profile, array $allowed, string $action): void
    {
        if (! in_array($profile->status, $allowed, true)) {
            throw BusinessRuleException::invalidState("An agent who is {$profile->status} cannot be {$action}.");
        }
    }

    private function reviewers()
    {
        return User::query()->where('status', UserStatus::Active)
            ->whereHas('roles', fn ($q) => $q->whereIn('code', ['super_admin', 'estate_manager']))->get();
    }
}
