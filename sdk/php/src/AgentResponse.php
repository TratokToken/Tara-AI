<?php

declare(strict_types=1);

namespace Tratok\Tara;

/**
 * A parsed /agent response. Wraps the raw array with convenience accessors.
 */
final class AgentResponse
{
    public function __construct(
        public readonly string $id,
        public readonly string $role,
        public readonly array $content,
        public readonly string $stopReason,
        public readonly array $usage,
        public readonly array $raw,
    ) {}

    public static function fromArray(array $raw): self
    {
        return new self(
            id: $raw['id'] ?? '',
            role: $raw['role'] ?? 'assistant',
            content: $raw['content'] ?? [],
            stopReason: $raw['stop_reason'] ?? 'end_turn',
            usage: $raw['usage'] ?? [],
            raw: $raw,
        );
    }

    /** Concatenated text of all top-level `text` blocks. */
    public function text(): string
    {
        $out = '';
        foreach ($this->content as $block) {
            if (($block['type'] ?? '') === 'text') {
                $out .= $block['text'];
            }
        }
        return $out;
    }

    /** All `tool_use` blocks. */
    public function toolCalls(): array
    {
        return array_values(array_filter(
            $this->content,
            fn($b) => ($b['type'] ?? '') === 'tool_use',
        ));
    }

    public function totalTokens(): int
    {
        return (int) ($this->usage['total_tokens'] ?? 0);
    }
}
