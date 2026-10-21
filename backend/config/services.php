<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'twilio' => [
        'sid' => env('TWILIO_ACCOUNT_SID'),
        'token' => env('TWILIO_AUTH_TOKEN'),
        'from' => env('TWILIO_FROM_NUMBER'),
        'facility_name' => env('BITEMAP_FACILITY_NAME', 'Animal Bite Treatment Center'),
    ],

    'philsms' => [
        'token' => env('PHILSMS_API_TOKEN'),
        'sender_id' => env('PHILSMS_SENDER_ID', 'PhilSMS'),
        'endpoint' => env('PHILSMS_ENDPOINT', 'https://app.philsms.com/api/v3/sms/send'),
    ],

    'semaphore' => [
        'api_key' => env('SEMAPHORE_API_KEY'),
        'sender_name' => env('SEMAPHORE_SENDER_NAME'),
        'endpoint' => env('SEMAPHORE_ENDPOINT', 'https://api.semaphore.co/api/v4/messages'),
    ],

    'sms' => [
        // Live sending is OFF unless SMS_SERVICE_ENABLED is explicitly true.
        'enabled' => env('SMS_SERVICE_ENABLED', false),
        'provider' => env('SMS_PROVIDER', 'Twilio'),
        'facility_name' => env('BITEMAP_FACILITY_NAME', 'Animal Bite Treatment Center'),
        // Null = allow credentials saved in the Settings screen (plaintext in the DB) only in
        // local/testing. Set SMS_ALLOW_DB_CREDENTIALS=true to allow them elsewhere.
        'allow_database_credentials' => env('SMS_ALLOW_DB_CREDENTIALS'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
