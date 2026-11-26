<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin \App\Models\User */
class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'status' => $this->status->value,
            'primaryRole' => $this->primary_role,
            'roles' => $this->whenLoaded('roles', fn () => $this->roles->map(fn ($r) => ['code' => $r->code, 'name' => $r->name])->values()),
            'avatarUrl' => $this->avatar_path ? Storage::disk('public')->url($this->avatar_path) : null,
            'lastLoginAt' => $this->last_login_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
