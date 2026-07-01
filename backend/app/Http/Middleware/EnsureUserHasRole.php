<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['success' => false, 'error' => 'Unauthenticated.'], 401);
        }

        $allowedRoles = collect($roles)
            ->flatMap(fn (string $role) => explode('|', $role))
            ->map(fn (string $role) => $this->normalizeRoleKey($role))
            ->filter()
            ->values();

        if ($allowedRoles->isNotEmpty() && ! $allowedRoles->contains($this->normalizeRoleKey($user->role))) {
            return response()->json([
                'success' => false,
                'error' => 'You do not have permission to perform this action.',
            ], 403);
        }

        return $next($request);
    }

    private function normalizeRoleKey(?string $role): string
    {
        $key = str($role ?? '')
            ->trim()
            ->squish()
            ->lower()
            ->replace([' ', '-', '/'], '_')
            ->toString();

        return match ($key) {
            'admin' => 'system_admin',
            'health_officer' => 'doctor',
            'nurse', 'vaccinator' => 'nurse_vaccinator',
            default => $key,
        };
    }
}
