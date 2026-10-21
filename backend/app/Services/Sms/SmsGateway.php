<?php

namespace App\Services\Sms;

use App\Services\Sms\Contracts\SmsProviderInterface;
use App\Services\Sms\Drivers\MockSmsProvider;
use App\Services\Sms\Drivers\PhilSmsProvider;
use App\Services\Sms\Drivers\SemaphoreSmsProvider;
use App\Services\Sms\Drivers\TwilioSmsProvider;
use App\Support\PhoneNumber;
use App\Support\SmsCredentials;
use Illuminate\Support\Facades\Log;

class SmsGateway
{
    public function __construct(
        private readonly MockSmsProvider $mockProvider = new MockSmsProvider,
        private readonly PhilSmsProvider $philSmsProvider = new PhilSmsProvider,
        private readonly SemaphoreSmsProvider $semaphoreProvider = new SemaphoreSmsProvider,
        private readonly TwilioSmsProvider $twilioProvider = new TwilioSmsProvider,
    ) {}

    /**
     * Resolve the configured provider driver instance.
     */
    public function driver(?string $providerName = null): SmsProviderInterface
    {
        $resolved = strtolower(trim($providerName ?? SmsCredentials::resolveProviderName()));

        return match ($resolved) {
            'philsms' => $this->philSmsProvider,
            'semaphore' => $this->semaphoreProvider,
            'twilio' => $this->twilioProvider,
            default => $this->mockProvider,
        };
    }

    /**
     * Canonical display name for the active provider.
     */
    public function providerDisplayName(): string
    {
        return match ($this->driver()->name()) {
            'philsms' => 'PhilSMS',
            'semaphore' => 'Semaphore',
            'twilio' => 'Twilio',
            default => 'Mock',
        };
    }

    /**
     * Check whether the active provider has credentials configured.
     */
    public function isConfigured(): bool
    {
        $providerName = SmsCredentials::resolveProviderName();
        if (in_array($providerName, ['mock', 'test', 'simulation'], true)) {
            return false;
        }

        return $this->driver($providerName)->isConfigured();
    }

    /**
     * Live SMS sending is strictly opt-in:
     * 1. SMS_SERVICE_ENABLED must explicitly evaluate to true (null/false stays disabled).
     * 2. The active provider must not be the mock driver.
     * 3. The active provider's required credentials must be present.
     */
    public function isLiveSendingEnabled(): bool
    {
        $configuredFlag = config('services.sms.enabled');
        if ($configuredFlag === null || ! filter_var($configuredFlag, FILTER_VALIDATE_BOOL)) {
            return false;
        }

        $driver = $this->driver();
        if ($driver->name() === 'mock') {
            return false;
        }

        return $driver->isConfigured();
    }

    /**
     * Send an SMS through the configured provider or record it via MockSmsProvider
     * when live sending is disabled or the recipient is a seeded demo number.
     *
     * @param  array<string, mixed>  $context
     */
    public function send(string $recipient, string $message, array $context = []): SmsSendResult
    {
        if (PhoneNumber::isDemoOrReservedNumber($recipient)) {
            return $this->mockProvider->send($recipient, $message, [
                ...$context,
                'simulation_reason' => 'demo_number_blocked',
            ]);
        }

        if (! $this->isLiveSendingEnabled()) {
            return $this->mockProvider->send($recipient, $message, [
                ...$context,
                'simulation_reason' => 'simulation_mode',
                'configured_provider' => SmsCredentials::resolveProviderName(),
            ]);
        }

        $result = $this->driver()->send($recipient, $message, $context);

        if ($result->status === 'Failed') {
            Log::warning('SMS gateway delivery attempt failed.', [
                'provider' => $result->provider,
                'http_status' => $result->httpStatus,
                'masked_recipient' => PhoneNumber::mask($recipient),
            ]);
        }

        return $result;
    }
}
