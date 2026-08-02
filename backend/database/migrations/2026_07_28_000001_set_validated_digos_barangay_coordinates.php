<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const COORDINATES = [
        'Aplaya' => [6.74164834, 125.37245251],
        'Balabag' => [6.85685429, 125.26978155],
        'San Jose' => [6.73125205, 125.35463070],
        'Binaton' => [6.84838618, 125.33803610],
        'Cogon' => [6.75742356, 125.37724579],
        'Colorado' => [6.75506963, 125.29556990],
        'Dawis' => [6.73009357, 125.36827608],
        'Dulangan' => [6.83769091, 125.31446776],
        'Goma' => [6.85286242, 125.29052371],
        'Igpit' => [6.73338652, 125.31541972],
        'Kiagot' => [6.78090818, 125.35800284],
        'Lungag' => [6.79466699, 125.27767847],
        'Mahayahay' => [6.79668215, 125.29340182],
        'Matti' => [6.76590191, 125.30570925],
        'Kapatagan' => [6.92605084, 125.31445063],
        'Ruparan' => [6.79071808, 125.32848162],
        'San Agustin' => [6.77762873, 125.31501883],
        'San Miguel' => [6.73901160, 125.34085046],
        'San Roque' => [6.77930377, 125.28642543],
        'Sinawilan' => [6.77581148, 125.37787301],
        'Soong' => [6.81067777, 125.35310403],
        'Tiguman' => [6.75099690, 125.32413033],
        'Tres De Mayo' => [6.76795080, 125.33903558],
        'Zone 1' => [6.75787339, 125.35641175],
        'Zone 2' => [6.75207111, 125.35295619],
        'Zone 3' => [6.74419295, 125.35539780],
    ];

    public function up(): void
    {
        foreach (self::COORDINATES as $name => [$latitude, $longitude]) {
            DB::table('barangays')
                ->where('name', $name)
                ->update([
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'updated_at' => now(),
                ]);
        }
    }

    public function down(): void
    {
        DB::table('barangays')
            ->whereIn('name', array_keys(self::COORDINATES))
            ->update([
                'latitude' => null,
                'longitude' => null,
                'updated_at' => now(),
            ]);
    }
};
