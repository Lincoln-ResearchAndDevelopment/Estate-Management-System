<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Unit */
class UnitResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'code' => $this->unit_code,
            'unitType' => $this->unit_type,
            'rooms' => $this->rooms,
            'occupancyStatus' => $this->occupancy_status,
            'sector' => $this->whenLoaded('sector', fn () => ['id' => $this->sector->id, 'name' => $this->sector->name]),
            'street' => $this->whenLoaded('street', fn () => ['id' => $this->street->id, 'name' => $this->street->name]),
            'lat' => $this->lat,
            'lng' => $this->lng,
        ];
    }
}
