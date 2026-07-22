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

    'google_reviews' => [
        'api_key' => env('GOOGLE_PLACES_API_KEY'),
        'endpoint' => env(
            'GOOGLE_PLACES_DETAILS_URL',
            'https://maps.googleapis.com/maps/api/place/details/json'
        ),
        'cache_ttl' => (int) env('GOOGLE_REVIEWS_CACHE_TTL', 21600),
        'places' => [
            [
                'label' => 'Sharjah Gallery',
                'place_id' => env(
                    'GOOGLE_PLACES_SHARJAH_PLACE_ID',
                    'ChIJfYeFAOVbXz4RznAggIiKFIw'
                ),
            ],
            [
                'label' => 'Dubai Showroom',
                'place_id' => env(
                    'GOOGLE_PLACES_DUBAI_PLACE_ID',
                    'ChIJPWuPLJNpXz4RxSjhEeZYfCc'
                ),
            ],
        ],
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
