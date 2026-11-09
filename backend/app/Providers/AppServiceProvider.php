<?php

namespace App\Providers;

use App\Models\User;
use App\Support\AuthSessionSecurity;
use App\Support\PasswordPolicy;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        if ($this->app->environment('production')) {
            URL::forceScheme('https');
        }

        Password::defaults(function () {
            return PasswordPolicy::defaultRule();
        });

        Sanctum::authenticateAccessTokensUsing(function (PersonalAccessToken $accessToken, bool $isValid): bool {
            if (! $isValid || AuthSessionSecurity::hasReachedAbsoluteExpiration($accessToken)) {
                $accessToken->delete();

                return false;
            }

            $tokenable = $accessToken->tokenable;
            if ($tokenable instanceof User && ! AuthSessionSecurity::isUserActiveAndApproved($tokenable)) {
                $tokenable->tokens()->delete();

                return false;
            }

            if (AuthSessionSecurity::hasExceededIdleTimeout($accessToken)) {
                $accessToken->delete();

                return false;
            }

            if (AuthSessionSecurity::isGenuineUserActivityRequest(request())) {
                AuthSessionSecurity::recordGenuineActivity($accessToken);
            }

            return true;
        });
    }
}
