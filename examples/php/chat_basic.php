<?php
/**
 * Minimal Tara /chat call in PHP. No dependencies — uses curl.
 *
 * Usage:
 *   export TARA_API_KEY=tara_sk_...
 *   php chat_basic.php "What is Tratok?"
 */

declare(strict_types=1);

const TARA_API_BASE = 'https://tara.tratok.com/api/v1';

function tara_chat(string $message): array
{
    $apiKey = getenv('TARA_API_KEY') ?: '';
    if ($apiKey === '') {
        fwrite(STDERR, "Set TARA_API_KEY in your environment first.\n");
        exit(1);
    }

    $ch = curl_init(TARA_API_BASE . '/chat.php');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 60,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $apiKey,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS     => json_encode([
            'message'     => $message,
            'max_tokens'  => 512,
            'temperature' => 0.7,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);

    $body   = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    if ($body === false) {
        throw new RuntimeException("curl error: $err");
    }
    if ($status >= 400) {
        throw new RuntimeException("HTTP $status: $body");
    }

    return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
}

$message = $argv[1] ?? 'What is Tratok in one sentence?';
$result  = tara_chat($message);

if (empty($result['ok'])) {
    fwrite(STDERR, 'Error: ' . ($result['error']['message'] ?? 'unknown') . "\n");
    exit(1);
}

echo $result['reply'], "\n\n";
echo "--- tokens: ", $result['usage']['total_tokens'], "\n";
