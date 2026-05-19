# tara-client (PHP)

PHP 8.0+ client for the Tara API. No framework, no Guzzle — just curl + json.

## Install

Vendor manually from this repo, or (when published) `composer require tratok/tara-client`.

## Quickstart

```php
<?php
require __DIR__ . '/sdk/php/vendor/autoload.php'; // or your composer autoload

use Tratok\Tara\TaraClient;

$client = new TaraClient(); // reads TARA_API_KEY from env

// Chat
echo $client->chat('What is Tratok?'), "\n";

// Agent
$response = $client->agent(
    messages: [['role' => 'user', 'content' => 'Plan a 3-day trip to Dubai.']],
    system: 'Be concise. Use bullet points.',
    maxTokens: 1024,
);
echo $response->text(), "\n";

// Agent loop with tools
$final = $client->runAgentLoop(
    userMessage: "What's the weather in Dubai?",
    tools: [[
        'name'        => 'get_weather',
        'description' => 'Get current weather for a city.',
        'input_schema' => [
            'type'       => 'object',
            'properties' => ['city' => ['type' => 'string']],
            'required'   => ['city'],
        ],
    ]],
    toolHandlers: [
        'get_weather' => fn(array $args) => ['temp_c' => 37, 'condition' => 'sunny'],
    ],
);
echo $final, "\n";
```

## API

| Method | What |
|---|---|
| `new TaraClient(?string $apiKey = null, ?string $baseUrl = null, int $timeout = 60, int $maxAttempts = 5)` | Constructor. `apiKey` defaults to `TARA_API_KEY` env. |
| `chat(string $message, ...): string` | Reply string. |
| `chatRaw(string $message, ...): array` | Full response. |
| `agent(array $messages, ?string $system = null, ?array $tools = null, ...): AgentResponse` | Single call. |
| `runAgentLoop(string $userMessage, array $tools, array $toolHandlers, ?string $system = null, int $maxTurns = 10): string` | Full loop. |

## Errors

All errors throw `Tratok\Tara\TaraError` (or subclass). Inspect `$e->statusCode`, `$e->errorType`, `$e->requestId`, `$e->body`.

| Subclass | When |
|---|---|
| `TaraAuthError` | 401 / 403 |
| `TaraRateLimitError` | 429 (has `retryAfterSeconds`) |
| `TaraValidationError` | 400 / 422 |
| `TaraServerError` | 5xx |

429s and 5xx auto-retry with exponential backoff.
