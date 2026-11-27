<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * Syncs roles, permissions and the role→permission matrix from config/rbac.php.
 * Safe to run repeatedly (production included).
 */
class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        foreach (config('rbac.permissions') as $code => $description) {
            Permission::updateOrCreate(['code' => $code], ['description' => $description]);
        }

        $allPermissionIds = Permission::query()->pluck('id', 'code');

        foreach (config('rbac.roles') as $code => $name) {
            $role = Role::updateOrCreate(['code' => $code], ['name' => $name]);
            $granted = config("rbac.role_permissions.{$code}", []);

            $ids = in_array('*', $granted, true)
                ? $allPermissionIds->values()
                : $allPermissionIds->only($granted)->values();

            $role->permissions()->sync($ids);
        }
    }
}
