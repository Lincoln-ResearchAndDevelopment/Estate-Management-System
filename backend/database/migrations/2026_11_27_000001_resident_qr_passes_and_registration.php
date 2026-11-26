<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * - Registration: profile picture becomes optional and the face verification photo is removed.
 * - QR passes: visitor passes and residents get an unguessable token encoded in their QR code.
 * - Billing: bills record the first day of the period they cover, so paying ahead does not
 *   affect a resident's current clearance.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('access_requests', function (Blueprint $table) {
            $table->string('profile_photo_path')->nullable()->change();
        });
        Schema::table('access_requests', function (Blueprint $table) {
            $table->dropColumn('face_capture_path');
        });

        Schema::table('visitor_passes', function (Blueprint $table) {
            $table->string('qr_token', 48)->nullable()->unique()->after('code');
        });
        Schema::table('residents', function (Blueprint $table) {
            $table->string('pass_token', 48)->nullable()->unique();
        });
        Schema::table('bills', function (Blueprint $table) {
            $table->date('period_start')->nullable()->after('period_label');
        });
    }

    public function down(): void
    {
        Schema::table('bills', fn (Blueprint $t) => $t->dropColumn('period_start'));
        Schema::table('residents', fn (Blueprint $t) => $t->dropColumn('pass_token'));
        Schema::table('visitor_passes', fn (Blueprint $t) => $t->dropColumn('qr_token'));
        Schema::table('access_requests', function (Blueprint $table) {
            $table->string('face_capture_path')->nullable();
        });
    }
};
