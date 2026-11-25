<?php

namespace Database\Seeders;

use App\Enums\ListingStatus;
use App\Enums\UserStatus;
use App\Models\AgentProfile;
use App\Models\Household;
use App\Models\ListingStatusHistory;
use App\Models\PropertyListing;
use App\Models\Resident;
use App\Models\Sector;
use App\Models\Street;
use App\Models\Unit;
use App\Models\User;
use App\Services\Users\UserAccountService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * TEST DATA ONLY — never runs in production. Every record is marked: e-mails end in @test.pahe.local,
 * listing titles start with "TEST –". Demo password comes from DEMO_USER_PASSWORD.
 */
class DemoDataSeeder extends Seeder
{
    public function run(UserAccountService $accounts): void
    {
        $password = env('DEMO_USER_PASSWORD', 'Demo@Pahe2026');

        // Estate structure
        $layout = [
            ['Sector A', 'SEC-A', ['Mogadishu Avenue', 'Ahmadu Bello Crescent']],
            ['Sector B', 'SEC-B', ['Lugard Street', 'Ojukwu Close']],
            ['Sector C', 'SEC-C', ['Garrison Road', 'Barracks View']],
        ];
        $types = ['Detached duplex', 'Semi-detached duplex', 'Terrace', 'Bungalow', 'Flat'];

        foreach ($layout as [$sectorName, $code, $streets]) {
            $sector = Sector::firstOrCreate(['code' => $code], ['name' => $sectorName]);
            foreach ($streets as $s => $streetName) {
                $street = Street::firstOrCreate(['sector_id' => $sector->id, 'name' => $streetName]);
                for ($n = 1; $n <= 8; $n++) {
                    Unit::firstOrCreate(
                        ['unit_code' => sprintf('%s-%d%02d', substr($code, -1), $s + 1, $n)],
                        ['sector_id' => $sector->id, 'street_id' => $street->id, 'unit_type' => $types[$n % count($types)], 'rooms' => 2 + $n % 4, 'occupancy_status' => $n <= 5 ? 'occupied' : 'vacant']
                    );
                }
            }
        }

        // One test account per role
        $people = [
            'super_admin' => 'Test Super Admin',
            'estate_manager' => 'Test Estate Manager',
            'finance_officer' => 'Test Finance Officer',
            'security_officer' => 'Test Security Officer',
            'resident_head' => 'Test Resident Head',
            'resident_member' => 'Test Resident Member',
            'store_owner' => 'Test Store Owner',
            'staff' => 'Test Staff',
            'agent' => 'Test Agent',
        ];

        $users = [];
        foreach ($people as $role => $name) {
            $users[$role] = User::firstOrCreate(
                ['email' => str_replace('_', '.', $role).'@test.pahe.local'],
                ['name' => $name, 'password' => $password, 'status' => UserStatus::Active, 'primary_role' => $role]
            );
            $accounts->syncRoles($users[$role], [$role]);
        }

        // Household for the test residents
        $unit = Unit::where('occupancy_status', 'occupied')->orderBy('id')->first();
        $household = Household::firstOrCreate(['unit_id' => $unit->id], ['head_user_id' => $users['resident_head']->id]);
        foreach (['resident_head' => 'primary_resident', 'resident_member' => 'spouse'] as $role => $relationship) {
            Resident::firstOrCreate(['user_id' => $users[$role]->id], [
                'household_id' => $household->id, 'full_name' => $users[$role]->name, 'relationship' => $relationship, 'status' => 'active',
            ]);
        }

        // Approved agent + sample listings in different statuses
        AgentProfile::firstOrCreate(['user_id' => $users['agent']->id], [
            'agency_name' => 'Test Realty Ltd', 'id_document_path' => 'agents/id-documents/test.pdf',
            'status' => 'approved', 'verified' => true, 'approved_by' => $users['super_admin']->id, 'approved_at' => now(),
        ]);

        $samples = [
            ['TEST – 4-bedroom detached duplex with BQ', 'rent', 'detached_duplex', 4, 4500000, 'year', ListingStatus::Approved, true],
            ['TEST – 3-bedroom terrace near the main gate', 'rent', 'terrace', 3, 2800000, 'year', ListingStatus::Approved, false],
            ['TEST – 2-bedroom flat, fully serviced', 'rent', 'flat', 2, 150000, 'month', ListingStatus::Approved, false],
            ['TEST – 5-bedroom semi-detached duplex for sale', 'sale', 'semi_detached_duplex', 5, 185000000, null, ListingStatus::Approved, true],
            ['TEST – 3-bedroom bungalow awaiting review', 'sale', 'bungalow', 3, 75000000, null, ListingStatus::PendingApproval, false],
            ['TEST – Draft maisonette listing', 'rent', 'maisonette', 3, 3200000, 'year', ListingStatus::Draft, false],
        ];

        $streets = Street::with('sector')->get();
        foreach ($samples as $i => [$title, $type, $propertyType, $beds, $price, $period, $status, $featured]) {
            if (PropertyListing::withTrashed()->where('title', $title)->exists()) {
                continue;
            }
            $street = $streets[$i % $streets->count()];
            $listing = PropertyListing::create([
                'listing_code' => sprintf('%s-L-%d-%04d', config('estate.code_prefix'), now()->year, 9000 + $i),
                'slug' => Str::slug($title),
                'agent_user_id' => $users['agent']->id,
                'listing_type' => $type,
                'property_type' => $propertyType,
                'title' => $title,
                'description' => 'Test data for development and demonstrations. Spacious home in a secure, gated estate with good road network, reliable water supply and 24-hour security.',
                'sector_id' => $street->sector_id,
                'street_id' => $street->id,
                'bedrooms' => $beds,
                'bathrooms' => $beds,
                'toilets' => $beds + 1,
                'size_sqm' => 120 + $beds * 40,
                'furnishing' => 'unfurnished',
                'price_ngn' => $price,
                'price_period' => $period,
                'negotiable' => $i % 2 === 0,
                'available_from' => now()->addDays(7)->toDateString(),
                'amenities' => ['Borehole', 'Prepaid meter', 'Parking', '24h security'],
                'owner_auth_path' => 'listings/test/owner-authorisation.pdf',
                'status' => $status,
                'is_featured' => $featured,
                'submitted_at' => $status !== ListingStatus::Draft ? now()->subDays(3) : null,
                'approved_at' => $status === ListingStatus::Approved ? now()->subDays(2 + $i) : null,
                'approved_by' => $status === ListingStatus::Approved ? $users['super_admin']->id : null,
                'published_until' => $status === ListingStatus::Approved ? now()->addDays(88) : null,
            ]);
            ListingStatusHistory::create(['listing_id' => $listing->id, 'to_status' => $status->value, 'actor_user_id' => $users['agent']->id, 'reason' => 'Seeded test data', 'occurred_at' => now()]);
        }

        $this->command?->info("Test accounts: <role>@test.pahe.local (e.g. super.admin@test.pahe.local), password: {$password}");
    }
}
