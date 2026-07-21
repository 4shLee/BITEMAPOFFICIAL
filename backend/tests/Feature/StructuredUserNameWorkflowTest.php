<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StructuredUserNameWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_account_request_accepts_required_names_without_middle_name_or_suffix(): void
    {
        $response = $this->postJson('/api/auth/signup', [
            'first_name' => '  Ana   Marie  ',
            'last_name' => '  Cruz  ',
            'email' => 'ana.cruz@example.test',
            'password' => 'password123',
            'role' => 'doctor',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.name', 'Ana Marie Cruz')
            ->assertJsonPath('user.full_name', 'Ana Marie Cruz')
            ->assertJsonPath('user.first_name', 'Ana Marie')
            ->assertJsonPath('user.middle_name', null)
            ->assertJsonPath('user.last_name', 'Cruz')
            ->assertJsonPath('user.suffix', null)
            ->assertJsonPath('user.approval_status', 'pending');

        $this->assertDatabaseHas('users', [
            'email' => 'ana.cruz@example.test',
            'name' => 'Ana Marie Cruz',
            'first_name' => 'Ana Marie',
            'middle_name' => null,
            'last_name' => 'Cruz',
            'suffix' => null,
        ]);
    }

    public function test_structured_name_with_middle_name_and_suffix_survives_normal_approval(): void
    {
        $request = $this->postJson('/api/auth/signup', [
            'first_name' => 'Juan',
            'middle_name' => 'Dela',
            'last_name' => 'Santos',
            'suffix' => 'III',
            'email' => 'juan.santos@example.test',
            'password' => 'password123',
            'role' => 'nurse_vaccinator',
        ])->assertCreated();

        $requestedUser = User::findOrFail($request->json('user.id'));
        Sanctum::actingAs(User::factory()->create([
            'role' => 'clinic_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));

        $this->putJson('/api/users/'.$requestedUser->id.'/approve', [
            'role' => 'nurse_vaccinator',
        ])->assertOk()
            ->assertJsonPath('data.full_name', 'Juan Dela Santos III')
            ->assertJsonPath('data.approval_status', 'approved')
            ->assertJsonPath('data.status', 'Active');

        $this->assertTrue($requestedUser->fresh()->is_active);
        $this->assertSame('approved', $requestedUser->fresh()->approval_status);
    }

    public function test_legacy_full_name_requests_and_existing_users_remain_compatible(): void
    {
        $legacyRequest = $this->postJson('/api/auth/signup', [
            'fullName' => '  Legacy   Requester  ',
            'email' => 'legacy.requester@example.test',
            'password' => 'password123',
            'role' => 'doctor',
        ])->assertCreated();

        $legacyRequest->assertJsonPath('user.full_name', 'Legacy Requester')
            ->assertJsonPath('user.first_name', null)
            ->assertJsonPath('user.last_name', null);

        $legacyUser = User::factory()->create([
            'name' => 'Existing Legacy User',
            'first_name' => null,
            'middle_name' => null,
            'last_name' => null,
            'suffix' => null,
            'role' => 'doctor',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        Sanctum::actingAs(User::factory()->create([
            'role' => 'clinic_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]));

        $this->getJson('/api/users')
            ->assertOk()
            ->assertJsonFragment([
                'id' => $legacyUser->id,
                'name' => 'Existing Legacy User',
                'full_name' => 'Existing Legacy User',
                'first_name' => null,
                'last_name' => null,
            ]);
    }
}
