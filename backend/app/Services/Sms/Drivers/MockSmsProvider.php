<?php

namespace App\Services\Sms\Drivers;

use App\Services\Sms\Contracts\SmsProviderInterface;
use App\Services\Sms\SmsSendResult;
use App\Support\PhoneNumber;

/**
 * Mock/Test SMS provider that records attempted messages in memory without making external API calls.
 *
 * Always returns status = 'Pending' and simulated = true with an explicit [MOCK SMS - NOT SENT]
 * marker so mock/simulation execution can never be silently mistaken for real SMS delivery.
 */
class MockSmsProvider implements SmsProviderInterface
{
    /**
     * @var array<int, array{
     *     recipient: string,
     *     e164: string,
     *     philsms_number: string,
     *     masked_recipient: string,
     *     message: string,
     *     reason: string,
     *     context: array<string, mixed>,
     *     recorded_at: string
     * }>
     */
    private static array $recordedMessages = [];

    public function name(): string
    {
        return 'mock';
    }

    public function isConfigured(): bool
    {
        return true;
    }

    public function send(string $recipient, string $message, array $context = []): SmsSendResult
    {
        $reason = (string) ($context['simulation_reason'] ?? 'simulation_mode');

        self::$recordedMessages[] = [
            'recipient' => $recipient,
            'e164' => PhoneNumber::toE164($recipient),
            'philsms_number' => PhoneNumber::toPhilSms($recipient),
            'masked_recipient' => PhoneNumber::mask($recipient),
            'message' => $message,
            'reason' => $reason,
            'context' => $context,
            'recorded_at' => now()->toIso8601String(),
        ];

        $deliveryResponse = match ($reason) {
            'demo_number_blocked' => '[MOCK SMS - NOT SENT] Seeded/demo contact number detected. SMS simulation mode is active; no real SMS was sent.',
            default => '[MOCK SMS - NOT SENT] SMS simulation mode is active. No real SMS was sent; the reminder is recorded for testing and review.',
        };

        return new SmsSendResult(
            status: 'Pending',
            deliveryResponse: $deliveryResponse,
            provider: 'mock',
            simulated: true,
            providerMessageId: null,
            httpStatus: null,
        );
    }

    /**
     * Return all recorded mock SMS messages for test assertions.
     *
     * @return array<int, array<string, mixed>>
     */
    public static function recorded(): array
    {
        return self::$recordedMessages;
    }

    /**
     * Return the most recently recorded mock SMS message, or null if none.
     *
     * @return array<string, mixed>|null
     */
    public static function last(): ?array
    {
        if (self::$recordedMessages === []) {
            return null;
        }

        return self::$recordedMessages[array_key_last(self::$recordedMessages)];
    }

    /**
     * Reset recorded messages between tests.
     */
    public static function clear(): void
    {
        self::$recordedMessages = [];
    }
}
