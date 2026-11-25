<?php

namespace App\Services\Listings;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\ListingMedia;
use App\Models\ListingStatusHistory;
use App\Models\PropertyListing;
use App\Models\User;
use App\Notifications\ListingDecisionMade;
use App\Notifications\ListingSubmittedForApproval;
use App\Services\AuditLogger;
use App\Services\CodeGenerator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * WF-20 Property listing approval. Every status change goes through this class so that history,
 * audit and notifications are always written, and nothing reaches the landing page without approval.
 */
class ListingService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly CodeGenerator $codes,
    ) {}

    public function create(User $agent, array $data, bool $submit, ?UploadedFile $ownerAuth = null): PropertyListing
    {
        $listing = DB::transaction(function () use ($agent, $data, $ownerAuth) {
            $listing = new PropertyListing(array_intersect_key($data, array_flip(PropertyListing::EDITABLE)));
            $listing->forceFill([
                'listing_code' => $this->codes->next('property_listings', 'listing_code', 'L'),
                'slug' => $this->uniqueSlug($data['title']),
                'agent_user_id' => $agent->id,
                'status' => ListingStatus::Draft,
            ])->save();

            if ($ownerAuth) {
                $listing->update(['owner_auth_path' => $ownerAuth->store("listings/{$listing->id}/documents", 'local')]);
            }

            $this->history($listing, null, ListingStatus::Draft, $agent);

            return $listing;
        });

        $this->audit->log('listing.created', $listing, after: $listing->only(['listing_code', 'title', 'listing_type', 'price_ngn']), actor: $agent);

        return $submit ? $this->submit($listing, $agent) : $listing;
    }

    /**
     * Agent edits own listing. Editing a Live listing hides it and sends it back for approval (FR-LIST-08).
     * Admin edits keep the current status and are recorded in history (FR-LIST-15).
     */
    public function update(PropertyListing $listing, User $actor, array $data, ?UploadedFile $ownerAuth = null, bool $asAdmin = false): PropertyListing
    {
        $this->guardNotDeleted($listing);

        $changes = $this->diff($listing, $data);

        if ($changes === [] && ! $ownerAuth) {
            return $listing;
        }

        DB::transaction(function () use ($listing, $actor, $data, $ownerAuth, $asAdmin, $changes) {
            $listing->fill(array_intersect_key($data, array_flip(PropertyListing::EDITABLE)));

            if (isset($data['title']) && $data['title'] !== $listing->getOriginal('title')) {
                $listing->slug = $this->uniqueSlug($data['title'], $listing->id);
            }

            if ($ownerAuth) {
                if ($listing->owner_auth_path) {
                    Storage::disk('local')->delete($listing->owner_auth_path);
                }
                $listing->owner_auth_path = $ownerAuth->store("listings/{$listing->id}/documents", 'local');
                $changes['owner_authorisation'] = ['from' => 'previous file', 'to' => 'new file'];
            }

            $listing->version++;
            $from = $listing->status;

            if (! $asAdmin && $from === ListingStatus::Approved) {
                $listing->status = ListingStatus::PendingApproval;
                $listing->submitted_at = now();
                $listing->is_featured = false;
            }

            $listing->save();
            $this->history($listing, $from, $listing->status, $actor, $asAdmin ? 'Edited by admin' : null, $changes);
        });

        $this->audit->log('listing.updated', $listing, null, ['changes' => $changes], $actor);

        if (! $asAdmin && $listing->status === ListingStatus::PendingApproval && $listing->wasChanged('status')) {
            $this->notifyReviewers($listing, $changes);
        }

        return $listing->refresh();
    }

    public function submit(PropertyListing $listing, User $actor): PropertyListing
    {
        if (! $listing->status->canSubmit()) {
            throw BusinessRuleException::invalidState("A listing that is {$listing->status->label()} cannot be submitted.");
        }

        $this->guardComplete($listing);

        $from = $listing->status;
        $listing->forceFill(['status' => ListingStatus::PendingApproval, 'submitted_at' => now()])->save();
        $this->history($listing, $from, ListingStatus::PendingApproval, $actor);
        $this->audit->log('listing.submitted', $listing, ['status' => $from->value], ['status' => 'pending_approval'], $actor);

        // On a resubmission, show reviewers what the agent changed most recently.
        $raw = $from === ListingStatus::Draft ? null
            : $listing->history()->whereNotNull('changed_fields')->value('changed_fields');
        $lastChanges = is_string($raw) ? (json_decode($raw, true) ?: []) : (array) $raw;
        $this->notifyReviewers($listing, $lastChanges);

        return $listing;
    }

    public function approve(PropertyListing $listing, User $admin): PropertyListing
    {
        $this->guardStatus($listing, [ListingStatus::PendingApproval], 'approved');

        if ($listing->agent?->status !== UserStatus::Active) {
            throw new BusinessRuleException('The agent account is not active, so the listing cannot go live.', 'AGENT_INACTIVE');
        }

        return $this->transition($listing, ListingStatus::Approved, $admin, null, [
            'approved_at' => now(),
            'approved_by' => $admin->id,
            'published_until' => now()->addDays((int) config('estate.listings.publish_days')),
            'last_decision_reason' => null,
        ], 'approved');
    }

    public function reject(PropertyListing $listing, User $admin, string $reason): PropertyListing
    {
        $this->guardStatus($listing, [ListingStatus::PendingApproval], 'rejected');

        return $this->transition($listing, ListingStatus::Rejected, $admin, $reason, ['last_decision_reason' => $reason], 'rejected');
    }

    public function withdraw(PropertyListing $listing, User $admin, string $reason, bool $notify = true): PropertyListing
    {
        $this->guardStatus($listing, [ListingStatus::Approved], 'withdrawn');

        return $this->transition($listing, ListingStatus::ApprovalWithdrawn, $admin, $reason, [
            'last_decision_reason' => $reason,
            'is_featured' => false,
        ], $notify ? 'withdrawn' : null);
    }

    public function markClosed(PropertyListing $listing, User $actor): PropertyListing
    {
        $this->guardStatus($listing, [ListingStatus::Approved], 'marked rented or sold');

        return $this->transition($listing, ListingStatus::RentedSold, $actor, null, ['is_featured' => false]);
    }

    /** Extends the publish window of an unchanged live listing; no re-approval needed. */
    public function renew(PropertyListing $listing, User $actor): PropertyListing
    {
        $this->guardStatus($listing, [ListingStatus::Approved], 'renewed');

        $listing->forceFill(['published_until' => now()->addDays((int) config('estate.listings.publish_days'))])->save();
        $this->history($listing, ListingStatus::Approved, ListingStatus::Approved, $actor, 'Renewed');
        $this->audit->log('listing.renewed', $listing, actor: $actor);

        return $listing;
    }

    public function expire(PropertyListing $listing): PropertyListing
    {
        return $this->transition($listing, ListingStatus::Expired, null, 'Publish period ended', ['is_featured' => false], 'expired');
    }

    public function delete(PropertyListing $listing, User $actor, ?string $reason, bool $byAdmin): void
    {
        $this->guardNotDeleted($listing);

        DB::transaction(function () use ($listing, $actor, $reason) {
            $from = $listing->status;
            $listing->forceFill([
                'status' => ListingStatus::Deleted,
                'is_featured' => false,
                'deleted_by' => $actor->id,
                'last_decision_reason' => $reason,
            ])->save();
            $listing->delete();
            $listing->enquiries()->where('status', '!=', 'closed')->update(['status' => 'closed']);
            $this->history($listing, $from, ListingStatus::Deleted, $actor, $reason);
        });

        $this->audit->log('listing.deleted', $listing, null, ['reason' => $reason], $actor);

        if ($byAdmin && ! $listing->isOwnedBy($actor)) {
            $listing->agent?->notify(new ListingDecisionMade($listing, 'deleted', $reason));
        }
    }

    /** SA restores a deleted listing within the restore window; it returns to its previous status. */
    public function restore(PropertyListing $listing, User $admin): PropertyListing
    {
        if ($listing->status !== ListingStatus::Deleted || ! $listing->trashed()) {
            throw BusinessRuleException::invalidState('Only deleted listings can be restored.');
        }

        if ($listing->deleted_at->lt(now()->subDays((int) config('estate.listings.restore_window_days')))) {
            throw new BusinessRuleException('This listing was deleted more than 30 days ago and can no longer be restored.', 'RESTORE_WINDOW_PASSED');
        }

        $previous = ListingStatusHistory::query()
            ->where('listing_id', $listing->id)->where('to_status', ListingStatus::Deleted->value)
            ->latest('id')->value('from_status');

        $restoreTo = ListingStatus::tryFrom((string) $previous) ?? ListingStatus::Draft;
        // A listing whose publish period ended while deleted comes back as expired, not live.
        if ($restoreTo === ListingStatus::Approved && $listing->published_until?->isPast()) {
            $restoreTo = ListingStatus::Expired;
        }

        $listing->restore();

        return $this->transition($listing, $restoreTo, $admin, 'Restored', ['deleted_by' => null]);
    }

    public function setFeatured(PropertyListing $listing, User $admin, bool $featured): PropertyListing
    {
        if ($featured) {
            $this->guardStatus($listing, [ListingStatus::Approved], 'featured');
        }

        $listing->forceFill(['is_featured' => $featured])->save();
        $this->audit->log($featured ? 'listing.featured' : 'listing.unfeatured', $listing, actor: $admin);

        return $listing;
    }

    /** FR-LIST-20: suspending an agent withdraws all their live listings. */
    public function withdrawAllForAgent(User $agent, User $admin): int
    {
        $count = 0;
        PropertyListing::query()->where('agent_user_id', $agent->id)->where('status', ListingStatus::Approved)
            ->each(function (PropertyListing $listing) use ($admin, &$count) {
                $this->withdraw($listing, $admin, 'Agent suspended', notify: false);
                $count++;
            });

        return $count;
    }

    // ---------------------------------------------------------------- media

    /** @param list<UploadedFile> $files */
    public function addPhotos(PropertyListing $listing, User $actor, array $files, bool $asAdmin = false): PropertyListing
    {
        $this->guardNotDeleted($listing);
        $max = (int) config('estate.listings.max_photos');
        $existing = $listing->photos()->count();

        if ($existing + count($files) > $max) {
            throw new BusinessRuleException("A listing can have at most {$max} photos.", 'TOO_MANY_PHOTOS');
        }

        DB::transaction(function () use ($listing, $files, $existing) {
            foreach (array_values($files) as $i => $file) {
                ListingMedia::create([
                    'listing_id' => $listing->id,
                    'path' => $file->store("listings/{$listing->id}/photos", 'public'),
                    'media_type' => 'photo',
                    'is_cover' => $existing === 0 && $i === 0,
                    'sort_order' => $existing + $i,
                ]);
            }
        });

        $this->afterMediaChange($listing, $actor, ['photos' => ['from' => $existing, 'to' => $existing + count($files)]], $asAdmin);

        return $listing->load('media');
    }

    public function removePhoto(PropertyListing $listing, User $actor, ListingMedia $media, bool $asAdmin = false): PropertyListing
    {
        abort_unless((int) $media->listing_id === (int) $listing->id, 404);
        $this->guardNotDeleted($listing);

        DB::transaction(function () use ($listing, $media) {
            Storage::disk('public')->delete($media->path);
            $wasCover = $media->is_cover;
            $media->delete();

            if ($wasCover) {
                $listing->photos()->orderBy('sort_order')->first()?->update(['is_cover' => true]);
            }
        });

        $this->afterMediaChange($listing, $actor, ['photos' => ['from' => 'removed', 'to' => $media->id]], $asAdmin);

        return $listing->load('media');
    }

    /** @param list<int> $orderedIds first id becomes the cover */
    public function reorderPhotos(PropertyListing $listing, User $actor, array $orderedIds, bool $asAdmin = false): PropertyListing
    {
        $this->guardNotDeleted($listing);
        $ids = $listing->photos()->pluck('id')->all();

        if (count($orderedIds) !== count($ids) || array_diff($orderedIds, $ids) !== []) {
            throw new BusinessRuleException('The photo order must list every photo of this listing exactly once.', 'VALIDATION_FAILED');
        }

        DB::transaction(function () use ($orderedIds) {
            foreach ($orderedIds as $position => $id) {
                ListingMedia::whereKey($id)->update(['sort_order' => $position, 'is_cover' => $position === 0]);
            }
        });

        $this->afterMediaChange($listing, $actor, ['photo_order' => ['from' => $ids, 'to' => $orderedIds]], $asAdmin);

        return $listing->load('media');
    }

    // ---------------------------------------------------------------- internals

    private function afterMediaChange(PropertyListing $listing, User $actor, array $changes, bool $asAdmin): void
    {
        if (! $asAdmin && $listing->status === ListingStatus::Approved) {
            $this->transition($listing, ListingStatus::PendingApproval, $actor, null, ['submitted_at' => now(), 'is_featured' => false], null, $changes);
            $this->notifyReviewers($listing, $changes);
        }
    }

    private function transition(
        PropertyListing $listing,
        ListingStatus $to,
        ?User $actor,
        ?string $reason,
        array $attributes = [],
        ?string $notifyAgent = null,
        ?array $changes = null,
    ): PropertyListing {
        $from = $listing->status;

        DB::transaction(function () use ($listing, $to, $actor, $reason, $attributes, $from, $changes) {
            $listing->forceFill(array_merge($attributes, ['status' => $to]))->save();
            $this->history($listing, $from, $to, $actor, $reason, $changes);
        });

        $this->audit->log('listing.'.$to->value, $listing, ['status' => $from->value], ['status' => $to->value, 'reason' => $reason], $actor);

        if ($notifyAgent) {
            $listing->loadMissing('agent');
            $listing->agent?->notify(new ListingDecisionMade($listing, $notifyAgent, $reason));
        }

        return $listing;
    }

    private function history(PropertyListing $listing, ?ListingStatus $from, ListingStatus $to, ?User $actor, ?string $reason = null, ?array $changes = null): void
    {
        ListingStatusHistory::create([
            'listing_id' => $listing->id,
            'from_status' => $from?->value,
            'to_status' => $to->value,
            'actor_user_id' => $actor?->id,
            'reason' => $reason,
            'changed_fields' => $changes ?: null,
            'occurred_at' => now(),
        ]);
    }

    /** @return array<string, array{from:mixed,to:mixed}> */
    private function diff(PropertyListing $listing, array $data): array
    {
        $changes = [];

        foreach (array_intersect_key($data, array_flip(PropertyListing::EDITABLE)) as $field => $new) {
            $old = $listing->getAttribute($field);
            $normalise = fn ($v) => match (true) {
                $v instanceof \DateTimeInterface => $v->format('Y-m-d'),
                is_bool($v) => $v ? '1' : '0',
                is_array($v) => json_encode(array_values($v)),
                is_numeric($v) => rtrim(rtrim(number_format((float) $v, 2, '.', ''), '0'), '.'),
                default => (string) $v,
            };

            if ($normalise($old) !== $normalise($new)) {
                $changes[$field] = ['from' => $old instanceof \DateTimeInterface ? $old->format('Y-m-d') : $old, 'to' => $new];
            }
        }

        return $changes;
    }

    private function guardComplete(PropertyListing $listing): void
    {
        $min = (int) config('estate.listings.min_photos');
        $photos = $listing->photos()->count();
        $missing = [];

        if ($photos < $min) {
            $missing[] = "at least {$min} photos ({$photos} uploaded)";
        }
        if (! $listing->owner_auth_path) {
            $missing[] = 'the owner authorisation document';
        }
        if ($listing->listing_type === 'rent' && ! $listing->price_period) {
            $missing[] = 'the rent period';
        }

        if ($missing !== []) {
            throw new BusinessRuleException('Before submitting, add '.implode(', ', $missing).'.', 'LISTING_INCOMPLETE');
        }
    }

    /** @param list<ListingStatus> $allowed */
    private function guardStatus(PropertyListing $listing, array $allowed, string $action): void
    {
        if (! in_array($listing->status, $allowed, true)) {
            throw BusinessRuleException::invalidState("A listing that is {$listing->status->label()} cannot be {$action}.");
        }
    }

    private function guardNotDeleted(PropertyListing $listing): void
    {
        if ($listing->status === ListingStatus::Deleted || $listing->trashed()) {
            throw BusinessRuleException::invalidState('This listing has been deleted.');
        }
    }

    private function notifyReviewers(PropertyListing $listing, array $changes): void
    {
        $reviewers = User::query()
            ->where('status', UserStatus::Active)
            ->whereHas('roles', fn ($q) => $q->whereIn('code', ['super_admin', 'estate_manager']))
            ->get();

        Notification::send($reviewers, new ListingSubmittedForApproval($listing, array_keys($changes)));
    }

    private function uniqueSlug(string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug(Str::limit($title, 100, '')) ?: 'listing';
        $slug = $base;
        $i = 2;

        while (PropertyListing::withTrashed()->where('slug', $slug)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))->exists()) {
            $slug = $base.'-'.$i++;
        }

        return $slug;
    }
}
