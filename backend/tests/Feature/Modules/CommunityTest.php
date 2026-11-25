<?php

namespace Tests\Feature\Modules;

use App\Models\Order;
use App\Models\Product;
use App\Models\Store;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/** M07 communication, M06 marketplace, M11 staff, M14 reports, settings. */
class CommunityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Notification::fake();
    }

    public function test_announcements_meetings_feed_and_messages(): void
    {
        $this->signIn('estate_manager');
        $this->postJson('/api/v1/announcements', ['title' => 'Water outage', 'body' => 'Water off on Saturday from 9am.', 'audience' => 'residents'])->assertCreated();
        $meeting = $this->postJson('/api/v1/meetings', ['title' => 'AGM', 'location' => 'Hall', 'starts_at' => now()->addWeek()->toIso8601String()])->assertCreated()->json('data.id');

        $resident = $this->resident();
        $this->signIn($resident);
        $this->getJson('/api/v1/announcements')->assertOk()->assertJsonCount(1, 'data');
        $this->postJson('/api/v1/announcements', ['title' => 'Hi', 'body' => 'Not allowed to publish', 'audience' => 'all'])->assertForbidden();
        $this->postJson("/api/v1/meetings/{$meeting}/rsvp", ['response' => 'yes'])->assertOk();
        $this->postJson("/api/v1/meetings/{$meeting}/rsvp", ['response' => 'maybe'])->assertOk();
        $this->postJson('/api/v1/posts', ['body' => 'Anyone selling a used generator?'])->assertCreated();

        $manager = $this->userWithRole('estate_manager');
        $conv = $this->postJson('/api/v1/conversations', ['recipient_ids' => [$manager->id], 'subject' => 'Gate remote', 'body' => 'My gate remote stopped working.'])
            ->assertCreated()->json('data.id');
        // Residents can only start conversations with estate staff, not other residents.
        $other = $this->resident();
        $this->postJson('/api/v1/conversations', ['recipient_ids' => [$other->id], 'subject' => 'Hello', 'body' => 'Hi neighbour'])->assertStatus(422);

        $this->signIn($manager);
        $this->getJson("/api/v1/conversations/{$conv}/messages")->assertOk()->assertJsonCount(1, 'data.messages');
        $this->postJson("/api/v1/conversations/{$conv}/messages", ['body' => 'A technician will come by today.'])->assertCreated();

        $this->signIn($other);
        $this->getJson("/api/v1/conversations/{$conv}/messages")->assertForbidden();
    }

    public function test_store_approval_order_and_stock_flow(): void
    {
        $owner = $this->signIn('store_owner');
        $this->postJson('/api/v1/store', ['name' => 'Mama Put Kitchen', 'category' => 'food'])->assertCreated();
        $store = Store::firstOrFail();
        $this->assertSame('pending', $store->status);
        $this->postJson('/api/v1/store/products', ['name' => 'Jollof rice', 'price' => 2500, 'stock' => 5, 'is_active' => true])->assertCreated();
        $product = Product::firstOrFail();

        $buyer = $this->resident();
        $this->signIn($buyer);
        $this->getJson('/api/v1/market/stores')->assertOk()->assertJsonCount(0, 'data');
        $this->postJson('/api/v1/market/orders', ['store_id' => $store->id, 'items' => [['product_id' => $product->id, 'quantity' => 1]]])->assertStatus(422);

        $this->signIn('estate_manager');
        $this->postJson("/api/v1/admin/stores/{$store->id}/decision", ['status' => 'active'])->assertOk();

        $this->signIn($buyer);
        $this->postJson('/api/v1/market/orders', ['store_id' => $store->id, 'items' => [['product_id' => $product->id, 'quantity' => 9]]])->assertStatus(422);
        $this->postJson('/api/v1/market/orders', ['store_id' => $store->id, 'items' => [['product_id' => $product->id, 'quantity' => 2]]])
            ->assertCreated()->assertJsonPath('data.total.amount', '5000.00');
        $order = Order::firstOrFail();

        $this->signIn($owner);
        $this->postJson("/api/v1/store/orders/{$order->id}/status", ['status' => 'accepted'])->assertOk();
        $this->assertSame(3, $product->fresh()->stock);
        $this->postJson("/api/v1/store/orders/{$order->id}/status", ['status' => 'delivered'])->assertStatus(409);
        $this->postJson("/api/v1/store/orders/{$order->id}/status", ['status' => 'cancelled', 'reason' => 'Ran out of gas'])->assertOk();
        $this->assertSame(5, $product->fresh()->stock);
    }

    public function test_staff_management_reports_and_settings(): void
    {
        $this->signIn('estate_manager');
        $this->postJson('/api/v1/staff', [
            'full_name' => 'Musa Ibrahim', 'job_title' => 'Gardener', 'department' => 'maintenance', 'employment_type' => 'full_time',
        ])->assertCreated();
        $this->getJson('/api/v1/staff')->assertOk()->assertJsonCount(1, 'data');

        $this->putJson('/api/v1/admin/settings', ['estate_phone' => '+2348011112222', 'bank_name' => 'Test Bank'])->assertOk();
        $this->getJson('/api/v1/public/estate')->assertOk()->assertJsonPath('data.contact.phone', '+2348011112222');

        $this->signIn('finance_officer');
        $this->getJson('/api/v1/reports/summary')->assertOk();
        $csv = $this->get('/api/v1/reports/export/payments');
        $csv->assertOk();
        $this->assertStringContainsString('text/csv', $csv->headers->get('content-type'));
        $this->getJson('/api/v1/reports/export/nonsense')->assertNotFound();
        $this->postJson('/api/v1/staff', ['full_name' => 'X Y', 'job_title' => 'A', 'department' => 'other', 'employment_type' => 'contract'])->assertForbidden();
    }
}
