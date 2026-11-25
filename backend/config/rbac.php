<?php

/*
|--------------------------------------------------------------------------
| Role-based access control
|--------------------------------------------------------------------------
| Seeded by RolePermissionSeeder from SRS Section 5.3 / 5.5. Codes are the
| single source of truth: routes use `permission:<code>`, the front end
| builds its navigation from the permission list returned by /auth/session.
| Row-level scope (own listing, own household) is enforced by Policies.
|
| Modules that are not built yet add their permissions here when built.
*/

return [
    'roles' => [
        'super_admin' => 'Super Administrator',
        'estate_manager' => 'Estate Manager',
        'finance_officer' => 'Finance Officer',
        'security_officer' => 'Security Officer',
        'resident_head' => 'Resident (Head of Household)',
        'resident_member' => 'Resident (Household Member)',
        'store_owner' => 'Store Owner',
        'staff' => 'Staff',
        'agent' => 'Property Agent',
    ],

    'permissions' => [
        'dashboard.admin' => 'View the estate administration dashboard',
        'users.view' => 'View user accounts',
        'users.manage' => 'Create and edit user accounts',
        'users.block' => 'Block and unblock user accounts',
        'roles.manage' => 'Manage roles and permissions',
        'access_requests.view' => 'View resident access requests',
        'access_requests.decide' => 'Approve or reject resident access requests',
        'agents.view' => 'View agents and agent applications',
        'agents.decide' => 'Approve, reject, suspend and reinstate agents',
        'estate.view' => 'View sectors, streets and units',
        'estate.manage' => 'Create and edit sectors, streets and units',
        'listings.review' => 'View listings in any status (approval queue)',
        'listings.create' => 'Create property listings',
        'listings.edit_any' => 'Edit any listing',
        'listings.delete_any' => 'Delete any listing',
        'listings.approve' => 'Approve, reject and withdraw listings',
        'listings.feature' => 'Feature listings on the landing page',
        'listings.restore' => 'Restore deleted listings',
        'listings.manage_own' => 'Manage own listings and enquiries (agents)',
        'audit.view' => 'View the audit log',
        'settings.manage' => 'Manage system settings',
    ],

    'role_permissions' => [
        'super_admin' => ['*'],
        'estate_manager' => [
            'dashboard.admin', 'users.view', 'users.manage', 'users.block',
            'access_requests.view', 'access_requests.decide', 'agents.view', 'agents.decide',
            'estate.view', 'estate.manage', 'listings.review', 'listings.create', 'listings.edit_any',
            'listings.delete_any', 'listings.approve', 'listings.feature', 'audit.view',
        ],
        'finance_officer' => ['users.view', 'estate.view'],
        'security_officer' => ['users.view', 'access_requests.view', 'estate.view'],
        'resident_head' => ['estate.view'],
        'resident_member' => ['estate.view'],
        'store_owner' => [],
        'staff' => ['estate.view'],
        'agent' => ['listings.manage_own'],
    ],

    // Portal each role lands on after sign-in (front-end route).
    'portals' => [
        'super_admin' => '/admin',
        'estate_manager' => '/admin',
        'finance_officer' => '/admin',
        'security_officer' => '/admin',
        'resident_head' => '/resident',
        'resident_member' => '/resident',
        'store_owner' => '/resident',
        'staff' => '/resident',
        'agent' => '/agent',
    ],
];
