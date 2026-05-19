<?php
/**
 * Full Tara agent loop in PHP, with tools.
 *
 * Usage:
 *   export TARA_API_KEY=tara_sk_...
 *   php agent_loop.php "What's the weather in Dubai? Convert 100 USD to AED."
 */

declare(strict_types=1);

const TARA_API_BASE = 'https://tara.tratok.com/api/v1';
const MAX_TURNS     = 10;

// ----- tool implementations -----------------------------------------------

function tool_get_weather(array $args): array
{
    $city = $args['city'] ?? '';
    $data = [
        'Dubai'     => ['temp_c' => 37, 'condition' => 'sunny'],
        'Abu Dhabi' => ['temp_c' => 39, 'condition' => 'sunny'],
        'London'    => ['temp_c' => 18, 'condition' => 'cloudy'],
    ];
    return $data[$city] ?? ['temp_c' => 22, 'condition' => 'unknown', 'note' => "no data for $city"];
}

function tool_get_currency_rate(array $args): array
{
    $rates = [
        'USD/AED' => 3.67,
        'AED/USD' => 0.272,
        'USD/EUR' => 0.92,
    ];
    $base  = strtoupper($args['base']  ?? '');
    $quote = strtoupper($args['quote'] ?? '');
    $key   = "$base/$quote";
    if (!isset($rates[$key])) {
        return ['error' => "No rate for $key"];
    }
    return ['base' => $base, 'quote' => $quote, 'rate' => $rates[$key]];
}

$TOOLS = [
    [
        'name'        => 'get_weather',
        'description' => 'Get current weather for a city. Returns temp_c and condition.',
        'input_schema' => [
            'type'       => 'object',
            'properties' => ['city' => ['type' => 'string']],
            'required'   => ['city'],
        ],
    ],
    [
        'name'        => 'get_currency_rate',
        'description' => 'Get the current exchange rate between two ISO-4217 currency codes.',
        'input_schema' => [
            'type'       => 'object',
            'properties' => [
                'base'  => ['type' => 'string'],
                'quote' => ['type' => 'string'],
            ],
            'required' => ['base', 'quote'],
        ],
    ],
];

$HANDLERS = [
    'get_weather'       => 'tool_get_weather',
    'get_currency_rate' => 'tool_get_currency_rate',
];

// ----- HTTP -----

function post_agent(array $messages, array $tools, int $maxAttempts = 5): array
{
    $apiKey = getenv('TARA_API_KEY') ?: '';
    if ($apiKey === '') {
        fwrite(STDERR, "Set TARA_API_KEY first.\n");
        exit(1);
    }

    $payload = json_encode([
        'messages'    => $messages,
        'tools'       => $tools,
        'max_tokens'  => 1024,
        'temperature' => 0.7,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
        $ch = curl_init(TARA_API_BASE . '/agent.php');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_HTTPHEADER     => [
                'Authorization: Bearer ' . $apiKey,
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS     => $payload,
        ]);
        $body   = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($status === 429) {
            sleep(2 ** $attempt);
            continue;
        }
        if ($status >= 500) {
            sleep(2 ** $attempt);
            continue;
        }
        if ($status >= 400) {
            throw new RuntimeException("HTTP $status: $body");
        }
        return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    }

    throw new RuntimeException("Tara /agent failed after $maxAttempts attempts");
}

// ----- the loop -----

function run_agent(string $userMessage, array $tools, array $handlers): string
{
    $messages = [['role' => 'user', 'content' => $userMessage]];

    for ($turn = 0; $turn < MAX_TURNS; $turn++) {
        echo "\n--- turn ", $turn + 1, " ---\n";
        $resp = post_agent($messages, $tools);

        $messages[] = ['role' => 'assistant', 'content' => $resp['content']];

        foreach ($resp['content'] as $block) {
            if ($block['type'] === 'text') {
                echo "[text] ", $block['text'], "\n";
            } elseif ($block['type'] === 'tool_use') {
                echo "[tool_use] ", $block['name'], "(", json_encode($block['input']), ")\n";
            }
        }

        if ($resp['stop_reason'] === 'end_turn' || $resp['stop_reason'] === 'max_tokens') {
            $text = '';
            foreach ($resp['content'] as $b) {
                if ($b['type'] === 'text') $text .= $b['text'];
            }
            return $text;
        }

        if ($resp['stop_reason'] === 'tool_use') {
            $results = [];
            foreach ($resp['content'] as $block) {
                if ($block['type'] !== 'tool_use') continue;
                $handler = $handlers[$block['name']] ?? null;
                if (!$handler) {
                    $results[] = [
                        'type'        => 'tool_result',
                        'tool_use_id' => $block['id'],
                        'content'     => "Unknown tool: " . $block['name'],
                        'is_error'    => true,
                    ];
                    continue;
                }
                try {
                    $r = $handler($block['input']);
                    echo "[tool_result] ", $block['name'], " -> ", json_encode($r), "\n";
                    $results[] = [
                        'type'        => 'tool_result',
                        'tool_use_id' => $block['id'],
                        'content'     => json_encode($r, JSON_UNESCAPED_UNICODE),
                    ];
                } catch (Throwable $e) {
                    $results[] = [
                        'type'        => 'tool_result',
                        'tool_use_id' => $block['id'],
                        'content'     => "Tool raised: " . $e->getMessage(),
                        'is_error'    => true,
                    ];
                }
            }
            $messages[] = ['role' => 'user', 'content' => $results];
            continue;
        }

        throw new RuntimeException("Unexpected stop_reason: " . $resp['stop_reason']);
    }

    throw new RuntimeException("Agent loop exceeded " . MAX_TURNS . " turns");
}

$message = $argv[1] ?? "What's the weather in Dubai and Abu Dhabi? Convert 100 USD to AED.";

$final = run_agent($message, $TOOLS, $HANDLERS);
echo "\n=== final answer ===\n", $final, "\n";
