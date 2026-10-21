<?php

namespace App\Services\Sms\Drivers;

use App\Services\Sms\Contracts\SmsProviderInterface;
use App\Services\Sms\SmsSendResult;
use App\Support\PhoneNumber;
use App\Support\SmsCredentials;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * PhilSMS API v3 provider implementation.
 *
 * Official endpoint: POST https://app.philsms.com/api/v3/sms/send
 * Authentication: Authorization: Bearer {PHILSMS_API_TOKEN}
 * Payload: {"recipient": "639XXXXXXXXX", "sender_id": "PhilSMS", "type": "plain", "message": "..."}
 */
class PhilSmsProvider implements SmsProviderInterface
{
    public function name(): string
    {
        return 'philsms';
    }

    public function isConfigured(): bool
    {
        $creds = SmsCredentials::resolvePhilSms();

        return ! blank($creds['token']) && ! blank($creds['sender_id']);
    }

    public function send(string $recipient, string $message, array $context = []): SmsSendResult
    {
        ['token' => $token, 'sender_id' => $senderId, 'endpoint' => $endpoint] = SmsCredentials::resolvePhilSms();

        if (blank($token) || blank($senderId)) {
            return new SmsSendResult(
                status: 'Failed',
                deliveryResponse: 'PhilSMS credentials are not configured.',
                provider: $this->name(),
                simulated: false,
            );
        }

        try {
            $response = Http::withToken((string) $token)
                ->acceptJson()
                ->asJson()
                ->timeout(15)
                ->post($endpoint, [
                    'recipient' => PhoneNumber::toPhilSms($recipient),
                    'sender_id' => (string) $senderId,
                    'type' => 'plain',
                    'message' => $message,
                ]);

            $httpStatus = $response->status();
            $json = $response->json();
            $apiStatus = is_array($json) ? strtolower((string) ($json['status'] ?? '')) : '';

            if ($response->successful() && $apiStatus === 'success') {
                $uid = is_array($json['data'] ?? null)
                    ? (string) ($json['data']['uid'] ?? $json['data']['id'] ?? '')
                    : '';

                $summary = 'PhilSMS API accepted request (HTTP '.$httpStatus
                    .($uid !== '' ? ', uid: '.$uid : '')
                    .', status: Accepted by gateway — awaiting handset delivery).';

                return new SmsSendResult(
                    status: 'Sent',
                    deliveryResponse: $summary,
                    provider: $this->name(),
                    simulated: false,
                    providerMessageId: $uid !== '' ? $uid : null,
                    httpStatus: $httpStatus,
                );
            }

            $errorDetail = $this->sanitizeErrorDetail(
                is_array($json) ? (string) ($json['message'] ?? 'Provider rejected request.') : 'HTTP '.$httpStatus.' error.',
                $recipient,
                $message,
                (string) $token
            );

            return new SmsSendResult(
                status: 'Failed',
                deliveryResponse: 'PhilSMS API error (HTTP '.$httpStatus.'): '.$errorDetail,
                provider: $this->name(),
                simulated: false,
                httpStatus: $httpStatus,
            );
        } catch (Throwable $exception) {
            $errorDetail = $this->sanitizeErrorDetail($exception->getMessage(), $recipient, $message, (string) $token);

            return new SmsSendResult(
                status: 'Failed',
                deliveryResponse: 'PhilSMS transport error: '.$errorDetail,
                provider: $this->name(),
                simulated: false,
            );
        }
    }

    private function sanitizeErrorDetail(string $detail, string $recipient, string $message, string $secret): string
    {
        $replacements = array_filter([
            $secret => '[REDACTED_TOKEN]',
            $recipient => PhoneNumber::mask($recipient),
            PhoneNumber::toE164($recipient) => PhoneNumber::mask($recipient),
            PhoneNumber::toPhilSms($recipient) => PhoneNumber::mask($recipient),
            $message => '[REDACTED_MESSAGE]',
        ], fn ($replacementValue, $needle) => $needle !== '', ARRAY_FILTER_USE_BOTH);

        $sanitized = str_replace(array_keys($replacements), array_values($replacements), trim($detail));

        return mb_substr($sanitized, 0, 240);
    }
}
