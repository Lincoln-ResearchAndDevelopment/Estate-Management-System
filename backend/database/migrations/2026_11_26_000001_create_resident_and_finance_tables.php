<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M03 household vehicles and M05 finance & billing (SRS 9.4, 9.5).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->text('mfa_secret')->nullable()->after('remember_token');
            $table->timestamp('mfa_enabled_at')->nullable()->after('mfa_secret');
            $table->text('mfa_recovery_codes')->nullable()->after('mfa_enabled_at');
        });

        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('plate_number', 20)->unique();
            $table->string('make', 40)->nullable();
            $table->string('model', 40)->nullable();
            $table->string('colour', 30)->nullable();
            $table->string('sticker_number', 30)->nullable();
            $table->string('status', 20)->default('active'); // active | removed
            $table->timestamps();
        });

        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('code', 30)->unique();
            $table->text('description')->nullable();
            $table->decimal('amount', 14, 2);
            $table->string('frequency', 20); // monthly | quarterly | yearly | one_off
            $table->string('applies_to', 20)->default('all'); // all | selected
            $table->boolean('auto_bill')->default(true);
            $table->unsignedSmallInteger('due_days')->default(14);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('service_assignments', function (Blueprint $table) {
            $table->foreignId('service_id')->constrained()->cascadeOnDelete();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->primary(['service_id', 'household_id']);
        });

        Schema::create('bills', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->foreignId('household_id')->constrained()->restrictOnDelete();
            $table->foreignId('service_id')->nullable()->constrained()->nullOnDelete();
            $table->string('description', 200);
            $table->string('period_label', 20)->nullable(); // e.g. 2026-11, 2026-Q4, 2026
            $table->decimal('amount', 14, 2);
            $table->decimal('amount_paid', 14, 2)->default(0);
            $table->date('due_date');
            // unpaid | part_paid | paid | overdue | void
            $table->string('status', 20)->default('unpaid');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['household_id', 'service_id', 'period_label'], 'bills_one_per_period');
            $table->index(['status', 'due_date']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 40)->unique();
            $table->foreignId('household_id')->constrained()->restrictOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 14, 2);
            // paystack | bank_transfer | cash | pos
            $table->string('method', 20);
            // pending | success | failed | pending_verification | rejected
            $table->string('status', 24)->default('pending');
            $table->string('gateway_reference', 100)->nullable();
            $table->json('gateway_payload')->nullable();
            $table->string('proof_path')->nullable();
            $table->string('receipt_number', 30)->nullable()->unique();
            $table->text('note')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->string('rejection_reason', 500)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'paid_at']);
        });

        Schema::create('payment_allocations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->foreignId('bill_id')->constrained()->restrictOnDelete();
            $table->decimal('amount', 14, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_allocations');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('bills');
        Schema::dropIfExists('service_assignments');
        Schema::dropIfExists('services');
        Schema::dropIfExists('vehicles');
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn(['mfa_secret', 'mfa_enabled_at', 'mfa_recovery_codes']));
    }
};
