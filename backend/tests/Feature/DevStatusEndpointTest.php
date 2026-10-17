<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\DefaultAdminAccount;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DevStatusEndpointTest extends TestCase
{
    use RefreshDatabase;

    public function test_dev_status_still_provides_diagnostics_in_testing_environment(): void
    {
        $this->getJson('/api/dev/status')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('database', 'connected')
            ->assertJsonStructure(['counts' => ['users', 'barangays', 'patients', 'incidents', 'inventory'], 'admin']);
    }

    public function test_dev_status_still_provides_diagnostics_in_local_environment(): void
    {
        $this->app['env'] = 'local';

        $this->getJson('/api/dev/status')->assertOk()->assertJsonPath('success', true);
    }

    public function test_dev_status_is_hidden_in_production_and_leaks_nothing(): void
    {
        User::factory()->create(['email' => DefaultAdminAccount::EMAIL]);
        $this->app['env'] = 'production';

        $response = $this->getJson('/api/dev/status');

        $response->assertNotFound()->assertExactJson(['message' => 'Not Found']);
        $body = $response->getContent();
        foreach (['counts', 'admin', 'password_matches_seed', DefaultAdminAccount::EMAIL, 'database'] as $leak) {
            $this->assertStringNotContainsString($leak, $body);
        }
    }

    public function test_dev_status_is_hidden_in_any_non_local_environment(): void
    {
        $this->app['env'] = 'staging';

        $this->getJson('/api/dev/status')->assertNotFound();
    }

    public function test_dev_status_never_queries_the_database_in_production(): void
    {
        $this->app['env'] = 'production';
        DB::enableQueryLog();

        $response = $this->getJson('/api/dev/status');

        // No SQL means no database exception text can ever reach the response.
        $this->assertSame([], DB::getQueryLog());
        $response->assertNotFound()->assertExactJson(['message' => 'Not Found']);
    }
}
