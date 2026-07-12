<?php

use App\Http\Middleware\EnsureUserHasRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => EnsureUserHasRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (Throwable $exception, Request $request) {
            if (! $request->is('api/public/*')) {
                return null;
            }

            Log::error('Unhandled public API exception', [
                'exception' => $exception,
                'path' => $request->path(),
            ]);

            $isClinicDirectory = $request->is('api/public/clinics');
            $isMap = $request->is('api/public/heatmap');
            $message = $isClinicDirectory
                ? 'Unable to load clinic information. Please try again later.'
                : ($isMap ? 'Unable to load map data.' : 'Public statistics are temporarily unavailable. Please try again later.');
            $code = $isClinicDirectory
                ? 'PUBLIC_CLINIC_DIRECTORY_UNAVAILABLE'
                : ($isMap ? 'PUBLIC_MAP_UNAVAILABLE' : 'PUBLIC_API_UNAVAILABLE');

            return response()->json([
                'success' => false,
                'message' => $message,
                'error' => $message,
                'code' => $code,
            ], 500);
        });
    })->create();
