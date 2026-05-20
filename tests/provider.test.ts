/**
 * Provider unit tests
 */
import { describe, it, expect } from 'vitest';
import { OpenAIProvider, AnthropicProvider, OllamaProvider, AIClient } from '../src/provider.js';
import type { AIMessage } from '../src/types.js';

describe('OpenAIProvider', () => {
  it('constructs with apiKey', () => {
    const p = new OpenAIProvider({ apiKey: 'test-key' });
    expect(p).toBeDefined();
  });

  it('constructs with custom baseURL', () => {
    const p = new OpenAIProvider({ apiKey: 'test', baseURL: 'https://custom.api/v1' });
    expect(p).toBeDefined();
  });
});

describe('AnthropicProvider', () => {
  it('constructs with apiKey', () => {
    const p = new AnthropicProvider({ apiKey: 'test-key' });
    expect(p).toBeDefined();
  });

  it('constructs with custom baseURL', () => {
    const p = new AnthropicProvider({ apiKey: 'test', baseURL: 'https://custom.anthropic.api' });
    expect(p).toBeDefined();
  });
});

describe('OllamaProvider', () => {
  it('constructs with defaults', () => {
    const p = new OllamaProvider({});
    expect(p).toBeDefined();
  });

  it('constructs with custom baseURL', () => {
    const p = new OllamaProvider({ baseURL: 'http://192.168.1.100:11434' });
    expect(p).toBeDefined();
  });
});

describe('AIClient', () => {
  it('constructs and can switch providers', () => {
    const openai = new OpenAIProvider({ apiKey: 'test' });
    const client = new AIClient(openai);

    const anthropic = new AnthropicProvider({ apiKey: 'test' });
    client.setProvider(anthropic);

    expect(client).toBeDefined();
  });

  it('ask throws with unreachable endpoint', async () => {
    const client = new AIClient(
      new OpenAIProvider({ apiKey: 'test', baseURL: 'https://127.0.0.1:1/v1' })
    );
    await expect(client.ask('hello')).rejects.toThrow();
  }, 10000);
});
