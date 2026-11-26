<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * M08 security & emergency, M09 access control, M10 blacklist & watchlist, M11 staff (SRS 9.8, 9.9).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('emergency_alerts', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->string('type', 20); // panic | medical | fire | security
            $table->foreignId('raised_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('household_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('unit_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('lat', 10, 7)->nullable();
            $table->decimal('lng', 10, 7)->nullable();
            $table->text('description')->nullable();
            // raised | acknowledged | dispatched | resolved | false_alarm | cancelled
            $table->string('status', 20)->default('raised');
            $table->foreignId('acknowledged_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acknowledged_at')->nullable();
            $table->foreignId('responder_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('dispatched_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_note')->nullable();
            $table->timestamp('escalated_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'created_at']);
        });

        Schema::create('alert_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('alert_id')->constrained('emergency_alerts')->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('from_status', 20)->nullable();
            $table->string('to_status', 20);
            $table->text('note')->nullable();
            $table->timestamp('occurred_at')->useCurrent();
        });

        Schema::create('incident_reports', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 30)->unique();
            $table->string('title', 150);
            $table->string('category', 40); // theft | suspicious_activity | trespass | vandalism | noise | other
            $table->string('severity', 20); // low | medium | high | critical
            $table->string('location', 150)->nullable();
            $table->text('description');
            $table->foreignId('reported_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 20)->default('open'); // open | investigating | closed
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->index(['status', 'severity']);
        });

        Schema::create('incident_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_report_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->text('body');
            $table->timestamps();
        });

        Schema::create('blacklist_entries', function (Blueprint $table) {
            $table->id();
            $table->string('list', 10)->default('black'); // black | watch
            $table->string('subject_type', 10); // person | vehicle
            $table->string('full_name', 120)->nullable();
            $table->string('phone', 20)->nullable()->index();
            $table->string('plate_number', 20)->nullable()->index();
            $table->text('reason');
            $table->string('status', 10)->default('active'); // active | cleared
            $table->foreignId('added_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('cleared_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cleared_at')->nullable();
            $table->string('cleared_reason', 500)->nullable();
            $table->timestamps();
        });

        Schema::create('visitor_passes', function (Blueprint $table) {
            $table->id();
            $table->string('code', 12)->unique();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('visitor_name', 120);
            $table->string('visitor_phone', 20)->nullable();
            $table->string('purpose', 150)->nullable();
            $table->string('vehicle_plate', 20)->nullable();
            $table->dateTime('valid_from');
            $table->dateTime('valid_until');
            $table->unsignedSmallInteger('max_entries')->default(1);
            $table->unsignedSmallInteger('entries_used')->default(0);
            $table->string('status', 12)->default('active'); // active | used | expired | cancelled
            $table->timestamps();
            $table->index(['household_id', 'status']);
        });

        Schema::create('access_logs', function (Blueprint $table) {
            $table->id();
            $table->string('subject_type', 12); // visitor | resident | staff | vehicle | contractor
            $table->string('direction', 3); // in | out
            $table->foreignId('visitor_pass_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('household_id')->nullable()->constrained()->nullOnDelete();
            $table->string('person_name', 120)->nullable();
            $table->string('plate_number', 20)->nullable();
            $table->string('gate', 40)->default('Main Gate');
            $table->foreignId('officer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->boolean('flagged')->default(false);
            $table->string('flag_reason', 255)->nullable();
            $table->string('note', 255)->nullable();
            $table->timestamp('occurred_at')->useCurrent();
            $table->index(['occurred_at']);
            $table->index(['visitor_pass_id', 'direction']);
        });

        Schema::create('away_notices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('household_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->date('from_date');
            $table->date('to_date');
            $table->string('note', 500)->nullable();
            $table->string('emergency_contact', 120)->nullable();
            $table->string('status', 12)->default('active'); // active | cancelled
            $table->timestamps();
        });

        Schema::create('staff_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('staff_code', 30)->unique();
            $table->foreignId('user_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('full_name', 120);
            $table->string('phone', 20)->nullable();
            $table->string('email')->nullable();
            $table->string('job_title', 80);
            $table->string('department', 40); // security | maintenance | sanitation | administration | other
            $table->string('employment_type', 20)->default('full_time'); // full_time | part_time | contract
            $table->date('hired_on')->nullable();
            $table->string('status', 20)->default('active'); // active | suspended | deactivated
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['staff_profiles', 'away_notices', 'access_logs', 'visitor_passes', 'blacklist_entries', 'incident_notes', 'incident_reports', 'alert_events', 'emergency_alerts'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
