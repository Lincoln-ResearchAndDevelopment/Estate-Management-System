<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\AccessRequest */
class AccessRequestResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'fullName' => $this->full_name,
            'email' => $this->email,
            'phone' => $this->phone,
            'relationship' => $this->relationship,
            'unit' => $this->whenLoaded('unit', fn () => [
                'id' => $this->unit->id,
                'code' => $this->unit->unit_code,
                'street' => $this->unit->relationLoaded('street') ? $this->unit->street?->name : null,
            ]),
            'nationalIdMasked' => $this->maskedNin(),
            'declarations' => $this->declarations,
            'photoUrl' => $this->profile_photo_path ? url("/api/v1/admin/access-requests/{$this->id}/files/photo") : null,
            'status' => $this->status,
            'decisionReason' => $this->decision_reason,
            'reviewedBy' => $this->whenLoaded('reviewer', fn () => $this->reviewer?->name),
            'reviewedAt' => $this->reviewed_at?->toIso8601String(),
            'createdAt' => $this->created_at?->toIso8601String(),
        ];
    }
}
