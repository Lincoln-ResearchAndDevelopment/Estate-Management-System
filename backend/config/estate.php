<?php

return [
    // Roles recognised by the system. `users.role` (admin module) is mirrored to Spatie roles.
    'roles' => ['super_admin', 'admin', 'manager', 'security', 'resident', 'staff', 'agent', 'maintenance', 'store_owner'],

    // Roles an admin may create from the Admin app. Residents are imported from the onboarding form.
    'admin_created_roles' => ['security', 'store_owner', 'staff', 'agent', 'manager', 'maintenance'],

    // Existing module routes were written without auth. Set ESTATE_ENFORCE_AUTH=true once the
    // front end sends the Sanctum token, to require login + role on every API group.
    'enforce_auth' => env('ESTATE_ENFORCE_AUTH', false),

    // Frontend base URL used in set-password links.
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),
];
