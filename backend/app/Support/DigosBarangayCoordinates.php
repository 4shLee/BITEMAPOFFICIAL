<?php

namespace App\Support;

final class DigosBarangayCoordinates
{
    public const SOURCE = 'NAMRIA administrative barangay boundaries (valid 2023-11-06), matched to PSA PSGC codes';

    public const BOUNDS = [
        'south' => 6.7215,
        'west' => 125.2525,
        'north' => 6.9872,
        'east' => 125.3932,
    ];

    public const CENTER = ['lat' => 6.85435, 'lng' => 125.32285];

    /**
     * Interior representative points calculated from matched NAMRIA polygons.
     *
     * @var array<string, array{psgc_code: string, lat: float, lng: float}>
     */
    public const POINTS = [
        'Aplaya' => ['psgc_code' => '1102403001', 'lat' => 6.74164834, 'lng' => 125.37245251],
        'Balabag' => ['psgc_code' => '1102403002', 'lat' => 6.85685429, 'lng' => 125.26978155],
        'San Jose' => ['psgc_code' => '1102403003', 'lat' => 6.73125205, 'lng' => 125.35463070],
        'Binaton' => ['psgc_code' => '1102403004', 'lat' => 6.84838618, 'lng' => 125.33803610],
        'Cogon' => ['psgc_code' => '1102403005', 'lat' => 6.75742356, 'lng' => 125.37724579],
        'Colorado' => ['psgc_code' => '1102403006', 'lat' => 6.75506963, 'lng' => 125.29556990],
        'Dawis' => ['psgc_code' => '1102403007', 'lat' => 6.73009357, 'lng' => 125.36827608],
        'Dulangan' => ['psgc_code' => '1102403008', 'lat' => 6.83769091, 'lng' => 125.31446776],
        'Goma' => ['psgc_code' => '1102403009', 'lat' => 6.85286242, 'lng' => 125.29052371],
        'Igpit' => ['psgc_code' => '1102403010', 'lat' => 6.73338652, 'lng' => 125.31541972],
        'Kiagot' => ['psgc_code' => '1102403011', 'lat' => 6.78090818, 'lng' => 125.35800284],
        'Lungag' => ['psgc_code' => '1102403012', 'lat' => 6.79466699, 'lng' => 125.27767847],
        'Mahayahay' => ['psgc_code' => '1102403013', 'lat' => 6.79668215, 'lng' => 125.29340182],
        'Matti' => ['psgc_code' => '1102403014', 'lat' => 6.76590191, 'lng' => 125.30570925],
        'Kapatagan' => ['psgc_code' => '1102403019', 'lat' => 6.92605084, 'lng' => 125.31445063],
        'Ruparan' => ['psgc_code' => '1102403020', 'lat' => 6.79071808, 'lng' => 125.32848162],
        'San Agustin' => ['psgc_code' => '1102403021', 'lat' => 6.77762873, 'lng' => 125.31501883],
        'San Miguel' => ['psgc_code' => '1102403022', 'lat' => 6.73901160, 'lng' => 125.34085046],
        'San Roque' => ['psgc_code' => '1102403023', 'lat' => 6.77930377, 'lng' => 125.28642543],
        'Sinawilan' => ['psgc_code' => '1102403024', 'lat' => 6.77581148, 'lng' => 125.37787301],
        'Soong' => ['psgc_code' => '1102403025', 'lat' => 6.81067777, 'lng' => 125.35310403],
        'Tiguman' => ['psgc_code' => '1102403026', 'lat' => 6.75099690, 'lng' => 125.32413033],
        'Tres De Mayo' => ['psgc_code' => '1102403027', 'lat' => 6.76795080, 'lng' => 125.33903558],
        'Zone 1' => ['psgc_code' => '1102403028', 'lat' => 6.75787339, 'lng' => 125.35641175],
        'Zone 2' => ['psgc_code' => '1102403029', 'lat' => 6.75207111, 'lng' => 125.35295619],
        'Zone 3' => ['psgc_code' => '1102403030', 'lat' => 6.74419295, 'lng' => 125.35539780],
    ];

    /**
     * @return array{lat: float, lng: float}|null
     */
    public static function forName(?string $name): ?array
    {
        if ($name === null || ! isset(self::POINTS[$name])) {
            return null;
        }

        return [
            'lat' => self::POINTS[$name]['lat'],
            'lng' => self::POINTS[$name]['lng'],
        ];
    }
}
