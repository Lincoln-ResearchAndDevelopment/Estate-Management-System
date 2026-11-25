<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The signed-in user with everything the front end needs to build permission-based navigation.
 * The front end uses this for display only; every permission is enforced again on the server.
 *
 * @mixin \App\Models\User
 */
class SessionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $this->resource->loadMissing('roles');

        return [
            'user' => (new UserResource($this->resource))->resolve($request),
            'permissions' => $this->permissionCodes()->values(),
            'portal' => $this->portalPath(),
            'mustChangePassword' => (bool) $this->must_change_password,
        ];
    }
}
