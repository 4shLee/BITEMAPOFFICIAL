<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Barangay;
use App\Models\Patient;
use App\Models\Setting;
use App\Models\User;
use App\Services\GoogleOAuthService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory as HttpClientFactory;
use Illuminate\Http\Client\Request as HttpClientRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class GoogleAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    private const PRIMARY_KID = 'test-google-key-1';

    private const ROTATED_KID = 'new-rotated-in-kid';

    private const PRIMARY_PRIVATE_KEY_PEM = <<<'PEM'
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC6zUH2W6DhV3SU
it1Ir94I7ru48J5iLKUWdKtbeKP8jR/Q2Xc0G2bYPShJu46LAvCb7Ww+dBnXDshZ
BoRtBtsQstnmY1ebzM2HWubww1dWAPHFx3HPzzYcfoSJ+LcgS23a/GqcpmuFGqnH
1OjZbdDGo00GdrlvZbZkFZoYgUf84cl2srtnHm9YUyae3a+sg8phdopXA5Z3aw8C
wQshT2AuNHjSUBmRRNSWZvWmnyTeyVsn3eGlvdBm0GjHOQ5IL4Y7j+EednPRHp/e
xSfQEe19Uxx1lxoLUa2oevWIJKwIwBamoRbhnlxMR+sY8SRRJY4uBk5VIYEgTzyJ
2pwJKPpbAgMBAAECggEAANMMABfgC21ROhaY9KQ+XMRYVyE4uRseQdxYG2kVgWuF
aGy0p4KGN9MDbPdDPrTjYlahSdGUbhN3jG0IedA97qTvHY8GXwhsDBf0dFkZlKZb
L7kwYT4Y3c62Dmq/gbAOnA700OEXc3ZQ0ONqvEX+kPWMdmXq0IMLBN6sJs+IymnV
NpjGklAMDf1MK1oM1B3KZvDd/WHNcPnE/nMiaf1HQ10Jv8fzQgGTnKRmxBnENhgy
WFB+ao0EDyolkkt93np8lFEWudhkS09xYmCZnGfMOLaoyuNZLwm63e8IkifJX+dg
SmdoyaMBsCbDW8yWb9A/BoEIBFvajTpStRPYK4QQgQKBgQDft988zrXtYFzgN96T
v9Gq1x5zEs9D9Xwripcr3AOL2p1Ywx9mIovtjOxzl1NFHNeeoFeUuO/aTif1qjrI
Honc+hX5oW6bDqXc6hR3+7a1wUsyMB0dGjejRs+2f4tFWR/BC2mf3nQideeuv0dT
3mgiEc21AizmUbAKY/U1LGREZQKBgQDVwbINSqb1AAZWtnY8DLFBeuw8w9fzc+zf
dmp4JfobqAWHGJRpQiMLeSBXrMhUcT4lvr+GsJNG0lkXfQFlpPmPFLKU0sghvPw7
WmxW+Ty0jv704n4CdIOoF4tYID+sIm8kGU2yAFnwO9T1c9sJAygePNoLSywJgmjJ
Aq8w9eN3vwKBgGDAjZwnrcheT2xs3Sa643tmE3Yi4V57sVrHUj+WpDX8suXrZQ3v
zOJMewo2nL2cDqg8ogPgw2J/QIrfNxLLGkZmJdDS/xmyCQt0dKu7QbZzRQkMg9rN
Nti3TCeaG2o/dBsxy1lnhIROx4bslHVyD0kEuBkbOr3VADROLIL1ktt9AoGAbphM
+zuIrnJY1TyKZ/9ZJrvmxnm9naR5BhVKeOeNRAnm8kLxZpRldWYyKaqn66i7suPC
THnHeXkTx2dR9bkptbHLw9xa17nj9wGN1GIX2oOxvhoBgFuwUqP74Jiu2Ozn/BFr
dZFg9z69rFFJHpyXgS2S0w0Nt83VUUsmQXq3OhkCgYEAxYg+9DLS9dRrBhwZczDn
frcgBfmGSIN7Yuz039DtuyM2GmIwETkO4J02hWfUGLQgsT0vrwVmi2J2KRnoaacw
Cl92wNVkpe/kfxsaESfzCOYRmbGlq0Iey7Ea7giWx5K9plsUTj/gN9UNVrc1mdAI
Zen6d+3blRREWwO+4ix+xH8=
-----END PRIVATE KEY-----
PEM;

    private const PRIMARY_JWK_N = 'us1B9lug4Vd0lIrdSK_eCO67uPCeYiylFnSrW3ij_I0f0Nl3NBtm2D0oSbuOiwLwm-1sPnQZ1w7IWQaEbQbbELLZ5mNXm8zNh1rm8MNXVgDxxcdxz882HH6Eifi3IEtt2vxqnKZrhRqpx9To2W3QxqNNBna5b2W2ZBWaGIFH_OHJdrK7Zx5vWFMmnt2vrIPKYXaKVwOWd2sPAsELIU9gLjR40lAZkUTUlmb1pp8k3slbJ93hpb3QZtBoxzkOSC-GO4_hHnZz0R6f3sUn0BHtfVMcdZcaC1GtqHr1iCSsCMAWpqEW4Z5cTEfrGPEkUSWOLgZOVSGBIE88idqcCSj6Ww';

    private const UNTRUSTED_PRIVATE_KEY_PEM = <<<'PEM'
-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDY0iRWPI4cmJ+C
EQtihDJsZijerhny7kzhpyXOSE2KsoWQbPd8FgGjUNpyInXfU7xQ1RnqUkSlHdg3
DU2epybBzN/ljsafiQechIHmfwaGzooUd1oaaEfUjrrsN2FIGl2ilcMCrlFNy0X/
LNdGZBI60ZKWv8zTQDjWP8m6ABN8WWbWE4zer/Qq/hQYNCRt7bQmDse4vC6r5uus
IQGh30irgruWNjlEG6BBWbr3GEANojPeDfUNOg/eMRAw18GQR+Xo5LX+akMSjb7V
+GY0CFJn2d5x7wLC4pzYWE0Euk9yL7NLiwySgi/RvUPeY1NL6okoWNRCeguTPc+C
HjdYkAd1AgMBAAECggEAa3exKgtGtxbRDPNszK5Qndj/DeyGkRobgkdKXlYJFSOK
Pz07Z8YylqPXOnYpLYIAF6Kgfzu6qYrC5fqSi/42oB1vpoUfnuiZHLOy/S/d6MiL
uTw1LVydqdX7AWUrs0TaP2FysKv9QY1tCt9LbqjgPkYtHcpAeD7fTRZ94tLx1ZJC
hawpe0odYQnJVdI7Q4qj0p4EwXd+Uu2jXqu27yyF641ofnWtjAwaSjtkj7daJLZJ
E2NzL4AoGkgzNeMmBNtZzuaO2synQgJw3AbBinRBVdvNVprgIPf64KfRsFnddHq8
jjRY66bCYDQUSA+fHkgt60nZcVQh18dxCkNr5PP8+wKBgQD6H3A5f2pD0qPOoubi
tROZk5Am5DMA8lsocX3qMAGJun4Gm9XXBwZrXB3stRUhWZuv7W8pkfjFp4954s5n
c7N8ItN5fFLXD8OvfQLLgyhhNWGTXufsaYIxT6Vod9tDdYi2GVBo+nbQtHm9F8pP
4xVWcDH8RNFCMcASbs2HTWeKqwKBgQDd6mH3y9PG0gBSyba+Ao4c8T+M4jsepS+V
wPFwX7+Pqci4jph66HbUM6W6GPwaY04+y5Zuvzy00bOmd8luOUVx7K5UKPJEUDrJ
KQXTnPkdkd4N3CeyXHMINanw9yAa+khWwGXTVSdWN5AR759kOjf+6RAEy+QEsH3C
e+1Hx6q2XwKBgFuYp8BmqMOtn89MWMEtDsBvCZs0dnkiR7/H0BSy/90wLna9GtJk
ADXQxiSpK9PKvPjwOoU+r5uygRhhtrSr6k7LciZLIQsg+siJPzzIC0GOCu2tE8G/
4a2tPSXEvsc1g5ssKgZHsrs7XFmjHLOktWuyKpv3l6pmDbCyYxHphsGBAoGAcMLJ
NxWeLbfFrEuNDO3VcoVvilHmQoMjM9APns84UnKuaIEkn8eBogAAZRiO+YWeW7At
Z2bLHQI1bBAQDW8Sh3oBdwg7WlT+Gfs7V7S6rLjTAW3tyebKGNDT4npgGPU2TsaC
tyjczSV8knCVKGOg0mlw108XNP7NWEaKYl/lsbcCgYAgetFfYTczuF5p+dHc8yym
YcoZkOWBsoCMgfFCS7zc8UstULKwMkvyGucaxGu4rRwm6hFAosNBb5vcPMaiXeCW
7t7Bc/wEu1aYsiGATwCPUryqdnLGz8E5oopIurd2+8a3y2xo2rwducI6wlECukOV
10BeTzCi/JwTDRTxBMFvlQ==
-----END PRIVATE KEY-----
PEM;

    private const ROTATED_JWK_N = '2NIkVjyOHJifghELYoQybGYo3q4Z8u5M4aclzkhNirKFkGz3fBYBo1DaciJ131O8UNUZ6lJEpR3YNw1Nnqcmwczf5Y7Gn4kHnISB5n8Ghs6KFHdaGmhH1I667DdhSBpdopXDAq5RTctF_yzXRmQSOtGSlr_M00A41j_JugATfFlm1hOM3q_0Kv4UGDQkbe20Jg7HuLwuq-brrCEBod9Iq4K7ljY5RBugQVm69xhADaIz3g31DToP3jEQMNfBkEfl6OS1_mpDEo2-1fhmNAhSZ9nece8CwuKc2FhNBLpPci-zS4sMkoIv0b1D3mNTS-qJKFjUQnoLkz3Pgh43WJAHdQ';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.key' => 'base64:49Tu9TFEezqKOKcymfWXaexNq8gfwpUSdwWFYp6FYQE=',
            'services.google.client_id' => 'bitemap-google-client-id.apps.googleusercontent.com',
            'services.google.client_secret' => 'bitemap-google-client-secret',
            'services.google.redirect' => 'http://localhost:8000/api/auth/google/callback',
            'services.google.frontend_url' => 'http://localhost:5173',
            'cors.allowed_origins' => ['http://localhost:5173', 'http://127.0.0.1:5173'],
        ]);
    }

    public function test_existing_email_password_login_still_works(): void
    {
        $user = User::factory()->create([
            'name' => 'Maria Santos',
            'email' => 'maria@gmail.com',
            'password' => 'StrongPass123!',
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $response = $this->postJson('/api/auth/signin', [
            'email' => 'maria@gmail.com',
            'password' => 'StrongPass123!',
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'nurse_vaccinator');

        $this->assertNotEmpty($response->json('accessToken'));
    }

    public function test_existing_active_bitemap_user_can_authenticate_with_google_pkce_and_receive_session(): void
    {
        Http::preventStrayRequests();

        $user = User::factory()->create([
            'name' => 'Maria Santos',
            'first_name' => 'Maria',
            'last_name' => 'Santos',
            'email' => 'maria@gmail.com',
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        ['state' => $state, 'query' => $redirectQuery] = $this->requestGoogleRedirectDetails();
        $this->assertSame('S256', $redirectQuery['code_challenge_method'] ?? null);
        $this->assertNotEmpty($redirectQuery['code_challenge'] ?? null);

        // Browser GET callback from Google forwards code/state to SPA /login without exposing tokens in URL
        $browserRedirect = $this->get('/api/auth/google/callback?code=google-auth-code-1&state='.urlencode($state));
        $browserRedirect->assertRedirect(
            'http://localhost:5173/login?code=google-auth-code-1&state='.rawurlencode($state)
        );

        $this->fakeGoogleOAuthSuccess('maria@gmail.com', 'google-sub-maria-1');

        $callback = $this->postJson('/api/auth/google/callback', [
            'code' => 'google-auth-code-1',
            'state' => $state,
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.email', 'maria@gmail.com')
            ->assertJsonPath('user.role', 'nurse_vaccinator');

        Http::assertSent(function (HttpClientRequest $request) use ($redirectQuery): bool {
            if ($request->url() !== GoogleOAuthService::TOKEN_ENDPOINT) {
                return false;
            }

            $verifier = (string) ($request['code_verifier'] ?? '');
            $expectedChallenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

            return $verifier !== '' && hash_equals((string) $redirectQuery['code_challenge'], $expectedChallenge);
        });

        $token = (string) $callback->json('accessToken');
        $this->assertNotEmpty($token);
        $this->assertNotEmpty($callback->json('expiresAt'));
        $this->assertSame(30, $callback->json('sessionTimeoutMinutes'));
        $this->assertNotNull($user->fresh()->last_login_at);
        $this->assertSame(1, PersonalAccessToken::where('tokenable_id', $user->id)->count());

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'nurse_vaccinator');
    }

    public function test_unknown_google_account_is_rejected_without_auto_registration(): void
    {
        Http::preventStrayRequests();

        $state = $this->requestGoogleRedirectState();
        $this->fakeGoogleOAuthSuccess('unknown@gmail.com', 'google-sub-unknown');

        $initialUserCount = User::count();

        $this->postJson('/api/auth/google/callback', [
            'code' => 'google-auth-code-unknown',
            'state' => $state,
        ])->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath(
                'error',
                'Your Google account is not registered as a BITEMAP staff account. Please contact your administrator.'
            );

        $this->assertSame($initialUserCount, User::count());
        $this->assertSame(0, PersonalAccessToken::count());
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'Failed login',
            'module' => 'Authentication',
            'user_id' => null,
        ]);
    }

    public function test_inactive_pending_and_rejected_bitemap_accounts_are_rejected_for_google_login(): void
    {
        Http::preventStrayRequests();

        $inactive = User::factory()->create([
            'email' => 'inactive.nurse@gmail.com',
            'role' => 'nurse_vaccinator',
            'is_active' => false,
            'approval_status' => 'approved',
        ]);

        $pending = User::factory()->create([
            'email' => 'pending.doctor@gmail.com',
            'role' => 'doctor',
            'is_active' => false,
            'approval_status' => 'pending',
        ]);

        $rejected = User::factory()->create([
            'email' => 'rejected.doctor@gmail.com',
            'role' => 'doctor',
            'is_active' => false,
            'approval_status' => 'rejected',
        ]);

        $cases = [
            [$inactive, 'This account is inactive.'],
            [$pending, 'Your account request is still waiting for admin approval.'],
            [$rejected, 'Your account request was rejected. Please contact the system administrator.'],
        ];

        foreach ($cases as [$account, $expectedError]) {
            $state = $this->requestGoogleRedirectState();
            $this->fakeGoogleOAuthSuccess($account->email, 'sub-'.$account->id);

            $this->postJson('/api/auth/google/callback', [
                'code' => 'code-'.$account->id,
                'state' => $state,
            ])->assertStatus(403)
                ->assertJsonPath('success', false)
                ->assertJsonPath('error', $expectedError);

            $this->assertDatabaseHas('audit_logs', [
                'action' => 'Failed login',
                'module' => 'Authentication',
                'user_id' => $account->id,
            ]);
        }

        $this->assertSame(0, PersonalAccessToken::count());
    }

    public function test_google_and_frontend_cannot_change_bitemap_role_or_clinic_settings(): void
    {
        Http::preventStrayRequests();

        Setting::updateOrCreate(['setting_key' => 'clinic_name'], ['setting_value' => 'Digos City Partner ABC']);

        $nurse = User::factory()->create([
            'name' => 'Maria Santos',
            'email' => 'maria@gmail.com',
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $state = $this->requestGoogleRedirectState();
        $this->fakeGoogleOAuthSuccess('maria@gmail.com', 'sub-maria', [
            'role' => 'system_admin',
            'clinic_id' => 999,
            'clinic_name' => 'Tampered Clinic',
            'permissions' => ['*'],
        ]);

        $response = $this->postJson('/api/auth/google/callback', [
            'code' => 'google-code-maria',
            'state' => $state,
            'role' => 'system_admin',
            'clinic_id' => 999,
            'clinic' => 'Tampered Clinic',
            'permissions' => ['users.manage', 'settings.configure'],
        ])->assertOk()
            ->assertJsonPath('user.role', 'nurse_vaccinator');

        $this->assertSame('nurse_vaccinator', $nurse->fresh()->role);
        $this->assertSame(
            'Digos City Partner ABC',
            Setting::where('setting_key', 'clinic_name')->value('setting_value')
        );

        $token = (string) $response->json('accessToken');
        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/users')
            ->assertStatus(403);
    }

    public function test_frontend_cannot_impersonate_another_user_by_submitting_arbitrary_email(): void
    {
        Http::preventStrayRequests();

        $admin = User::factory()->create([
            'name' => 'Chief System Admin',
            'email' => 'admin@bitemap.local',
            'role' => 'system_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $nurse = User::factory()->create([
            'name' => 'Maria Santos',
            'email' => 'maria@gmail.com',
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        // 1. Submitting only an email without Google OAuth code/state fails validation
        $this->postJson('/api/auth/google/callback', [
            'email' => $admin->email,
        ])->assertStatus(422);

        // 2. Submitting an attacker-supplied email alongside Maria's valid Google callback authenticates ONLY Maria
        $state = $this->requestGoogleRedirectState();
        $this->fakeGoogleOAuthSuccess('maria@gmail.com', 'sub-maria');

        $response = $this->postJson('/api/auth/google/callback', [
            'code' => 'code-maria',
            'state' => $state,
            'email' => $admin->email,
        ])->assertOk()
            ->assertJsonPath('user.id', $nurse->id)
            ->assertJsonPath('user.email', 'maria@gmail.com')
            ->assertJsonPath('user.role', 'nurse_vaccinator');

        $this->assertNotSame($admin->id, $response->json('user.id'));
    }

    public function test_google_id_token_signature_verification_rejects_untrusted_tampered_and_invalid_algorithms(): void
    {
        Http::preventStrayRequests();

        $user = User::factory()->create([
            'email' => 'maria@gmail.com',
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $now = now()->getTimestamp();
        $claims = [
            'iss' => 'https://accounts.google.com',
            'aud' => config('services.google.client_id'),
            'sub' => 'sub-maria',
            'email' => $user->email,
            'email_verified' => true,
            'iat' => $now,
            'exp' => $now + 300,
        ];

        // 1. ID token signed by an untrusted private key (does not match published Google JWKS)
        $state1 = $this->requestGoogleRedirectState();
        $this->resetHttpFake();
        Http::fake([
            GoogleOAuthService::TOKEN_ENDPOINT => Http::response([
                'access_token' => 'google-access-token',
                'id_token' => $this->makeSignedJwt($claims, self::PRIMARY_KID, self::UNTRUSTED_PRIVATE_KEY_PEM),
            ], 200),
            GoogleOAuthService::JWKS_ENDPOINT => Http::response([
                'keys' => [
                    ['kid' => self::PRIMARY_KID, 'kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'n' => self::PRIMARY_JWK_N, 'e' => 'AQAB'],
                ],
            ], 200),
        ]);
        $this->postJson('/api/auth/google/callback', [
            'code' => 'untrusted-key-code',
            'state' => $state1,
        ])->assertStatus(401)
            ->assertJsonPath('error', 'Invalid Google ID token signature.');

        // 2. Tampered JWT payload after valid signature
        $validJwt = $this->makeSignedJwt($claims, self::PRIMARY_KID, self::PRIMARY_PRIVATE_KEY_PEM);
        [$hdr, , $sig] = explode('.', $validJwt);
        $tamperedClaims = array_merge($claims, ['email' => 'admin@bitemap.local']);
        $tamperedPayload = $this->base64UrlEncode((string) json_encode($tamperedClaims, JSON_THROW_ON_ERROR));
        $tamperedJwt = $hdr.'.'.$tamperedPayload.'.'.$sig;

        $state2 = $this->requestGoogleRedirectState();
        $this->resetHttpFake();
        Http::fake([
            GoogleOAuthService::TOKEN_ENDPOINT => Http::response([
                'access_token' => 'google-access-token',
                'id_token' => $tamperedJwt,
            ], 200),
            GoogleOAuthService::JWKS_ENDPOINT => Http::response([
                'keys' => [
                    ['kid' => self::PRIMARY_KID, 'kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'n' => self::PRIMARY_JWK_N, 'e' => 'AQAB'],
                ],
            ], 200),
        ]);
        $this->postJson('/api/auth/google/callback', [
            'code' => 'tampered-payload-code',
            'state' => $state2,
        ])->assertStatus(401)
            ->assertJsonPath('error', 'Invalid Google ID token signature.');

        // 3. Disallowed JWT algorithms ("none" and "HS256")
        foreach (['none', 'HS256'] as $index => $badAlg) {
            $stateAlg = $this->requestGoogleRedirectState();
            $badHeader = $this->base64UrlEncode((string) json_encode(['alg' => $badAlg, 'kid' => self::PRIMARY_KID], JSON_THROW_ON_ERROR));
            $badPayload = $this->base64UrlEncode((string) json_encode($claims, JSON_THROW_ON_ERROR));
            $badJwt = $badHeader.'.'.$badPayload.'.fake-sig';

            $this->resetHttpFake();
            Http::fake([
                GoogleOAuthService::TOKEN_ENDPOINT => Http::response([
                    'access_token' => 'google-access-token',
                    'id_token' => $badJwt,
                ], 200),
            ]);

            $this->postJson('/api/auth/google/callback', [
                'code' => 'bad-alg-code-'.$index,
                'state' => $stateAlg,
            ])->assertStatus(401)
                ->assertJsonPath('error', 'Unsupported Google ID token algorithm or missing key ID.');
        }

        // 4. Missing id_token in token endpoint response
        $stateMissingId = $this->requestGoogleRedirectState();
        $this->resetHttpFake();
        Http::fake([
            GoogleOAuthService::TOKEN_ENDPOINT => Http::response([
                'access_token' => 'google-access-token',
            ], 200),
        ]);
        $this->postJson('/api/auth/google/callback', [
            'code' => 'missing-id-token-code',
            'state' => $stateMissingId,
        ])->assertStatus(401)
            ->assertJsonPath('error', 'Google ID token is missing from authentication response.');

        $this->assertSame(0, PersonalAccessToken::count());
    }

    public function test_jwks_key_rotation_refreshes_signing_keys_automatically(): void
    {
        Http::preventStrayRequests();

        $user = User::factory()->create([
            'name' => 'Maria Santos',
            'email' => 'maria@gmail.com',
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $state = $this->requestGoogleRedirectState();

        // Seed stale JWKS cache containing only an old rotated-out key
        Cache::put(GoogleOAuthService::JWKS_CACHE_KEY, [
            ['kid' => 'old-rotated-out-kid', 'kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'n' => self::PRIMARY_JWK_N, 'e' => 'AQAB'],
        ], 3600);

        $now = now()->getTimestamp();
        $rotatedIdToken = $this->makeSignedJwt([
            'iss' => 'https://accounts.google.com',
            'aud' => config('services.google.client_id'),
            'sub' => 'sub-maria-rotated',
            'email' => $user->email,
            'email_verified' => true,
            'iat' => $now,
            'exp' => $now + 300,
        ], self::ROTATED_KID, self::UNTRUSTED_PRIVATE_KEY_PEM);

        $this->resetHttpFake();
        Http::fake([
            GoogleOAuthService::TOKEN_ENDPOINT => Http::response([
                'access_token' => 'google-access-token-rotated',
                'id_token' => $rotatedIdToken,
            ], 200),
            GoogleOAuthService::JWKS_ENDPOINT => Http::response([
                'keys' => [
                    ['kid' => self::ROTATED_KID, 'kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'n' => self::ROTATED_JWK_N, 'e' => 'AQAB'],
                ],
            ], 200),
            GoogleOAuthService::USERINFO_ENDPOINT => Http::response([
                'sub' => 'sub-maria-rotated',
                'email' => $user->email,
                'email_verified' => true,
            ], 200),
        ]);

        $this->postJson('/api/auth/google/callback', [
            'code' => 'rotated-key-code',
            'state' => $state,
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', $user->id);

        Http::assertSent(fn (HttpClientRequest $req): bool => $req->url() === GoogleOAuthService::JWKS_ENDPOINT);
    }

    public function test_oauth_state_is_bound_to_browser_user_agent_expires_and_code_cannot_be_reused(): void
    {
        Http::preventStrayRequests();

        $user = User::factory()->create([
            'email' => 'maria@gmail.com',
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        // 1. Cross-browser state/code injection: state issued for Browser-A fails from Browser-B
        Cache::flush();
        $redirectA = $this->withHeaders(['User-Agent' => 'Browser-A/1.0'])
            ->getJson('/api/auth/google/redirect')
            ->assertOk();
        $stateA = (string) $redirectA->json('state');

        $this->withHeaders(['User-Agent' => 'Browser-B/2.0'])
            ->postJson('/api/auth/google/callback', [
                'code' => 'injected-code',
                'state' => $stateA,
            ])->assertStatus(401)
            ->assertJsonPath('error', 'Invalid or expired Google authentication state. Please try signing in again.');

        // 2. State expires after 10 minutes
        Cache::flush();
        $redirectExp = $this->withHeaders(['User-Agent' => 'Browser-A/1.0'])
            ->getJson('/api/auth/google/redirect')
            ->assertOk();
        $stateExp = (string) $redirectExp->json('state');
        $this->travel(11)->minutes();

        $this->withHeaders(['User-Agent' => 'Browser-A/1.0'])
            ->postJson('/api/auth/google/callback', [
                'code' => 'expired-state-code',
                'state' => $stateExp,
            ])->assertStatus(401);

        // 3. Same authorization code cannot be reused even with a freshly minted state
        $this->travelBack();
        Cache::flush();
        $redirect1 = $this->withHeaders(['User-Agent' => 'Browser-A/1.0'])
            ->getJson('/api/auth/google/redirect')
            ->assertOk();
        $state1 = (string) $redirect1->json('state');
        $this->fakeGoogleOAuthSuccess($user->email, 'sub-maria');

        $this->withHeaders(['User-Agent' => 'Browser-A/1.0'])
            ->postJson('/api/auth/google/callback', [
                'code' => 'single-use-auth-code',
                'state' => $state1,
            ])->assertOk();

        $redirect2 = $this->withHeaders(['User-Agent' => 'Browser-A/1.0'])
            ->getJson('/api/auth/google/redirect')
            ->assertOk();
        $state2 = (string) $redirect2->json('state');

        $this->withHeaders(['User-Agent' => 'Browser-A/1.0'])
            ->postJson('/api/auth/google/callback', [
                'code' => 'single-use-auth-code',
                'state' => $state2,
            ])->assertStatus(401)
            ->assertJsonPath('error', 'Authorization code has already been used.');
    }

    public function test_open_redirect_attempts_and_spoofed_error_descriptions_are_blocked(): void
    {
        // 1. Query injection in GET /api/auth/google/callback strips arbitrary params & error_description
        $response = $this->get('/api/auth/google/callback?code=c1&state=s1&redirect=https://evil.example.com&next=//evil.example.com&error_description=Spoofed');
        $response->assertRedirect('http://localhost:5173/login?code=c1&state=s1');

        // 2. Invalid or unallowed frontend_url configs fall back to safe allowed origin
        foreach (['javascript:alert(1)', '//evil.example.com', 'https://evil.example.com'] as $unsafeOrigin) {
            config(['services.google.frontend_url' => $unsafeOrigin]);
            $fallbackRedirect = $this->get('/api/auth/google/callback?error=access_denied&error_description=Evil');
            $fallbackRedirect->assertRedirect('http://localhost:5173/login?error=access_denied');
        }
    }

    public function test_invalid_tampered_replayed_unverified_or_mismatched_google_auth_is_rejected(): void
    {
        Http::preventStrayRequests();

        $user = User::factory()->create([
            'email' => 'maria@gmail.com',
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        // 1. Tampered state signature
        $validState = $this->requestGoogleRedirectState();
        $this->postJson('/api/auth/google/callback', [
            'code' => 'code-1',
            'state' => $validState.'tampered',
        ])->assertStatus(401);

        // 2. Google token exchange failure
        $state2 = $this->requestGoogleRedirectState();
        $this->resetHttpFake();
        Http::fake([
            GoogleOAuthService::TOKEN_ENDPOINT => Http::response(['error' => 'invalid_grant'], 400),
        ]);
        $this->postJson('/api/auth/google/callback', [
            'code' => 'bad-code',
            'state' => $state2,
        ])->assertStatus(401);

        // 3. Reusing the already-consumed single-use state fails
        $this->postJson('/api/auth/google/callback', [
            'code' => 'bad-code',
            'state' => $state2,
        ])->assertStatus(401);

        // 4. Unverified Google email is rejected even if email matches an active user
        $state3 = $this->requestGoogleRedirectState();
        $now = now()->getTimestamp();
        $this->resetHttpFake();
        Http::fake([
            GoogleOAuthService::TOKEN_ENDPOINT => Http::response([
                'access_token' => 'google-access-token',
                'id_token' => $this->makeSignedJwt([
                    'iss' => 'https://accounts.google.com',
                    'aud' => config('services.google.client_id'),
                    'sub' => 'sub-maria',
                    'email' => $user->email,
                    'email_verified' => false,
                    'iat' => $now,
                    'exp' => $now + 300,
                ], self::PRIMARY_KID, self::PRIMARY_PRIVATE_KEY_PEM),
            ], 200),
            GoogleOAuthService::JWKS_ENDPOINT => Http::response([
                'keys' => [
                    ['kid' => self::PRIMARY_KID, 'kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'n' => self::PRIMARY_JWK_N, 'e' => 'AQAB'],
                ],
            ], 200),
            GoogleOAuthService::USERINFO_ENDPOINT => Http::response([
                'sub' => 'sub-maria',
                'email' => $user->email,
                'email_verified' => false,
            ], 200),
        ]);
        $this->postJson('/api/auth/google/callback', [
            'code' => 'unverified-email-code',
            'state' => $state3,
        ])->assertStatus(401)
            ->assertJsonPath('error', 'Your Google account email address is not verified.');

        // 5. ID token audience mismatch is rejected
        $state4 = $this->requestGoogleRedirectState();
        $this->resetHttpFake();
        Http::fake([
            GoogleOAuthService::TOKEN_ENDPOINT => Http::response([
                'access_token' => 'google-access-token',
                'id_token' => $this->makeSignedJwt([
                    'iss' => 'https://accounts.google.com',
                    'aud' => 'some-other-client.apps.googleusercontent.com',
                    'sub' => 'sub-maria',
                    'email' => $user->email,
                    'email_verified' => true,
                    'iat' => $now,
                    'exp' => $now + 300,
                ], self::PRIMARY_KID, self::PRIMARY_PRIVATE_KEY_PEM),
            ], 200),
            GoogleOAuthService::JWKS_ENDPOINT => Http::response([
                'keys' => [
                    ['kid' => self::PRIMARY_KID, 'kty' => 'RSA', 'alg' => 'RS256', 'use' => 'sig', 'n' => self::PRIMARY_JWK_N, 'e' => 'AQAB'],
                ],
            ], 200),
        ]);
        $this->postJson('/api/auth/google/callback', [
            'code' => 'wrong-aud-code',
            'state' => $state4,
        ])->assertStatus(401);

        // 6. Provider cancellation error is rejected
        $this->postJson('/api/auth/google/callback', [
            'error' => 'access_denied',
        ])->assertStatus(401)
            ->assertJsonPath('error', 'Google sign-in was cancelled or denied.');

        $this->assertSame(0, PersonalAccessToken::count());
        $this->assertGreaterThanOrEqual(6, AuditLog::where('action', 'Failed login')->count());
    }

    public function test_role_based_authorization_works_after_google_login(): void
    {
        Http::preventStrayRequests();

        $barangay = Barangay::create(['name' => 'Zone 1']);
        $patient = Patient::create([
            'first_name' => 'Juan',
            'last_name' => 'Dela Cruz',
            'full_name' => 'Juan Dela Cruz',
            'sex' => 'Male',
            'age' => 24,
            'barangay_id' => $barangay->id,
            'residence_barangay' => 'Zone 1',
            'address' => 'Digos City',
            'contact_number' => '09171234567',
        ]);

        User::factory()->create([
            'name' => 'Maria Santos',
            'email' => 'maria@gmail.com',
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $state = $this->requestGoogleRedirectState();
        $this->fakeGoogleOAuthSuccess('maria@gmail.com', 'sub-maria');

        $login = $this->postJson('/api/auth/google/callback', [
            'code' => 'code-maria-rbac',
            'state' => $state,
        ])->assertOk();

        $token = (string) $login->json('accessToken');

        // Allowed for nurse_vaccinator
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/patients')->assertOk();
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/pep-schedule')->assertOk();

        // Denied for nurse_vaccinator
        $this->withHeader('Authorization', 'Bearer '.$token)->deleteJson("/api/patients/{$patient->id}")->assertStatus(403);
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/reports/summary')->assertStatus(403);
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/users')->assertStatus(403);
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/settings')->assertStatus(403);
        $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/audit-logs')->assertStatus(403);
    }

    public function test_multiple_clinic_staff_with_same_role_authenticate_individually_with_attributable_audit_logs(): void
    {
        Http::preventStrayRequests();

        $barangay = Barangay::create(['name' => 'Zone 2']);

        $staffAccounts = [
            ['name' => 'Nurse One', 'email' => 'nurse1@gmail.com', 'role' => 'nurse_vaccinator'],
            ['name' => 'Nurse Two', 'email' => 'nurse2@gmail.com', 'role' => 'nurse_vaccinator'],
            ['name' => 'Nurse Three', 'email' => 'nurse3@gmail.com', 'role' => 'nurse_vaccinator'],
            ['name' => 'Nurse Four', 'email' => 'nurse4@gmail.com', 'role' => 'nurse_vaccinator'],
            ['name' => 'John Reyes', 'email' => 'john@gmail.com', 'role' => 'doctor'],
        ];

        $users = [];
        $tokens = [];

        foreach ($staffAccounts as $index => $account) {
            $user = User::factory()->create([
                'name' => $account['name'],
                'email' => $account['email'],
                'role' => $account['role'],
                'is_active' => true,
                'approval_status' => 'approved',
            ]);
            $users[$account['email']] = $user;

            $state = $this->requestGoogleRedirectState();
            $this->fakeGoogleOAuthSuccess($account['email'], 'sub-staff-'.$index);

            $login = $this->postJson('/api/auth/google/callback', [
                'code' => 'code-staff-'.$index,
                'state' => $state,
            ])->assertOk()
                ->assertJsonPath('user.id', $user->id)
                ->assertJsonPath('user.name', $account['name'])
                ->assertJsonPath('user.email', $account['email'])
                ->assertJsonPath('user.role', $account['role']);

            $tokens[$account['email']] = (string) $login->json('accessToken');

            $loginAudit = AuditLog::where('action', 'Login')
                ->where('user_id', $user->id)
                ->latest('id')
                ->first();
            $this->assertNotNull($loginAudit);
            $this->assertSame($account['name'], $loginAudit->user_name);
            $this->assertSame($account['role'], $loginAudit->user_role);
            $this->assertStringContainsString($account['email'], (string) $loginAudit->description);
        }

        // Nurse 1 and Nurse 2 each perform a clinical write action; audit logs must distinguish them
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$tokens['nurse1@gmail.com'])
            ->postJson('/api/patients', [
                'first_name' => 'Patient',
                'last_name' => 'Alpha',
                'age' => 22,
                'sex' => 'Male',
                'barangay_id' => $barangay->id,
                'address_line' => 'Purok 1',
                'residence_barangay' => 'Zone 2',
                'city_municipality' => 'Digos City',
                'province' => 'Davao del Sur',
                'contact_number' => '09170000001',
                'sms_consent' => false,
            ])->assertCreated();

        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$tokens['nurse2@gmail.com'])
            ->postJson('/api/patients', [
                'first_name' => 'Patient',
                'last_name' => 'Beta',
                'age' => 29,
                'sex' => 'Female',
                'barangay_id' => $barangay->id,
                'address_line' => 'Purok 2',
                'residence_barangay' => 'Zone 2',
                'city_municipality' => 'Digos City',
                'province' => 'Davao del Sur',
                'contact_number' => '09170000002',
                'sms_consent' => false,
            ])->assertCreated();

        $nurse1ActionLog = AuditLog::where('module', 'Patients')
            ->where('action', 'Create record')
            ->where('user_id', $users['nurse1@gmail.com']->id)
            ->first();
        $nurse2ActionLog = AuditLog::where('module', 'Patients')
            ->where('action', 'Create record')
            ->where('user_id', $users['nurse2@gmail.com']->id)
            ->first();

        $this->assertNotNull($nurse1ActionLog);
        $this->assertNotNull($nurse2ActionLog);
        $this->assertSame('Nurse One', $nurse1ActionLog->user_name);
        $this->assertSame('Nurse Two', $nurse2ActionLog->user_name);
        $this->assertNotSame($nurse1ActionLog->user_id, $nurse2ActionLog->user_id);
    }

    public function test_google_redirect_fails_gracefully_when_unconfigured(): void
    {
        config([
            'services.google.client_id' => '',
            'services.google.client_secret' => '',
            'services.google.redirect' => '',
        ]);

        $this->getJson('/api/auth/google/redirect')
            ->assertStatus(503)
            ->assertJsonPath('success', false)
            ->assertJsonPath('error', 'Google sign-in is not configured on this server.');
    }

    public function test_initiating_allowed_frontend_origin_is_preserved_and_signed_state_recovers_from_cache_miss_once(): void
    {
        Http::preventStrayRequests();

        config([
            'services.google.frontend_url' => 'http://localhost:5174',
            'cors.allowed_origins' => [
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'http://localhost:5174',
                'http://127.0.0.1:5174',
            ],
        ]);

        $user = User::factory()->create([
            'name' => 'Maria Santos',
            'email' => 'maria@gmail.com',
            'role' => 'nurse_vaccinator',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        // 1. Initiating from allowed origin http://localhost:5173 redirects back to http://localhost:5173/login
        $redirect5173 = $this->getJson('/api/auth/google/redirect?origin='.urlencode('http://localhost:5173'))
            ->assertOk();
        $state5173 = (string) $redirect5173->json('state');

        $this->get('/api/auth/google/callback?code=code-5173&state='.urlencode($state5173))
            ->assertRedirect('http://localhost:5173/login?code=code-5173&state='.rawurlencode($state5173));

        // 2. Initiating from an unallowed origin ignores the untrusted origin and uses configured safe origin
        $redirectEvil = $this->getJson('/api/auth/google/redirect?origin='.urlencode('https://evil.example.com'))
            ->assertOk();
        $stateEvil = (string) $redirectEvil->json('state');

        $this->get('/api/auth/google/callback?code=code-evil&state='.urlencode($stateEvil))
            ->assertRedirect('http://localhost:5174/login?code=code-evil&state='.rawurlencode($stateEvil));

        // 2b. Even if services.google.frontend_url is misconfigured outside cors.allowed_origins, passing it as ?origin cannot bypass the allowlist
        config(['services.google.frontend_url' => 'https://misconfigured.example.com']);
        $redirectMisconfigured = $this->getJson('/api/auth/google/redirect?origin='.urlencode('https://misconfigured.example.com'))
            ->assertOk();
        $stateMisconfigured = (string) $redirectMisconfigured->json('state');

        $this->get('/api/auth/google/callback?code=code-misconfig&state='.urlencode($stateMisconfigured))
            ->assertRedirect('http://localhost:5173/login?code=code-misconfig&state='.rawurlencode($stateMisconfigured));
        config(['services.google.frontend_url' => 'http://localhost:5174']);

        // 3. Even if initial state cache entry is cleared before callback, encrypted PKCE verifier in signed state succeeds once and blocks replay
        Cache::flush();
        $this->fakeGoogleOAuthSuccess('maria@gmail.com', 'sub-maria-origin');

        $this->postJson('/api/auth/google/callback', [
            'code' => 'code-5173',
            'state' => $state5173,
        ])->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('user.id', $user->id);

        // Replay of the same state is rejected
        $this->postJson('/api/auth/google/callback', [
            'code' => 'code-5173-replay',
            'state' => $state5173,
        ])->assertStatus(401)
            ->assertJsonPath('error', 'Invalid or expired Google authentication state. Please try signing in again.');
    }

    private function requestGoogleRedirectState(): string
    {
        return $this->requestGoogleRedirectDetails()['state'];
    }

    /**
     * @return array{authUrl: string, state: string, query: array<string, mixed>}
     */
    private function requestGoogleRedirectDetails(): array
    {
        Cache::flush();
        $redirect = $this->getJson('/api/auth/google/redirect')
            ->assertOk()
            ->assertJsonPath('success', true);

        $authUrl = (string) $redirect->json('authUrl');
        $this->assertStringStartsWith(GoogleOAuthService::AUTH_ENDPOINT.'?', $authUrl);

        parse_str((string) parse_url($authUrl, PHP_URL_QUERY), $query);
        $this->assertArrayHasKey('state', $query);
        $this->assertSame($query['state'], $redirect->json('state'));
        $this->assertSame('bitemap-google-client-id.apps.googleusercontent.com', $query['client_id'] ?? null);

        return [
            'authUrl' => $authUrl,
            'state' => (string) $query['state'],
            'query' => $query,
        ];
    }

    private function resetHttpFake(): void
    {
        Http::swap(new HttpClientFactory());
        Http::preventStrayRequests();
    }

    /**
     * @param  array<string, mixed>  $extraClaims
     */
    private function fakeGoogleOAuthSuccess(string $email, string $sub, array $extraClaims = []): void
    {
        $this->resetHttpFake();

        $now = now()->getTimestamp();
        $claims = array_merge([
            'iss' => 'https://accounts.google.com',
            'aud' => config('services.google.client_id'),
            'sub' => $sub,
            'email' => $email,
            'email_verified' => true,
            'iat' => $now,
            'exp' => $now + 300,
        ], $extraClaims);

        Http::fake([
            GoogleOAuthService::TOKEN_ENDPOINT => Http::response([
                'access_token' => 'google-access-token-'.$sub,
                'token_type' => 'Bearer',
                'expires_in' => 3600,
                'id_token' => $this->makeSignedJwt($claims, self::PRIMARY_KID, self::PRIMARY_PRIVATE_KEY_PEM),
            ], 200),
            GoogleOAuthService::JWKS_ENDPOINT => Http::response([
                'keys' => [
                    [
                        'kid' => self::PRIMARY_KID,
                        'kty' => 'RSA',
                        'alg' => 'RS256',
                        'use' => 'sig',
                        'n' => self::PRIMARY_JWK_N,
                        'e' => 'AQAB',
                    ],
                ],
            ], 200),
            GoogleOAuthService::USERINFO_ENDPOINT => Http::response(array_merge([
                'sub' => $sub,
                'email' => $email,
                'email_verified' => true,
                'name' => 'Google Staff Profile',
            ], $extraClaims), 200),
        ]);
    }

    /**
     * @param  array<string, mixed>  $claims
     */
    private function makeSignedJwt(array $claims, string $kid, string $privateKeyPem): string
    {
        $headerEncoded = $this->base64UrlEncode((string) json_encode([
            'alg' => 'RS256',
            'typ' => 'JWT',
            'kid' => $kid,
        ], JSON_THROW_ON_ERROR));

        $payloadEncoded = $this->base64UrlEncode((string) json_encode($claims, JSON_THROW_ON_ERROR));
        $signingInput = $headerEncoded.'.'.$payloadEncoded;

        $signature = '';
        $signed = openssl_sign($signingInput, $signature, $privateKeyPem, OPENSSL_ALGO_SHA256);
        $this->assertTrue($signed, 'Failed to sign test JWT.');

        return $signingInput.'.'.$this->base64UrlEncode($signature);
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
