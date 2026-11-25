<?php

namespace Database\Factories;

use App\Models\Sector;
use App\Models\Street;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Street> */
class StreetFactory extends Factory
{
    protected $model = Street::class;

    public function definition(): array
    {
        return [
            'sector_id' => Sector::factory(),
            'name' => fake()->unique()->streetName(),
        ];
    }
}
