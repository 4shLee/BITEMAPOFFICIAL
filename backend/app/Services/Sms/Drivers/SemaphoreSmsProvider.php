<?php

namespace App\Services\Sms\Drivers;

use App\Services\Sms\Contracts\SmsProviderInterface;
use App\Services\Sms\SmsSendResult;
use App\Support\PhoneNumber;
use App\Support\SmsCredentials;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Semaphore API v4 provider implementation (Fallback Philippine SMS Gateway).
 *
 * Official endpoint: POST https://api.semaphore.co/api/v4/messages
 * Payload: {"apikey": "{SEMAPHORE_API_KEY}", "number": "639XXXXXXXXX", "message": "...", "sendername": "..."}
 */
class SemaphoreSmsProvider implements SmsProviderInterface
{
    public function name(): string
    {
        return 'semaphore';
    }

    public function isConfigured(): bool
    {
        $creds = SmsCredentials::resolveSemaphore();

        return ! blank($creds['api_key']);
    }

    public function send(string $recipient, string $message, array $context = []): SmsSendResult
    {
        ['api_key' => $apiKey, 'sender_name' => $senderName, 'endpoint' => $endpoint] = SmsCredentials::resolveSemaphore();

        if (blank($apiKey)) {
            return new SmsSendResult(
                status: 'Failed',
                deliveryResponse: 'Semaphore API key is not configured.',
                provider: $this->name(),
                simulated: false,
            );
        }

        $payload = [
            'apikey' => (string) $apiKey,
            'number' => PhoneNumber::toPhilSms($recipient),
            'message' => $message,
        ];

        if (! blank($senderName)) {
            $payload['sendername'] = (string) $senderName;
        }

        try {
            $response = Http::acceptJson()
                ->asJson()
                ->timeout(15)
                ->post($endpoint, $payload);

            $httpStatus = $response->status();
            $json = $response->json();

            $firstRecord = is_array($json) && isset($json[0]) && is_array($json[0])
                ? $json[0]
                : (is_array($json) && isset($json['message_id']) ? $json : null);

            if ($response->successful() && is_array($firstRecord) && isset($firstRecord['message_id'])) {
                $messageId = (string) $firstRecord['message_id'];
                $gatewayStatus = (string) ($firstRecord['status'] ?? 'Queued');

                if (in_array(strtolower($gatewayStatus), ['failed', 'refunded'], true)) {
                    return new SmsSendResult(
                        status: 'Failed',
                        deliveryResponse: 'Semaphore rejected message (HTTP '.$httpStatus.', message_id: '.$messageId.', status: '.$gatewayStatus.').',
                        provider: $this->name(),
                        simulated: false,
                        providerMessageId: $messageId,
                        httpStatus: $httpStatus,
                    );
                }

                return new SmsSendResult(
                    status: 'Sent',
                    deliveryResponse: 'Semaphore API accepted request (HTTP '.$httpStatus.', message_id: '.$messageId.', gateway_status: '.$gatewayStatus.' — awaiting handset delivery).',
                    provider: $this->name(),
                    simulated: false,
                    providerMessageId: $messageId,
                    httpStatus: $httpStatus,
                );
            }

            $rawError = is_array($json)
                ? (string) ($json['message'] ?? $json['error'] ?? json_encode(array_keys($json)))
                : 'HTTP '.$httpStatus.' error.';

            $errorDetail = $this->sanitizeErrorDetail($rawError, $recipient, $message, (string) $apiKey);

            return new SmsSendResult(
                status: 'Failed',
                deliveryResponse: 'Semaphore API error (HTTP '.$httpStatus.'): '.$errorDetail,
                provider: $this->name(),
                simulated: false,
                httpStatus: $httpStatus,
            );
        } catch (Throwable $exception) {
            $errorDetail = $this->sanitizeErrorDetail($exception->getMessage(), $recipient, $message, (string) $apiKey);

            return new SmsSendResult(
                status: 'Failed',
                deliveryResponse: 'Semaphore transport error: '.$errorDetail,
                provider: $this->name(),
                simulated: false,
            );
        }
    }

    private function sanitizeErrorDetail(string $detail, string $recipient, string $message, string $secret): string
    {
        $replacements = array_filter([
            $secret => '[REDACTED_API_KEY]',
            $recipient => PhoneNumber::mask($recipient),
            PhoneNumber::toE164($recipient) => PhoneNumber::mask($recipient),
            PhoneNumber::toPhilSms($recipient) => PhoneNumber::mask($recipient),
            $message => '[REDACTED_MESSAGE]',
        ], fn ($replacementValue, $needle) => $needle !== '', ARRAY_FILTER_USE_BOTH);

        $sanitized = str_replace(array_keys($replacements), array_values($replacements), trim($detail));

        return mb_substr($sanitized, 0, 240);
    }
}
