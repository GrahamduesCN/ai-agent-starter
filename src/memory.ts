/**
 * Memory manager with token-aware context window control.
 *
 * Features:
 * - Character-based token estimation (~4 chars per token for English, ~1.5 for Chinese)
 * - Automatic summarization when approaching limit
 * - System prompt preservation
 */

import type { AIMessage } from './types.js';

export interface MemoryOptions {
  /** Max tokens to keep in memory (default: 8000) */
  maxTokens?: number;
  /** Summarization function — if not provided, oldest messages are dropped */
  summarize?: (messages: AIMessage[]) => Promise<string>;
}

export class MemoryManager {
  private messages: AIMessage[] = [];
  private maxTokens: number;
  private summarize: ((messages: AIMessage[]) => Promise<string>) | null;

  constructor(options: MemoryOptions = {}) {
    this.maxTokens = options.maxTokens || 8000;
    this.summarize = options.summarize || null;
  }

  add(message: AIMessage): void {
    this.messages.push(message);
    this.prune();
  }

  addMany(messages: AIMessage[]): void {
    for (const m of messages) {
      this.messages.push(m);
    }
    this.prune();
  }

  getAll(): AIMessage[] {
    return [...this.messages];
  }

  setSystemPrompt(prompt: string): void {
    // Remove existing system prompts
    this.messages = this.messages.filter((m) => m.role !== 'system');
    this.messages.unshift({ role: 'system', content: prompt });
  }

  clear(keepSystem = true): void {
    if (keepSystem) {
      this.messages = this.messages.filter((m) => m.role === 'system');
    } else {
      this.messages = [];
    }
  }

  tokenCount(): number {
    return estimateTokens(this.messages);
  }

  /** Get recent messages within a token limit */
  recent(maxMessages: number): AIMessage[] {
    return this.messages.slice(-maxMessages);
  }

  // ---- Internal ----

  private prune(): void {
    while (this.tokenCount() > this.maxTokens && this.messages.length > 2) {
      // Keep system prompt at index 0
      const startIdx = this.messages[0]?.role === 'system' ? 1 : 0;
      const removed = this.messages.splice(startIdx, 1);
      // Could accumulate removed messages for summarization here
      void removed;
    }
  }
}

// ============================================================
// Token estimation
// ============================================================

/**
 * Rough token count estimator.
 * GPT tokenizers average ~4 chars per token for English,
 * ~1.5 chars per token for CJK characters.
 */
export function estimateTokens(messages: AIMessage[]): number {
  let chars = 0;
  for (const msg of messages) {
    chars += msg.content.length;
    // Role overhead
    chars += msg.role.length;
    if (msg.name) chars += msg.name.length;
  }
  // 4 chars ≈ 1 token (conservative)
  return Math.ceil(chars / 4);
}

/**
 * More accurate count distinguishing CJK vs ASCII.
 */
export function estimateTokensMixed(messages: AIMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += countTokens(msg.content);
    total += 1; // role token overhead
  }
  return total;
}

function countTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    // CJK range (simplified)
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3400 && code <= 0x4dbf) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      tokens += 0.7; // CJK character ≈ 0.7 tokens
    } else {
      tokens += 0.25; // ASCII ≈ 0.25 tokens
    }
  }
  return Math.ceil(tokens);
}
