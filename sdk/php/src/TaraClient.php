<?php

declare(strict_types=1);

namespace Tratok\Tara;

require_once __DIR__ . '/TaraError.php';
require_once __DIR__ . '/AgentResponse.php';

final class TaraClient
{
    private const DEFAULT_BASE_URL = 'https://tara.tratok.com/api/v1';
    private const SDK_VERSION      = '1.1.0';

    private string $apiKey;
    private string $baseUrl;

    public function __construct(
        ?string $apiKey = null,
        ?string $baseUrl = null,
        private int $timeout = 60,
        private int $maxAttempts = 5,
    ) {
        $apiKey = $apiKey ?? (getenv('TARA_API_KEY') ?: '');
        if ($apiKey === '') {
            throw new TaraError('No API key. Pass $apiKey or set TARA_API_KEY in the environment.');
        }
        $this->apiKey  = $apiKey;
        $this->baseUrl = rtrim($baseUrl ?? self::DEFAULT_BASE_URL, '/');
    }

    // ---- /chat -----------------------------------------------------------

    public function chat(
        string $message,
        ?array $history = null,
        int $maxTokens = 1024,
        float $temperature = 0.7,
    ): string {
        $response = $this->chatRaw($message, $history, $maxTokens, $temperature);
        return (string) ($response['reply'] ?? '');
    }

    public function chatRaw(
        string $message,
        ?array $history = null,
        int $maxTokens = 1024,
        float $temperature = 0.7,
    ): array {
        $body = [
            'message'     => $message,
            'max_tokens'  => $maxTokens,
            'temperature' => $temperature,
        ];
        if ($history !== null) {
            $body['history'] = $history;
        }
        return $this->post('/chat.php', $body);
    }

    // ---- /agent ----------------------------------------------------------

    public function agent(
        array $messages,
        ?string $system = null,
        ?array $tools = null,
        ?array $toolChoice = null,
        int $maxTokens = 1024,
        float $temperature = 0.7,
    ): AgentResponse {
        $body = [
            'messages'    => $messages,
            'max_tokens'  => $maxTokens,
            'temperature' => $temperature,
        ];
        if ($system !== null)     $body['system']      = $system;
        if ($tools !== null)      $body['tools']       = $tools;
        if ($toolChoice !== null) $body['tool_choice'] = $toolChoice;

        return AgentResponse::fromArray($this->post('/agent.php', $body));
    }

    // ---- agent loop ------------------------------------------------------

    public function runAgentLoop(
        string $userMessage,
        array $tools,
        array $toolHandlers,
        ?string $system = null,
        int $maxTurns = 10,
        bool $raiseOnToolError = false,
    ): string {
        $messages = [['role' => 'user', 'content' => $userMessage]];

        for ($turn = 0; $turn < $maxTurns; $turn++) {
            $response = $this->agent(
                messages: $messages,
                system: $system,
                tools: $tools,
            );

            $messages[] = ['role' => 'assistant', 'content' => $response->content];

            if ($response->stopReason === 'end_turn' || $response->stopReason === 'max_tokens') {
                return $response->text();
            }

            if ($response->stopReason === 'tool_use') {
                $results = [];
                foreach ($response->toolCalls() as $block) {
                    $handler = $toolHandlers[$block['name']] ?? null;
                    if ($handler === null) {
                        $results[] = [
                            'type'        => 'tool_result',
                            'tool_use_id' => $block['id'],
                            'content'     => "Unknown tool: " . $block['name'],
                            'is_error'    => true,
                        ];
                        continue;
                    }
                    try {
                        $r = $handler($block['input'] ?? []);
                        $results[] = [
                            'type'        => 'tool_result',
                            'tool_use_id' => $block['id'],
                            'content'     => is_string($r) ? $r : json_encode($r, JSON_UNESCAPED_UNICODE),
                        ];
                    } catch (\Throwable $e) {
                        if ($raiseOnToolError) {
                            throw new TaraToolError(
                                "Tool '{$block['name']}' raised: " . $e->getMessage(),
                                previous: $e,
                            );
                        }
                        $results[] = [
                            'type'        => 'tool_result',
                            'tool_use_id' => $block['id'],
                            'content'     => "Tool error: " . $e->getMessage(),
                            'is_error'    => true,
                        ];
                    }
                }
                $messages[] = ['role' => 'user', 'content' => $results];
                continue;
            }

            throw new TaraError("Unexpected stop_reason: {$response->stopReason}");
        }

        throw new TaraError("Agent loop exceeded {$maxTurns} turns");
    }

    // ---- internals -------------------------------------------------------

    private function post(string $path, array $body): array
    {
        $url     = $this->baseUrl . $path;
        $payload = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $lastErr = null;
        for ($attempt = 0; $attempt < $this->maxAttempts; $attempt++) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST           => true,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HEADER         => true,
                CURLOPT_TIMEOUT        => $this->timeout,
                CURLOPT_HTTPHEADER     => [
                    'Authorization: Bearer ' . $this->apiKey,
                    'Content-Type: application/json',
                    'User-Agent: tara-client-php/' . self::SDK_VERSION,
                ],
                CURLOPT_POSTFIELDS     => $payload,
            ]);

            $raw       = curl_exec($ch);
            $status    = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $headerLen = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $err       = curl_error($ch);
            curl_close($ch);

            if ($raw === false) {
                $lastErr = $err;
                $this->sleepBackoff($attempt);
                continue;
            }

            $headersText = substr($raw, 0, $headerLen);
            $bodyText    = substr($raw, $headerLen);

            if ($status === 429) {
                $retryAfter = $this->parseRetryAfter($headersText, $bodyText);
                if ($attempt < $this->maxAttempts - 1) {
                    sleep(max(1, $retryAfter));
                    continue;
                }
                throw $this->makeError($status, $bodyText, $retryAfter);
            }

            if ($status >= 500 && $status < 600) {
                if ($attempt < $this->maxAttempts - 1) {
                    $this->sleepBackoff($attempt);
                    continue;
                }
                throw $this->makeError($status, $bodyText);
            }

            if ($status >= 400) {
                throw $this->makeError($status, $bodyText);
            }

            try {
                $decoded = json_decode($bodyText, true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException $e) {
                throw new TaraError(
                    "Non-JSON response: " . $e->getMessage(),
                    statusCode: $status,
                    body: $bodyText,
                );
            }

            return $decoded;
        }

        throw new TaraError("Request failed after {$this->maxAttempts} attempts: " . ($lastErr ?? 'unknown'));
    }

    private function sleepBackoff(int $attempt): void
    {
        $secs = (2 ** $attempt) + (random_int(0, 1000) / 1000.0);
        usleep((int) ($secs * 1_000_000));
    }

    private function parseRetryAfter(string $headersText, string $bodyText): int
    {
        // Header takes priority
        foreach (explode("\r\n", $headersText) as $line) {
            if (preg_match('/^Retry-After:\s*(\d+)/i', $line, $m)) {
                return (int) $m[1];
            }
        }
        // Body fallback
        try {
            $body = json_decode($bodyText, true, 512, JSON_THROW_ON_ERROR);
            if (is_array($body) && isset($body['error']['retry_after_seconds'])) {
                return (int) $body['error']['retry_after_seconds'];
            }
        } catch (\Throwable) {
            // ignore
        }
        return 1;
    }

    private function makeError(int $status, string $bodyText, ?int $retryAfter = null): TaraError
    {
        $errorType = null;
        $requestId = null;
        $message   = "HTTP $status";
        $body      = $bodyText;
        try {
            $decoded = json_decode($bodyText, true, 512, JSON_THROW_ON_ERROR);
            if (is_array($decoded)) {
                $errorType = $decoded['error']['type']       ?? null;
                $requestId = $decoded['error']['request_id'] ?? null;
                $message   = $decoded['error']['message']    ?? $message;
                $body      = $decoded;
            }
        } catch (\Throwable) {
            // keep $bodyText as-is
        }

        return match (true) {
            $status === 401 || $status === 403 =>
                new TaraAuthError($message, $status, $errorType, $requestId, $body),
            $status === 400 || $status === 422 =>
                new TaraValidationError($message, $status, $errorType, $requestId, $body),
            $status === 429 =>
                new TaraRateLimitError($message, $retryAfter, $status, $errorType, $requestId, $body),
            $status >= 500 =>
                new TaraServerError($message, $status, $errorType, $requestId, $body),
            default =>
                new TaraError($message, $status, $errorType, $requestId, $body),
        };
    }
}
