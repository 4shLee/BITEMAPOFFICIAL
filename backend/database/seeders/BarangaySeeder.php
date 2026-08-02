<?php

namespace Database\Seeders;

use App\Models\Barangay;
use App\Support\DigosBarangayCoordinates;
use Illuminate\Database\Seeder;

class BarangaySeeder extends Seeder
{
    public function run(): void
    {
        foreach (DigosBarangayCoordinates::POINTS as $name => $point) {
            Barangay::updateOrCreate(
                ['name' => $name],
                ['latitude' => $point['lat'], 'longitude' => $point['lng']]
            );
        }
    }
}
