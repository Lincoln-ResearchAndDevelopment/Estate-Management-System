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
        // M03 residents
        'residents.view' => 'View residents, households and vehicles',
        'household.manage_own' => 'Manage own profile, household members and vehicles',
        // M05 finance
        'finance.view' => 'View bills, payments and financial reports',
        'finance.manage' => 'Manage services, issue bills and record payments',
        'finance.verify' => 'Verify or reject manual payments',
        'finance.pay_own' => 'View and pay own household bills',
        // M08 security & emergency
        'alerts.raise' => 'Raise panic / emergency alerts',
        'security.respond' => 'Acknowledge, dispatch and resolve emergency alerts (security team only)',
        'security.view' => 'View the security console and emergency alerts (read-only)',
        'security.reports' => 'Create and manage intelligence / incident reports',
        // M09 access control and M10 blacklist
        'access.manage_own' => 'Create visitor passes and away notices for own household',
        'access.gate' => 'Verify passes and record gate check-in / check-out',
        'access.view' => 'View access logs and away notices',
        'blacklist.view' => 'View the blacklist and watchlist',
        'blacklist.manage' => 'Add and clear blacklist / watchlist entries',
        // M11 staff
        'staff.view' => 'View staff records',
        'staff.manage' => 'Create, edit, suspend and deactivate staff',
        // M07 communication
        'comms.use' => 'Read notices, RSVP to meetings, post in the community feed and send messages',
        'comms.publish' => 'Publish notices and schedule meetings',
        'comms.moderate' => 'Hide community posts',
        // M06 marketplace
        'market.shop' => 'Browse stores and place orders',
        'store.manage_own' => 'Manage own store, products and orders',
        'stores.approve' => 'Approve, suspend and set plans for stores',
        // M14 reports
        'reports.view' => 'View analytics and export reports',
    ],

    'role_permissions' => [
        'super_admin' => ['*'],
        'estate_manager' => [
            'dashboard.admin', 'users.view', 'users.manage', 'users.block',
            'access_requests.view', 'access_requests.decide', 'agents.view', 'agents.decide',
            'estate.view', 'estate.manage', 'listings.review', 'listings.create', 'listings.edit_any',
            'listings.delete_any', 'listings.approve', 'listings.feature', 'audit.view', 'settings.manage',
            'residents.view', 'finance.view', 'security.view', 'security.reports', 'access.view',
            'blacklist.view', 'blacklist.manage', 'staff.view', 'staff.manage', 'comms.use', 'comms.publish',
            'comms.moderate', 'stores.approve', 'reports.view',
        ],
        'finance_officer' => [
            'dashboard.admin', 'users.view', 'estate.view', 'residents.view',
            'finance.view', 'finance.manage', 'finance.verify', 'comms.use', 'reports.view',
        ],
        'security_officer' => [
            'users.view', 'access_requests.view', 'estate.view', 'residents.view', 'security.respond',
            'security.reports', 'access.gate', 'access.view', 'blacklist.view', 'blacklist.manage', 'comms.use',
        ],
        'resident_head' => [
            'estate.view', 'household.manage_own', 'finance.pay_own', 'alerts.raise', 'access.manage_own',
            'comms.use', 'market.shop',
        ],
        'resident_member' => ['estate.view', 'finance.pay_own', 'alerts.raise', 'access.manage_own', 'comms.use', 'market.shop'],
        'store_owner' => ['store.manage_own', 'comms.use', 'market.shop'],
        'staff' => ['estate.view', 'comms.use'],
        'agent' => ['listings.manage_own'],
    ],

    // Portal each role lands on after sign-in (front-end route).
    'portals' => [
        'super_admin' => '/admin',
        'estate_manager' => '/admin',
        'finance_officer' => '/admin',
        'security_officer' => '/security',
        'resident_head' => '/resident',
        'resident_member' => '/resident',
        'store_owner' => '/store',
        'staff' => '/resident',
        'agent' => '/agent',
    ],
];
