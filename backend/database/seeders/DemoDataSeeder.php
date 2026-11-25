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
use App\Models\Announcement;
use App\Models\BlacklistEntry;
use App\Models\CommunityPost;
use App\Models\IncidentReport;
use App\Models\Meeting;
use App\Models\Product;
use App\Models\Service;
use App\Models\StaffProfile;
use App\Models\Store;
use App\Models\Vehicle;
use App\Services\Finance\BillingService;
use App\Services\Finance\PaymentService;
use App\Services\Market\OrderService;
use App\Services\Security\AccessService;
use App\Services\Security\AlertService;
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

        $this->seedModules($users, $household);

        $this->command?->info("Test accounts: <role>@test.pahe.local (e.g. super.admin@test.pahe.local), password: {$password}");
    }

    /**
     * Seeds one realistic slice of every operational module. Runs through the real services so the
     * data obeys the same business rules as production. Skipped if it has already run.
     *
     * @param  array<string, User>  $users
     */
    private function seedModules(array $users, Household $household): void
    {
        if (Service::where('code', 'TEST-SVC')->exists()) {
            return;
        }

        $admin = $users['super_admin'];

        // Second test household so finance and security screens have more than one row.
        $unit2 = Unit::where('occupancy_status', 'occupied')->where('id', '!=', $household->unit_id)->orderBy('id')->first();
        $neighbour = User::firstOrCreate(['email' => 'resident.neighbour@test.pahe.local'], [
            'name' => 'Test Neighbour', 'password' => env('DEMO_USER_PASSWORD', 'Demo@Pahe2026'), 'status' => UserStatus::Active, 'primary_role' => 'resident_head',
        ]);
        app(UserAccountService::class)->syncRoles($neighbour, ['resident_head']);
        $household2 = Household::firstOrCreate(['unit_id' => $unit2->id], ['head_user_id' => $neighbour->id]);
        Resident::firstOrCreate(['user_id' => $neighbour->id], ['household_id' => $household2->id, 'full_name' => $neighbour->name, 'relationship' => 'primary_resident', 'status' => 'active']);

        Vehicle::firstOrCreate(['plate_number' => 'TESTABC123'], ['household_id' => $household->id, 'added_by' => $users['resident_head']->id, 'make' => 'Toyota', 'model' => 'Corolla', 'colour' => 'Silver']);

        // Finance: two recurring services, bills for this period, one paid, one transfer awaiting verification.
        $billing = app(BillingService::class);
        Service::create(['name' => 'TEST – Estate service charge', 'code' => 'TEST-SVC', 'amount' => 25000, 'frequency' => 'monthly', 'applies_to' => 'all', 'auto_bill' => true, 'due_days' => 14, 'description' => 'Test data: security, sanitation and common-area upkeep.']);
        Service::create(['name' => 'TEST – Waste collection', 'code' => 'TEST-WASTE', 'amount' => 5000, 'frequency' => 'monthly', 'applies_to' => 'all', 'auto_bill' => true, 'due_days' => 14]);
        foreach (Service::whereIn('code', ['TEST-SVC', 'TEST-WASTE'])->get() as $service) {
            $billing->billService($service, now()->subMonth(), $admin);
            $billing->billService($service, now(), $admin);
        }
        $payments = app(PaymentService::class);
        $oldest = $household->bills()->orderBy('due_date')->orderBy('id')->first();
        if ($oldest) {
            $payments->recordOffline($users['finance_officer'], $household, (float) $oldest->amount, 'bank_transfer', [$oldest->id], 'TEST – seeded offline payment');
        }

        // Security: a resolved alert, an open incident, one blacklist and one watchlist entry.
        $alerts = app(AlertService::class);
        $alert = $alerts->raise($users['resident_head'], 'security', null, null, 'TEST – seeded alert: suspicious person at the back fence');
        $alerts->transition($alert, 'acknowledged', $users['security_officer']);
        $alerts->transition($alert, 'resolved', $users['security_officer'], 'TEST – patrol checked the area; nothing found.');

        IncidentReport::create(['reference' => sprintf('%s-INC-%d-9001', config('estate.code_prefix'), now()->year), 'title' => 'TEST – Streetlight vandalised on Lugard Street', 'category' => 'vandalism', 'severity' => 'medium', 'location' => 'Lugard Street', 'description' => 'Test data. Two streetlight covers broken overnight.', 'reported_by' => $users['security_officer']->id, 'status' => 'open']);

        BlacklistEntry::create(['list' => 'black', 'subject_type' => 'person', 'full_name' => 'TEST Barred Person', 'phone' => '+2348000000001', 'reason' => 'Test data: barred after repeated trespass.', 'added_by' => $users['estate_manager']->id]);
        BlacklistEntry::create(['list' => 'watch', 'subject_type' => 'vehicle', 'plate_number' => 'TESTWATCH1', 'reason' => 'Test data: vehicle seen loitering; notify supervisor on entry.', 'added_by' => $users['security_officer']->id]);

        // Access: one active pass for tomorrow.
        app(AccessService::class)->createPass($users['resident_head'], $household, [
            'visitor_name' => 'TEST Visitor', 'visitor_phone' => '+2348000000002', 'purpose' => 'Family visit',
            'valid_from' => now()->startOfDay(), 'valid_until' => now()->addDay()->endOfDay(), 'max_entries' => 2,
        ]);

        // Staff directory, linking the test security officer and staff accounts.
        StaffProfile::firstOrCreate(['staff_code' => 'TEST-STF-001'], ['user_id' => $users['security_officer']->id, 'full_name' => $users['security_officer']->name, 'job_title' => 'Gate Supervisor', 'department' => 'security', 'hired_on' => now()->subYear()->toDateString()]);
        StaffProfile::firstOrCreate(['staff_code' => 'TEST-STF-002'], ['user_id' => $users['staff']->id, 'full_name' => $users['staff']->name, 'job_title' => 'Maintenance Technician', 'department' => 'maintenance', 'hired_on' => now()->subMonths(6)->toDateString()]);
        StaffProfile::firstOrCreate(['staff_code' => 'TEST-STF-003'], ['full_name' => 'TEST Sanitation Worker', 'job_title' => 'Cleaner', 'department' => 'sanitation', 'employment_type' => 'contract']);

        // Communication.
        Announcement::create(['title' => 'TEST – Water supply maintenance on Saturday', 'body' => 'Test data. Water will be off between 9am and 1pm while the main pump is serviced.', 'audience' => 'all', 'pinned' => true, 'published_by' => $users['estate_manager']->id]);
        Meeting::create(['title' => 'TEST – Quarterly residents meeting', 'agenda' => "Test data.\n1. Security update\n2. Service charge review", 'location' => 'Estate Community Hall', 'starts_at' => now()->addDays(10)->setTime(16, 0), 'created_by' => $users['estate_manager']->id]);
        CommunityPost::create(['user_id' => $users['resident_head']->id, 'body' => 'TEST – Does anyone know a reliable generator technician in the estate?']);

        // Marketplace: an approved store with stock and one order.
        $store = Store::create(['owner_user_id' => $users['store_owner']->id, 'name' => 'TEST Mini Mart', 'slug' => 'test-mini-mart', 'category' => 'groceries', 'description' => 'Test data store.', 'phone' => '+2348000000003', 'location' => 'Shop 2, Estate Plaza', 'status' => 'active']);
        $bread = Product::create(['store_id' => $store->id, 'name' => 'TEST Sliced bread', 'price' => 1500, 'stock' => 40]);
        Product::create(['store_id' => $store->id, 'name' => 'TEST Table water (pack of 12)', 'price' => 2400, 'stock' => 25]);
        Product::create(['store_id' => $store->id, 'name' => 'TEST Eggs (crate)', 'price' => 6500, 'stock' => 10]);
        app(OrderService::class)->place($users['resident_head'], $store, [['product_id' => $bread->id, 'quantity' => 2]], 'TEST – deliver to the gatehouse');
    }
}
