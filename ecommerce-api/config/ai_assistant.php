<?php

return [
    'enabled' => env('AI_ASSISTANT_ENABLED', true),
    'api_key' => env('OPENAI_API_KEY'),
    'model' => env('OPENAI_MODEL', 'gpt-5.6-luna'),
    'endpoint' => env('OPENAI_RESPONSES_URL', 'https://api.openai.com/v1/responses'),
    'timeout' => (int) env('OPENAI_TIMEOUT', 25),
    'max_output_tokens' => (int) env('OPENAI_MAX_OUTPUT_TOKENS', 700),
    'whatsapp_number' => env('MESSARA_WHATSAPP_NUMBER', '971543057077'),
];
