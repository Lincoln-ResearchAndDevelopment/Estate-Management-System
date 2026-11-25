<?php

namespace Database\Factories;

use App\Models\Sector;
use App\Models\Street;
use App\Models\Unit;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Unit> */
class UnitFactory extends Factory
{
    protected $model = Unit::class;

    public function definition(): array
    {
        return [
            'unit_code' => strtoupper(fake()->unique()->bothify('?-###')),
            'sector_id' => fn () => Sector::factory(),
            'street_id' => fn (array $attrs) => Street::factory()->state(['sector_id' => $attrs['sector_id']]),
            'unit_type' => 'Bungalow',
            'rooms' => 3,
            'occupancy_status' => 'vacant',
        ];
    }
}
