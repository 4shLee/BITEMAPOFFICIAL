<?php

namespace App\Services\Sms\Contracts;

use App\Services\Sms\SmsSendResult;

interface SmsProviderInterface
{
    /**
     * Canonical provider identifier (e.g. 'philsms', 'semaphore', 'twilio', 'mock').
     */
    public function name(): string;

    /**
     * Whether all required credentials for this provider are present.
     */
    public function isConfigured(): bool;

    /**
     * Send an SMS message to the given recipient.
     *
     * @param  array<string, mixed>  $context
     */
    public function send(string $recipient, string $message, array $context = []): SmsSendResult;
}
