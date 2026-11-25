<?php

namespace Database\Factories;

use App\Models\Sector;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Sector> */
class SectorFactory extends Factory
{
    protected $model = Sector::class;

    public function definition(): array
    {
        $letter = strtoupper(fake()->unique()->bothify('??#'));

        return ['name' => "Sector {$letter}", 'code' => "SEC-{$letter}"];
    }
}
