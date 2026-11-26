<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M04 Property & unit registry, M12 access requests and the core of M03 households.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sectors', function (Blueprint $table) {
            $table->id();
            $table->string('name', 80)->unique();
            $table->string('code', 20)->unique();
            $table->timestamps();
        });

        Schema::create('streets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sector_id')->constrained()->restrictOnDelete();
            $table->string('name', 120);
            $table->timestamps();
            $table->unique(['sector_id', 'name']);
        });

        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->string('unit_code', 40)->unique();
            $table->foreignId('sector_id')->constrained()->restrictOnDelete();
            $table->foreignId('street_id')->constrained()->restrictOnDelete();
            $table->string('unit_type', 40);
            $table->unsignedTinyInteger('rooms')->nullable();
            // occupied | vacant | under_watch
            $table->string('occupancy_status', 20)->default('vacant');
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->timestamps();
            $table->index(['sector_id', 'occupancy_status']);
        });

        Schema::create('households', function (Blueprint $table) {
            $table->id();
            $table->foreignId('unit_id')->constrained()->restrictOnDelete();
            $table->foreignId('head_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('tenant_access')->default(false);
            $table->boolean('guest_auto_approve')->default(false);
            $table->boolean('service_entry')->default(false);
            $table->timestamps();
        });

        Schema::create('residents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('full_name', 120);
            // primary_resident | spouse | child | parent | relative | tenant | sub_tenant | domestic_staff
            $table->string('relationship', 30);
            $table->string('phone', 20)->nullable();
            // pending | active | away | removed
            $table->string('status', 20)->default('active');
            $table->date('moved_in_date')->nullable();
            $table->timestamps();
        });

        Schema::create('access_requests', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->string('full_name', 120);
            $table->string('email');
            $table->string('phone', 20);
            $table->string('relationship', 30);
            $table->foreignId('unit_id')->constrained()->restrictOnDelete();
            $table->text('nin_encrypted');
            $table->string('nin_hash', 64)->index();
            $table->string('password_hash');
            $table->json('declarations');
            $table->string('profile_photo_path');
            $table->string('face_capture_path');
            // pending | info_requested | approved | rejected | expired
            $table->string('status', 20)->default('pending')->index();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('decision_reason', 500)->nullable();
            $table->foreignId('created_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['email', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('access_requests');
        Schema::dropIfExists('residents');
        Schema::dropIfExists('households');
        Schema::dropIfExists('units');
        Schema::dropIfExists('streets');
        Schema::dropIfExists('sectors');
    }
};
