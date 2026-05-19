<?php
/**
 * Minimal Tara /agent call in PHP.
 *
 * Usage:
 *   export TARA_API_KEY=tara_sk_...
 *   php agent_basic.php "Suggest 3 things to do in Dubai."
 */

declare(strict_types=1);

const TARA_API_BASE = 'https://tara.tratok.com/api/v1';

function tara_agent(array $messages, ?string $system = null, int $maxTokens = 1024): array
{
    $apiKey = getenv('TARA_API_KEY') ?: '';
    if ($apiKey === '') {
        fwrite(STDERR, "Set TARA_API_KEY in your environment first.\n");
        exit(1);
    }

    $body = ['messages' => $messages, 'max_tokens' => $maxTokens];
    if ($system !== null) {
        $body['system'] = $system;
    }

    $ch = curl_init(TARA_API_BASE . '/agent.php');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $resp   = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    if ($resp === false) {
        throw new RuntimeException("curl error: $err");
    }
    if ($status >= 400) {
        throw new RuntimeException("HTTP $status: $resp");
    }

    return json_decode($resp, true, 512, JSON_THROW_ON_ERROR);
}

function extract_text(array $response): string
{
    $out = '';
    foreach ($response['content'] ?? [] as $block) {
        if (($block['type'] ?? '') === 'text') {
            $out .= $block['text'];
        }
    }
    return $out;
}

$message = $argv[1] ?? 'Suggest 3 things to do in Dubai in May.';

$result = tara_agent(
    messages: [['role' => 'user', 'content' => $message]],
    system: 'Be concise. Use bullet points.',
    maxTokens: 512,
);

echo extract_text($result), "\n\n";
echo "--- stop_reason=", $result['stop_reason'],
     ", tokens=", $result['usage']['total_tokens'], "\n";
