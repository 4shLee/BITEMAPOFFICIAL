<?php

namespace Database\Seeders;

use App\Models\Barangay;
use Illuminate\Database\Seeder;

class BarangaySeeder extends Seeder
{
    public function run(): void
    {
        $barangays = [
            'Aplaya',
            'Balabag',
            'San Jose',
            'Binaton',
            'Cogon',
            'Colorado',
            'Dawis',
            'Dulangan',
            'Goma',
            'Igpit',
            'Kiagot',
            'Lungag',
            'Mahayahay',
            'Matti',
            'Kapatagan',
            'Ruparan',
            'San Agustin',
            'San Miguel',
            'San Roque',
            'Sinawilan',
            'Soong',
            'Tiguman',
            'Tres De Mayo',
            'Zone 1',
            'Zone 2',
            'Zone 3',
        ];

        foreach ($barangays as $barangay) {
            Barangay::updateOrCreate(['name' => $barangay]);
        }
    }
}
