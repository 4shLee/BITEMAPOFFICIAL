<?php

namespace App\Services\Sms\Drivers;

use App\Services\Sms\Contracts\SmsProviderInterface;
use App\Services\Sms\SmsSendResult;
use App\Support\PhoneNumber;
use App\Support\SmsCredentials;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * Twilio Programmable Messaging REST API provider implementation.
 */
class TwilioSmsProvider implements SmsProviderInterface
{
    public function name(): string
    {
        return 'twilio';
    }

    public function isConfigured(): bool
    {
        ['sid' => $sid, 'token' => $token, 'from' => $from] = SmsCredentials::resolve();

        return ! blank($sid) && ! blank($token) && ! blank($from);
    }

    public function send(string $recipient, string $message, array $context = []): SmsSendResult
    {
        ['sid' => $sid, 'token' => $token, 'from' => $from] = SmsCredentials::resolve();

        if (blank($sid) || blank($token) || blank($from)) {
            return new SmsSendResult(
                status: 'Failed',
                deliveryResponse: 'Twilio credentials are not configured.',
                provider: $this->name(),
                simulated: false,
            );
        }

        try {
            $response = Http::asForm()
                ->withBasicAuth((string) $sid, (string) $token)
                ->post('https://api.twilio.com/2010-04-01/Accounts/'.$sid.'/Messages.json', [
                    'From' => $from,
                    'To' => PhoneNumber::toE164($recipient),
                    'Body' => $message,
                ]);

            $httpStatus = $response->status();
            $json = $response->json();

            if ($response->successful()) {
                $messageSid = is_array($json) ? (string) ($json['sid'] ?? '') : '';
                $gatewayStatus = is_array($json) ? (string) ($json['status'] ?? 'accepted') : 'accepted';

                return new SmsSendResult(
                    status: 'Sent',
                    deliveryResponse: 'Twilio API accepted request (HTTP '.$httpStatus
                        .($messageSid !== '' ? ', sid: '.$messageSid : '')
                        .', status: '.$gatewayStatus.' — awaiting handset delivery).',
                    provider: $this->name(),
                    simulated: false,
                    providerMessageId: $messageSid !== '' ? $messageSid : null,
                    httpStatus: $httpStatus,
                );
            }

            $rawError = is_array($json)
                ? (string) ($json['message'] ?? $json['error_message'] ?? 'HTTP '.$httpStatus.' error.')
                : 'HTTP '.$httpStatus.' error.';

            return new SmsSendResult(
                status: 'Failed',
                deliveryResponse: 'Twilio API error (HTTP '.$httpStatus.'): '.$this->sanitizeErrorDetail($rawError, $recipient, $message, (string) $token),
                provider: $this->name(),
                simulated: false,
                httpStatus: $httpStatus,
            );
        } catch (Throwable $exception) {
            return new SmsSendResult(
                status: 'Failed',
                deliveryResponse: 'Twilio transport error: '.$this->sanitizeErrorDetail($exception->getMessage(), $recipient, $message, (string) $token),
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
