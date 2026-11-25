<?php

namespace Tests\Feature;

use App\Enums\ListingStatus;
use App\Models\ListingMedia;
use App\Models\PropertyListing;
use App\Models\Street;
use App\Models\User;
use App\Notifications\ListingDecisionMade;
use App\Notifications\ListingSubmittedForApproval;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** AT-25 – AT-30, AT-32: WF-20 property listing approval. */
class ListingWorkflowTest extends TestCase
{
    private User $agent;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        Storage::fake('local');
        Notification::fake();

        $this->agent = $this->userWithRole('agent');
        $this->agent->agentProfile()->create(['id_document_path' => 'x.pdf', 'status' => 'approved', 'verified' => true]);
        $this->admin = $this->userWithRole('estate_manager');
    }

    private function payload(array $overrides = []): array
    {
        $street = Street::factory()->create();

        return array_merge([
            'title' => 'Lovely three bedroom flat with parking',
            'listing_type' => 'rent',
            'property_type' => 'flat',
            'description' => str_repeat('Bright, airy flat in a secure gated estate. ', 3),
            'sector_id' => $street->sector_id,
            'street_id' => $street->id,
            'bedrooms' => 3,
            'bathrooms' => 2,
            'price_ngn' => 2500000,
            'price_period' => 'year',
            'available_from' => now()->addDays(3)->toDateString(),
            'amenities' => ['Borehole', 'Parking'],
            'owner_authorisation' => UploadedFile::fake()->create('authority.pdf', 100, 'application/pdf'),
        ], $overrides);
    }

    private function createSubmittedListing(): PropertyListing
    {
        $this->signIn($this->agent);
        $id = $this->post('/api/v1/agent/listings', $this->payload(), ['Accept' => 'application/json'])->assertCreated()->json('data.id');

        $this->post("/api/v1/agent/listings/{$id}/media", [
            'photos' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg'), UploadedFile::fake()->image('c.jpg')],
        ], ['Accept' => 'application/json'])->assertOk();

        $this->postJson("/api/v1/agent/listings/{$id}/submit", ['declaration' => true])->assertOk()
            ->assertJsonPath('data.status', 'pending_approval');

        return PropertyListing::findOrFail($id);
    }

    public function test_submitted_listing_is_hidden_until_admin_approves(): void
    {
        $listing = $this->createSubmittedListing();
        Notification::assertSentTo($this->admin, ListingSubmittedForApproval::class);

        $this->getJson('/api/v1/public/listings')->assertJsonPath('meta.total', 0);
        $this->getJson("/api/v1/public/listings/{$listing->slug}")->assertNotFound();

        $this->signIn($this->admin);
        $this->postJson("/api/v1/admin/listings/{$listing->id}/approve")->assertOk()->assertJsonPath('data.status', 'approved');
        Notification::assertSentTo($this->agent, ListingDecisionMade::class);

        $this->getJson('/api/v1/public/listings')->assertJsonPath('meta.total', 1);
        $this->getJson("/api/v1/public/listings/{$listing->slug}")->assertOk()
            ->assertJsonPath('data.title', $listing->title)
            ->assertJsonMissingPath('data.status')
            ->assertJsonMissingPath('data.agent.phone');
    }

    public function test_submission_requires_photos_and_owner_authorisation(): void
    {
        $this->signIn($this->agent);
        $id = $this->post('/api/v1/agent/listings', $this->payload(['owner_authorisation' => null]), ['Accept' => 'application/json'])
            ->assertCreated()->json('data.id');

        $this->postJson("/api/v1/agent/listings/{$id}/submit", ['declaration' => true])
            ->assertStatus(422)->assertJsonPath('code', 'LISTING_INCOMPLETE');
    }

    public function test_rejection_requires_reason_and_agent_can_resubmit(): void
    {
        $listing = $this->createSubmittedListing();

        $this->signIn($this->admin);
        $this->postJson("/api/v1/admin/listings/{$listing->id}/reject")->assertStatus(422);
        $this->postJson("/api/v1/admin/listings/{$listing->id}/reject", ['reason' => 'Photos are too dark to assess.'])
            ->assertOk()->assertJsonPath('data.status', 'rejected');

        $this->signIn($this->agent);
        $this->getJson("/api/v1/agent/listings/{$listing->id}")->assertJsonPath('data.lastDecisionReason', 'Photos are too dark to assess.');
        $this->patchJson("/api/v1/agent/listings/{$listing->id}", ['price_ngn' => 2400000])->assertOk();
        $this->postJson("/api/v1/agent/listings/{$listing->id}/submit", ['declaration' => true])->assertOk()
            ->assertJsonPath('data.status', 'pending_approval');
    }

    public function test_editing_a_live_listing_hides_it_and_records_changed_fields(): void
    {
        $listing = $this->createSubmittedListing();
        $this->signIn($this->admin);
        $this->postJson("/api/v1/admin/listings/{$listing->id}/approve")->assertOk();

        $this->signIn($this->agent);
        $this->patchJson("/api/v1/agent/listings/{$listing->id}", ['price_ngn' => 3000000])->assertOk()
            ->assertJsonPath('data.status', 'pending_approval');

        $this->getJson("/api/v1/public/listings/{$listing->slug}")->assertNotFound();

        $this->signIn($this->admin);
        $history = $this->getJson("/api/v1/admin/listings/{$listing->id}")->assertOk()->json('data.history');
        $this->assertArrayHasKey('price_ngn', $history[0]['changedFields']);
    }

    public function test_withdraw_and_delete_remove_listing_from_public_immediately(): void
    {
        $listing = $this->createSubmittedListing();
        $this->signIn($this->admin);
        $this->postJson("/api/v1/admin/listings/{$listing->id}/approve")->assertOk();

        $this->postJson("/api/v1/admin/listings/{$listing->id}/withdraw", ['reason' => 'Ownership is being verified.'])
            ->assertOk()->assertJsonPath('data.status', 'approval_withdrawn');
        $this->getJson("/api/v1/public/listings/{$listing->slug}")->assertNotFound();

        $this->deleteJson("/api/v1/admin/listings/{$listing->id}", ['reason' => 'Duplicate of another listing.'])->assertOk();
        $this->assertSoftDeleted('property_listings', ['id' => $listing->id]);
        $this->assertSame(ListingStatus::Deleted, PropertyListing::withTrashed()->find($listing->id)->status);
    }

    public function test_super_admin_restores_deleted_listing_but_estate_manager_cannot(): void
    {
        $listing = $this->createSubmittedListing();
        $this->signIn($this->admin);
        $this->deleteJson("/api/v1/admin/listings/{$listing->id}", ['reason' => 'Removed by mistake today.'])->assertOk();

        $this->postJson("/api/v1/admin/listings/{$listing->id}/restore")->assertForbidden();

        $this->signIn('super_admin');
        $this->postJson("/api/v1/admin/listings/{$listing->id}/restore")->assertOk()
            ->assertJsonPath('data.status', 'pending_approval');
    }

    public function test_agent_cannot_see_or_change_another_agents_listing(): void
    {
        $listing = $this->createSubmittedListing();
        $other = $this->userWithRole('agent');
        $this->signIn($other);

        $this->getJson("/api/v1/agent/listings/{$listing->id}")->assertNotFound();
        $this->patchJson("/api/v1/agent/listings/{$listing->id}", ['price_ngn' => 1])->assertNotFound();
        $this->deleteJson("/api/v1/agent/listings/{$listing->id}")->assertNotFound();
    }

    public function test_agent_deletes_own_listing(): void
    {
        $listing = $this->createSubmittedListing();

        $this->deleteJson("/api/v1/agent/listings/{$listing->id}")->assertOk();
        $this->assertSoftDeleted('property_listings', ['id' => $listing->id]);
    }

    public function test_suspending_an_agent_withdraws_all_live_listings(): void
    {
        $listing = $this->createSubmittedListing();
        $this->signIn($this->admin);
        $this->postJson("/api/v1/admin/listings/{$listing->id}/approve")->assertOk();

        $this->postJson("/api/v1/admin/agents/{$this->agent->agentProfile->id}/suspend", ['reason' => 'Repeated policy violations.'])->assertOk();

        $this->assertSame(ListingStatus::ApprovalWithdrawn, $listing->fresh()->status);
        $this->getJson('/api/v1/public/listings')->assertJsonPath('meta.total', 0);
    }

    public function test_cover_photo_moves_when_cover_is_deleted(): void
    {
        $listing = $this->createSubmittedListing();
        $cover = ListingMedia::where('listing_id', $listing->id)->where('is_cover', true)->first();

        $this->deleteJson("/api/v1/agent/listings/{$listing->id}/media/{$cover->id}")->assertOk();

        $this->assertSame(1, ListingMedia::where('listing_id', $listing->id)->where('is_cover', true)->count());
    }

    public function test_expiry_command_expires_listings_past_their_window(): void
    {
        $listing = PropertyListing::factory()->status(ListingStatus::Approved)->create([
            'agent_user_id' => $this->agent->id, 'published_until' => now()->subMinute(),
        ]);

        $this->artisan('listings:expire')->assertSuccessful();

        $this->assertSame(ListingStatus::Expired, $listing->fresh()->status);
    }
}
