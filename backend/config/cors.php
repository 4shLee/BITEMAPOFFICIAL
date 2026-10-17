<?php

/*
|--------------------------------------------------------------------------
| CORS
|--------------------------------------------------------------------------
|
| The API authenticates with Bearer tokens (no cookies), so credentials are not
| supported and the origin allowlist is the main browser-side control.
|
| CORS_ALLOWED_ORIGINS          comma-separated exact origins (scheme + host [+ port],
|                               no trailing slash), e.g.
|                               https://bitemap.vercel.app,http://localhost:5173
|                               Default: local Vite dev origins only.
| CORS_ALLOWED_ORIGIN_PATTERNS  optional comma-separated regexes, e.g. to allow Vercel
|                               preview deployments:
|                               #^https://bitemap-[a-z0-9-]+\.vercel\.app$#
*/

$list = static fn (?string $value): array => array_values(array_filter(array_map('trim', explode(',', (string) $value))));

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $list(env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')),
    'allowed_origins_patterns' => $list(env('CORS_ALLOWED_ORIGIN_PATTERNS', '')),
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
