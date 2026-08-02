<?php

namespace Tests\Feature;

use App\Models\Barangay;
use App\Support\DigosBarangayCoordinates;
use Database\Seeders\BarangaySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DigosBarangayCoordinateIntegrityTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_supported_barangay_has_one_unique_validated_coordinate_inside_approved_bounds(): void
    {
        $points = DigosBarangayCoordinates::POINTS;

        $this->assertCount(26, $points);
        $this->assertCount(26, array_unique(array_column($points, 'psgc_code')));

        $coordinateKeys = [];
        foreach ($points as $name => $point) {
            $this->assertNotSame('', trim($name));
            $this->assertGreaterThanOrEqual(DigosBarangayCoordinates::BOUNDS['south'], $point['lat']);
            $this->assertLessThanOrEqual(DigosBarangayCoordinates::BOUNDS['north'], $point['lat']);
            $this->assertGreaterThanOrEqual(DigosBarangayCoordinates::BOUNDS['west'], $point['lng']);
            $this->assertLessThanOrEqual(DigosBarangayCoordinates::BOUNDS['east'], $point['lng']);

            $coordinateKeys[] = sprintf('%.8F,%.8F', $point['lat'], $point['lng']);
        }

        $this->assertCount(26, array_unique($coordinateKeys), 'Barangay representative points must be unique.');
    }

    public function test_barangay_seeder_keeps_database_and_fallback_coordinates_synchronized(): void
    {
        $this->seed(BarangaySeeder::class);

        $barangays = Barangay::query()->orderBy('name')->get()->keyBy('name');
        $this->assertCount(26, $barangays);
        $this->assertSame(26, Barangay::query()->distinct()->count('name'));

        foreach (DigosBarangayCoordinates::POINTS as $name => $point) {
            $barangay = $barangays->get($name);
            $this->assertNotNull($barangay, "Missing supported barangay: {$name}");
            $this->assertEqualsWithDelta($point['lat'], (float) $barangay->latitude, 0.00000001);
            $this->assertEqualsWithDelta($point['lng'], (float) $barangay->longitude, 0.00000001);
        }
    }

    /**
     * @dataProvider knownBarangayProvider
     */
    public function test_known_barangays_resolve_to_validated_positions(
        string $name,
        float $latitude,
        float $longitude
    ): void {
        $point = DigosBarangayCoordinates::forName($name);

        $this->assertNotNull($point);
        $this->assertEqualsWithDelta($latitude, $point['lat'], 0.00000001);
        $this->assertEqualsWithDelta($longitude, $point['lng'], 0.00000001);
    }

    public static function knownBarangayProvider(): array
    {
        return [
            'Cogon' => ['Cogon', 6.75742356, 125.37724579],
            'Aplaya' => ['Aplaya', 6.74164834, 125.37245251],
            'Dawis' => ['Dawis', 6.73009357, 125.36827608],
            'Sinawilan' => ['Sinawilan', 6.77581148, 125.37787301],
            'Zone 1' => ['Zone 1', 6.75787339, 125.35641175],
            'Zone 2' => ['Zone 2', 6.75207111, 125.35295619],
            'Zone 3' => ['Zone 3', 6.74419295, 125.35539780],
        ];
    }
}
