<?php

namespace App\Services\Sms;

class SmsSendResult
{
    public function __construct(
        public readonly string $status,
        public readonly string $deliveryResponse,
        public readonly string $provider = 'mock',
        public readonly bool $simulated = true,
        public readonly ?string $providerMessageId = null,
        public readonly ?int $httpStatus = null,
    ) {}

    /**
     * Whether the message was accepted by a real external SMS gateway API.
     * Note: Gateway API acceptance ('Sent') does not guarantee physical handset receipt ('Delivered').
     */
    public function isLiveAccepted(): bool
    {
        return ! $this->simulated && in_array($this->status, ['Sent', 'Delivered'], true);
    }

    /**
     * Legacy tuple format [status, deliveryResponse] used by BitemapApiController.
     *
     * @return array{0: string, 1: string}
     */
    public function toTuple(): array
    {
        return [$this->status, $this->deliveryResponse];
    }
}
