<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RolePermissionSeeder::class);

        // Demonstration data is only seeded outside production and is clearly marked as test data.
        if (! app()->isProduction()) {
            $this->call(DemoDataSeeder::class);
        } else {
            $this->call(InitialAdminSeeder::class);
        }
    }
}
