<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * M16 Property listings, landing page and agents (SRS Section 9.14).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agent_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('agency_name', 120)->nullable();
            $table->string('agency_reg_no', 60)->nullable();
            $table->string('id_document_path');
            $table->text('bio')->nullable();
            // pending | approved | rejected | suspended
            $table->string('status', 20)->default('pending')->index();
            $table->boolean('verified')->default(false);
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->string('decision_reason', 500)->nullable();
            $table->timestamps();
        });

        Schema::create('property_listings', function (Blueprint $table) {
            $table->id();
            $table->string('listing_code', 30)->unique();
            $table->string('slug', 160)->unique();
            $table->foreignId('agent_user_id')->constrained('users')->restrictOnDelete();
            $table->string('listing_type', 10); // rent | sale
            $table->string('property_type', 40);
            $table->string('title', 120);
            $table->text('description');
            $table->foreignId('unit_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('sector_id')->constrained()->restrictOnDelete();
            $table->foreignId('street_id')->constrained()->restrictOnDelete();
            $table->boolean('show_unit_number')->default(false);
            $table->unsignedTinyInteger('bedrooms')->nullable();
            $table->unsignedTinyInteger('bathrooms')->nullable();
            $table->unsignedTinyInteger('toilets')->nullable();
            $table->decimal('size_sqm', 10, 2)->nullable();
            $table->string('furnishing', 20)->nullable();
            $table->decimal('price_ngn', 14, 2);
            $table->string('price_period', 10)->nullable(); // year | month (required for rent)
            $table->boolean('negotiable')->default(false);
            $table->decimal('service_charge_ngn', 14, 2)->nullable();
            $table->decimal('caution_fee_ngn', 14, 2)->nullable();
            $table->decimal('agency_fee_ngn', 14, 2)->nullable();
            $table->date('available_from');
            $table->json('amenities')->nullable();
            $table->string('video_url')->nullable();
            $table->string('owner_auth_path')->nullable();
            // draft | pending_approval | approved | rejected | approval_withdrawn | rented_sold | expired | deleted
            $table->string('status', 24)->default('draft');
            $table->boolean('is_featured')->default(false);
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_until')->nullable();
            $table->string('last_decision_reason', 500)->nullable();
            $table->unsignedInteger('view_count')->default(0);
            $table->unsignedInteger('version')->default(1);
            $table->timestamp('deleted_at')->nullable();
            $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'listing_type', 'property_type', 'price_ngn'], 'listings_public_search_idx');
            $table->index(['agent_user_id', 'status']);
        });

        if (DB::getDriverName() === 'mysql') {
            DB::statement('ALTER TABLE property_listings ADD FULLTEXT listings_fulltext (title, description)');
        }

        Schema::create('listing_media', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listing_id')->constrained('property_listings')->cascadeOnDelete();
            $table->string('path');
            $table->string('media_type', 20)->default('photo'); // photo | floor_plan
            $table->boolean('is_cover')->default(false);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('listing_status_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listing_id')->constrained('property_listings')->cascadeOnDelete();
            $table->string('from_status', 24)->nullable();
            $table->string('to_status', 24);
            $table->foreignId('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason', 500)->nullable();
            $table->json('changed_fields')->nullable();
            $table->timestamp('occurred_at')->useCurrent();
        });

        Schema::create('listing_enquiries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('listing_id')->constrained('property_listings')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 100);
            $table->string('phone', 20);
            $table->string('email')->nullable();
            $table->text('message');
            $table->date('preferred_viewing_date')->nullable();
            $table->string('status', 20)->default('new'); // new | contacted | closed
            $table->text('agent_note')->nullable();
            $table->string('ip_hash', 64)->nullable();
            $table->timestamps();
            $table->index(['listing_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_enquiries');
        Schema::dropIfExists('listing_status_history');
        Schema::dropIfExists('listing_media');
        Schema::dropIfExists('property_listings');
        Schema::dropIfExists('agent_profiles');
    }
};
