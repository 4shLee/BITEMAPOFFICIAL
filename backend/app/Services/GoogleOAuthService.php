<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Throwable;

class GoogleOAuthService
{
    public const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

    public const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

    public const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

    public const JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs';

    public const JWKS_CACHE_KEY = 'google_oauth_jwks_keys';

    public const JWKS_CACHE_TTL_SECONDS = 3600;

    public const STATE_TTL_SECONDS = 600;

    public function isConfigured(): bool
    {
        return $this->clientId() !== ''
            && $this->clientSecret() !== ''
            && $this->redirectUri() !== '';
    }

    public function createAuthorizationUrl(?Request $request = null): string
    {
        return $this->createAuthorizationRedirect($request)['authUrl'];
    }

    /**
     * @return array{authUrl: string, state: string}
     */
    public function createAuthorizationRedirect(?Request $request = null): array
    {
        if (! $this->isConfigured()) {
            throw new GoogleOAuthException('Google sign-in is not configured on this server.', 503);
        }

        ['state' => $state, 'code_challenge' => $codeChallenge] = $this->generateStateAndPkce($request);

        $query = http_build_query([
            'client_id' => $this->clientId(),
            'redirect_uri' => $this->redirectUri(),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'code_challenge' => $codeChallenge,
            'code_challenge_method' => 'S256',
            'access_type' => 'online',
            'include_granted_scopes' => 'true',
            'prompt' => 'select_account',
        ], '', '&', PHP_QUERY_RFC3986);

        return [
            'authUrl' => self::AUTH_ENDPOINT.'?'.$query,
            'state' => $state,
        ];
    }

    public function verifyStateToken(string $state, ?Request $request = null): bool
    {
        return $this->verifyAndConsumeState($state, $request) !== null;
    }

    /**
     * Exchange a Google authorization code for a cryptographically verified Google identity.
     *
     * Only identity fields are returned; BITEMAP's database remains the sole
     * source of truth for account existence, status, role, and permissions.
     *
     * @return array{sub: string, email: string, email_verified: bool}
     */
    public function authenticateCode(string $code, string $state, ?Request $request = null): array
    {
        if (! $this->isConfigured()) {
            throw new GoogleOAuthException('Google sign-in is not configured on this server.', 503);
        }

        $stateData = $this->verifyAndConsumeState($state, $request);
        if ($stateData === null) {
            throw new GoogleOAuthException('Invalid or expired Google authentication state. Please try signing in again.', 401);
        }

        $normalizedCode = trim($code);
        if ($normalizedCode === '' || ! Cache::add($this->codeCacheKey($normalizedCode), true, now()->addSeconds(self::STATE_TTL_SECONDS))) {
            throw new GoogleOAuthException('Authorization code has already been used.', 401);
        }

        try {
            $tokenResponse = Http::asForm()
                ->acceptJson()
                ->timeout(15)
                ->post(self::TOKEN_ENDPOINT, [
                    'code' => $normalizedCode,
                    'client_id' => $this->clientId(),
                    'client_secret' => $this->clientSecret(),
                    'redirect_uri' => $this->redirectUri(),
                    'grant_type' => 'authorization_code',
                    'code_verifier' => $stateData['code_verifier'],
                ]);
        } catch (Throwable) {
            throw new GoogleOAuthException('Unable to verify Google authentication code. Please try again.', 401);
        }

        $tokenJson = $tokenResponse->json();
        $accessToken = is_array($tokenJson) ? trim((string) ($tokenJson['access_token'] ?? '')) : '';

        if (! $tokenResponse->successful() || $accessToken === '') {
            throw new GoogleOAuthException('Unable to verify Google authentication code. Please try again.', 401);
        }

        $rawIdToken = is_array($tokenJson) ? trim((string) ($tokenJson['id_token'] ?? '')) : '';
        if ($rawIdToken === '') {
            throw new GoogleOAuthException('Google ID token is missing from authentication response.', 401);
        }

        $idTokenClaims = $this->validateAndDecodeIdToken($rawIdToken);

        try {
            $userInfoResponse = Http::withToken($accessToken)
                ->acceptJson()
                ->timeout(15)
                ->get(self::USERINFO_ENDPOINT);
        } catch (Throwable) {
            throw new GoogleOAuthException('Unable to retrieve verified Google account profile.', 401);
        }

        $userInfo = $userInfoResponse->json();
        if (! $userInfoResponse->successful() || ! is_array($userInfo)) {
            throw new GoogleOAuthException('Unable to retrieve verified Google account profile.', 401);
        }

        $sub = trim((string) ($userInfo['sub'] ?? ''));
        $email = strtolower(trim((string) ($userInfo['email'] ?? '')));

        if ($sub === '' || $email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new GoogleOAuthException('Unable to retrieve verified Google account profile.', 401);
        }

        $emailVerified = filter_var($userInfo['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($emailVerified !== true) {
            throw new GoogleOAuthException('Your Google account email address is not verified.', 401);
        }

        if (trim((string) $idTokenClaims['sub']) !== $sub) {
            throw new GoogleOAuthException('Invalid Google ID token claims.', 401);
        }

        if (strtolower(trim((string) $idTokenClaims['email'])) !== $email) {
            throw new GoogleOAuthException('Invalid Google ID token claims.', 401);
        }

        return [
            'sub' => $sub,
            'email' => $email,
            'email_verified' => true,
        ];
    }

    /**
     * Build a strictly validated frontend /login callback URL for browser redirects from Google.
     *
     * @param  array<string, mixed>  $params
     */
    public function frontendLoginRedirectUrl(array $params = []): string
    {
        $baseUrl = $this->resolveSafeFrontendOrigin();
        $loginUrl = $baseUrl.'/login';
        $allowedKeys = ['code', 'state', 'error'];
        $filtered = [];

        foreach ($allowedKeys as $key) {
            if (array_key_exists($key, $params) && is_scalar($params[$key])) {
                $value = trim((string) $params[$key]);
                if ($value !== '') {
                    $filtered[$key] = $value;
                }
            }
        }

        if ($filtered === []) {
            return $loginUrl;
        }

        return $loginUrl.'?'.http_build_query($filtered, '', '&', PHP_QUERY_RFC3986);
    }

    /**
     * @return array{state: string, code_challenge: string}
     */
    private function generateStateAndPkce(?Request $request): array
    {
        $signingKey = $this->signingKeyOrNull();
        if ($signingKey === null) {
            throw new GoogleOAuthException('Google sign-in is not configured on this server.', 503);
        }

        $nonce = Str::random(40);
        $codeVerifier = Str::random(64);
        $codeChallenge = $this->base64UrlEncode(hash('sha256', $codeVerifier, true));
        $userAgentHash = $this->userAgentHash($request);
        $issuedAt = now()->getTimestamp();

        $payloadJson = json_encode([
            'nonce' => $nonce,
            'iat' => $issuedAt,
            'ua' => substr($userAgentHash, 0, 16),
        ], JSON_THROW_ON_ERROR);

        Cache::put($this->stateCacheKey($nonce), [
            'code_verifier' => $codeVerifier,
            'ua_hash' => $userAgentHash,
            'iat' => $issuedAt,
        ], now()->addSeconds(self::STATE_TTL_SECONDS));

        $encodedPayload = $this->base64UrlEncode($payloadJson);
        $signature = hash_hmac('sha256', $encodedPayload, $signingKey);

        return [
            'state' => $encodedPayload.'.'.$signature,
            'code_challenge' => $codeChallenge,
        ];
    }

    /**
     * @return array{code_verifier: string, ua_hash: string, iat: int}|null
     */
    private function verifyAndConsumeState(string $state, ?Request $request): ?array
    {
        $parts = explode('.', trim($state));
        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
            return null;
        }

        [$encodedPayload, $signature] = $parts;
        $signingKey = $this->signingKeyOrNull();
        if ($signingKey === null) {
            return null;
        }

        $expectedSignature = hash_hmac('sha256', $encodedPayload, $signingKey);
        if (! hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $decodedPayload = $this->base64UrlDecode($encodedPayload);
        if ($decodedPayload === null) {
            return null;
        }

        $payload = json_decode($decodedPayload, true);
        if (! is_array($payload)) {
            return null;
        }

        $nonce = $payload['nonce'] ?? null;
        $issuedAt = $payload['iat'] ?? null;
        $uaPrefix = $payload['ua'] ?? null;

        if (! is_string($nonce) || $nonce === '' || ! is_int($issuedAt) || ! is_string($uaPrefix)) {
            return null;
        }

        $now = now()->getTimestamp();
        if ($issuedAt > ($now + 60) || ($now - $issuedAt) > self::STATE_TTL_SECONDS) {
            return null;
        }

        $currentUaHash = $this->userAgentHash($request);
        if (! hash_equals(substr($currentUaHash, 0, 16), $uaPrefix)) {
            return null;
        }

        // Single-use state prevents OAuth callback replay attacks.
        $cached = Cache::pull($this->stateCacheKey($nonce));
        if (! is_array($cached)) {
            return null;
        }

        $codeVerifier = $cached['code_verifier'] ?? null;
        $cachedUaHash = $cached['ua_hash'] ?? null;
        $cachedIssuedAt = $cached['iat'] ?? null;

        if (
            ! is_string($codeVerifier)
            || $codeVerifier === ''
            || ! is_string($cachedUaHash)
            || ! is_int($cachedIssuedAt)
            || ($now - $cachedIssuedAt) > self::STATE_TTL_SECONDS
            || ! hash_equals($cachedUaHash, $currentUaHash)
        ) {
            return null;
        }

        return [
            'code_verifier' => $codeVerifier,
            'ua_hash' => $cachedUaHash,
            'iat' => $cachedIssuedAt,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function validateAndDecodeIdToken(string $idToken): array
    {
        $segments = explode('.', $idToken);
        if (count($segments) !== 3 || $segments[0] === '' || $segments[1] === '' || $segments[2] === '') {
            throw new GoogleOAuthException('Invalid Google ID token structure.', 401);
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $segments;

        $decodedHeader = $this->base64UrlDecode($encodedHeader);
        $header = $decodedHeader !== null ? json_decode($decodedHeader, true) : null;
        if (! is_array($header)) {
            throw new GoogleOAuthException('Invalid Google ID token header.', 401);
        }

        $alg = $header['alg'] ?? null;
        $kid = trim((string) ($header['kid'] ?? ''));
        if ($alg !== 'RS256' || $kid === '') {
            throw new GoogleOAuthException('Unsupported Google ID token algorithm or missing key ID.', 401);
        }

        $signature = $this->base64UrlDecode($encodedSignature);
        if ($signature === null || $signature === '') {
            throw new GoogleOAuthException('Invalid Google ID token signature.', 401);
        }

        $publicKeyPem = $this->resolveGooglePublicKeyPem($kid);
        $verified = openssl_verify(
            $encodedHeader.'.'.$encodedPayload,
            $signature,
            $publicKeyPem,
            OPENSSL_ALGO_SHA256
        );

        if ($verified !== 1) {
            throw new GoogleOAuthException('Invalid Google ID token signature.', 401);
        }

        $decodedPayload = $this->base64UrlDecode($encodedPayload);
        $claims = $decodedPayload !== null ? json_decode($decodedPayload, true) : null;
        if (! is_array($claims)) {
            throw new GoogleOAuthException('Invalid Google ID token claims.', 401);
        }

        $iss = (string) ($claims['iss'] ?? '');
        if (! in_array($iss, ['https://accounts.google.com', 'accounts.google.com'], true)) {
            throw new GoogleOAuthException('Invalid Google ID token claims.', 401);
        }

        $aud = trim((string) ($claims['aud'] ?? ''));
        if ($aud === '' || $aud !== $this->clientId()) {
            throw new GoogleOAuthException('Invalid Google ID token claims.', 401);
        }

        if (array_key_exists('azp', $claims) && trim((string) $claims['azp']) !== $this->clientId()) {
            throw new GoogleOAuthException('Invalid Google ID token claims.', 401);
        }

        $now = now()->getTimestamp();
        if (! isset($claims['exp']) || ! is_numeric($claims['exp']) || (int) $claims['exp'] <= ($now - 30)) {
            throw new GoogleOAuthException('Invalid Google ID token claims.', 401);
        }

        if (! isset($claims['iat']) || ! is_numeric($claims['iat']) || (int) $claims['iat'] > ($now + 60)) {
            throw new GoogleOAuthException('Invalid Google ID token claims.', 401);
        }

        $sub = trim((string) ($claims['sub'] ?? ''));
        $email = strtolower(trim((string) ($claims['email'] ?? '')));
        if ($sub === '' || $email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new GoogleOAuthException('Invalid Google ID token claims.', 401);
        }

        $emailVerified = filter_var($claims['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($emailVerified !== true) {
            throw new GoogleOAuthException('Your Google account email address is not verified.', 401);
        }

        return $claims;
    }

    private function resolveGooglePublicKeyPem(string $kid): string
    {
        $cachedKeys = Cache::get(self::JWKS_CACHE_KEY);
        $matchedKey = is_array($cachedKeys) ? $this->findRsaJwk($cachedKeys, $kid) : null;

        if ($matchedKey === null) {
            $freshKeys = $this->fetchGoogleJwks();
            $matchedKey = $this->findRsaJwk($freshKeys, $kid);
        }

        if ($matchedKey === null) {
            throw new GoogleOAuthException('Unable to verify Google ID token signing key.', 401);
        }

        return $this->rsaJwkToPem((string) $matchedKey['n'], (string) $matchedKey['e']);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function fetchGoogleJwks(): array
    {
        try {
            $response = Http::acceptJson()
                ->timeout(15)
                ->get(self::JWKS_ENDPOINT);
        } catch (Throwable) {
            throw new GoogleOAuthException('Unable to retrieve Google signing keys.', 401);
        }

        $json = $response->json();
        if (! $response->successful() || ! is_array($json) || ! is_array($json['keys'] ?? null)) {
            throw new GoogleOAuthException('Unable to retrieve Google signing keys.', 401);
        }

        /** @var list<array<string, mixed>> $keys */
        $keys = array_values(array_filter($json['keys'], 'is_array'));
        Cache::put(self::JWKS_CACHE_KEY, $keys, now()->addSeconds(self::JWKS_CACHE_TTL_SECONDS));

        return $keys;
    }

    /**
     * @param  array<int, mixed>  $keys
     * @return array<string, mixed>|null
     */
    private function findRsaJwk(array $keys, string $kid): ?array
    {
        foreach ($keys as $key) {
            if (
                is_array($key)
                && ($key['kid'] ?? null) === $kid
                && ($key['kty'] ?? null) === 'RSA'
                && is_string($key['n'] ?? null)
                && $key['n'] !== ''
                && is_string($key['e'] ?? null)
                && $key['e'] !== ''
            ) {
                return $key;
            }
        }

        return null;
    }

    private function rsaJwkToPem(string $nBase64Url, string $eBase64Url): string
    {
        $modulus = $this->base64UrlDecode($nBase64Url);
        $exponent = $this->base64UrlDecode($eBase64Url);

        if ($modulus === null || $modulus === '' || $exponent === null || $exponent === '') {
            throw new GoogleOAuthException('Invalid Google signing key parameters.', 401);
        }

        $rsaPublicKey = $this->derSequence(
            $this->derInteger($modulus).$this->derInteger($exponent)
        );
        // AlgorithmIdentifier: rsaEncryption OID (1.2.840.113549.1.1.1) + NULL
        $algorithmIdentifier = "\x30\x0d\x06\x09\x2a\x86\x48\x86\xf7\x0d\x01\x01\x01\x05\x00";
        $subjectPublicKeyInfo = $this->derSequence(
            $algorithmIdentifier.$this->derBitString($rsaPublicKey)
        );

        return "-----BEGIN PUBLIC KEY-----\n"
            .chunk_split(base64_encode($subjectPublicKeyInfo), 64, "\n")
            ."-----END PUBLIC KEY-----\n";
    }

    private function derLength(int $length): string
    {
        if ($length < 0x80) {
            return chr($length);
        }

        $encoded = ltrim(pack('N', $length), "\x00");

        return chr(0x80 | strlen($encoded)).$encoded;
    }

    private function derInteger(string $bytes): string
    {
        $bytes = ltrim($bytes, "\x00");
        if ($bytes === '') {
            $bytes = "\x00";
        }
        if ((ord($bytes[0]) & 0x80) !== 0) {
            $bytes = "\x00".$bytes;
        }

        return "\x02".$this->derLength(strlen($bytes)).$bytes;
    }

    private function derSequence(string $content): string
    {
        return "\x30".$this->derLength(strlen($content)).$content;
    }

    private function derBitString(string $bytes): string
    {
        return "\x03".$this->derLength(strlen($bytes) + 1)."\x00".$bytes;
    }

    private function resolveSafeFrontendOrigin(): string
    {
        $allowedOrigins = [];
        foreach ((array) config('cors.allowed_origins', []) as $origin) {
            $normalized = $this->parseValidHttpOrigin((string) $origin);
            if ($normalized !== null) {
                $allowedOrigins[] = $normalized;
            }
        }

        $allowedPatterns = array_values(array_filter(
            array_map('trim', (array) config('cors.allowed_origins_patterns', [])),
            static fn (string $pattern): bool => $pattern !== ''
        ));

        $configuredFrontend = $this->parseValidHttpOrigin((string) config('services.google.frontend_url', ''));
        if ($configuredFrontend !== null) {
            $hasAllowlist = $allowedOrigins !== [] || $allowedPatterns !== [];
            if (! $hasAllowlist || $this->isOriginAllowed($configuredFrontend, $allowedOrigins, $allowedPatterns)) {
                return $configuredFrontend;
            }
        }

        if ($allowedOrigins !== []) {
            return $allowedOrigins[0];
        }

        return 'http://localhost:5173';
    }

    private function parseValidHttpOrigin(string $url): ?string
    {
        $trimmed = trim($url);
        if ($trimmed === '' || $trimmed === '*' || preg_match('/[\s\x00-\x1f]/', $trimmed) === 1) {
            return null;
        }

        $parts = parse_url($trimmed);
        if (! is_array($parts)) {
            return null;
        }

        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        $allowedSchemes = app()->environment('production') ? ['https'] : ['http', 'https'];
        if (! in_array($scheme, $allowedSchemes, true)) {
            return null;
        }

        if (isset($parts['user']) || isset($parts['pass'])) {
            return null;
        }

        $host = strtolower(trim((string) ($parts['host'] ?? '')));
        if ($host === '') {
            return null;
        }

        $port = isset($parts['port']) ? ':'.(int) $parts['port'] : '';

        return $scheme.'://'.$host.$port;
    }

    /**
     * @param  list<string>  $allowedOrigins
     * @param  list<string>  $allowedPatterns
     */
    private function isOriginAllowed(string $origin, array $allowedOrigins, array $allowedPatterns): bool
    {
        if (in_array($origin, $allowedOrigins, true)) {
            return true;
        }

        foreach ($allowedPatterns as $pattern) {
            if (@preg_match($pattern, $origin) === 1) {
                return true;
            }
        }

        return false;
    }

    private function userAgentHash(?Request $request): string
    {
        return hash('sha256', (string) ($request?->userAgent() ?? ''));
    }

    private function clientId(): string
    {
        return trim((string) config('services.google.client_id', ''));
    }

    private function clientSecret(): string
    {
        return trim((string) config('services.google.client_secret', ''));
    }

    private function redirectUri(): string
    {
        return trim((string) config('services.google.redirect', ''));
    }

    private function signingKeyOrNull(): ?string
    {
        $key = trim((string) config('app.key', ''));

        return $key !== '' ? $key : null;
    }

    private function stateCacheKey(string $nonce): string
    {
        return 'google_oauth_state:'.hash('sha256', $nonce);
    }

    private function codeCacheKey(string $code): string
    {
        return 'google_oauth_code:'.hash('sha256', $code);
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $data): ?string
    {
        $remainder = strlen($data) % 4;
        if ($remainder > 0) {
            $data .= str_repeat('=', 4 - $remainder);
        }

        $decoded = base64_decode(strtr($data, '-_', '+/'), true);

        return $decoded === false ? null : $decoded;
    }
}
