<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M07 communication and M06 marketplace (SRS 9.6, 9.7).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title', 150);
            $table->text('body');
            $table->string('audience', 20)->default('all'); // all | residents | staff | security
            $table->boolean('pinned')->default(false);
            $table->foreignId('published_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('published_at')->useCurrent();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        Schema::create('meetings', function (Blueprint $table) {
            $table->id();
            $table->string('title', 150);
            $table->text('agenda')->nullable();
            $table->string('location', 150);
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->string('status', 12)->default('scheduled'); // scheduled | cancelled | held
            $table->text('minutes')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();
        });

        Schema::create('meeting_rsvps', function (Blueprint $table) {
            $table->foreignId('meeting_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('response', 6); // yes | no | maybe
            $table->timestamps();
            $table->primary(['meeting_id', 'user_id']);
        });

        Schema::create('community_posts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->string('status', 10)->default('visible'); // visible | hidden
            $table->foreignId('moderated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('moderation_reason', 255)->nullable();
            $table->timestamps();
        });

        Schema::create('post_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_post_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->string('subject', 150);
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();
        });

        Schema::create('conversation_participants', function (Blueprint $table) {
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('last_read_at')->nullable();
            $table->primary(['conversation_id', 'user_id']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();
            $table->index(['conversation_id', 'id']);
        });

        Schema::create('stores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_user_id')->unique()->constrained('users')->restrictOnDelete();
            $table->string('name', 100);
            $table->string('slug', 120)->unique();
            $table->string('category', 40); // groceries | pharmacy | food | laundry | services | other
            $table->text('description')->nullable();
            $table->string('phone', 20)->nullable();
            $table->string('location', 150)->nullable();
            $table->string('logo_path')->nullable();
            $table->string('status', 12)->default('pending'); // pending | active | suspended | rejected
            $table->string('plan', 12)->default('basic'); // basic | standard | premium
            $table->string('decision_reason', 500)->nullable();
            $table->timestamps();
        });

        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->foreignId('store_id')->constrained()->cascadeOnDelete();
            $table->string('name', 120);
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2);
            $table->unsignedInteger('stock')->default(0);
            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('orders', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->foreignId('store_id')->constrained()->restrictOnDelete();
            $table->foreignId('buyer_user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('household_id')->nullable()->constrained()->nullOnDelete();
            // placed | accepted | ready | delivered | cancelled | rejected
            $table->string('status', 12)->default('placed');
            $table->decimal('total', 14, 2);
            $table->string('payment_method', 20)->default('pay_on_delivery');
            $table->string('delivery_note', 500)->nullable();
            $table->string('status_reason', 255)->nullable();
            $table->timestamps();
            $table->index(['store_id', 'status']);
        });

        Schema::create('order_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('product_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 120);
            $table->decimal('unit_price', 12, 2);
            $table->unsignedSmallInteger('quantity');
            $table->decimal('line_total', 14, 2);
        });
    }

    public function down(): void
    {
        foreach (['order_items', 'orders', 'products', 'stores', 'messages', 'conversation_participants', 'conversations', 'post_comments', 'community_posts', 'meeting_rsvps', 'meetings', 'announcements'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
