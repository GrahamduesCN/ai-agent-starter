/**
 * Agent and Memory unit tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Agent } from '../src/agent.js';
import { MemoryManager, estimateTokens, estimateTokensMixed } from '../src/memory.js';
import { AIClient, OpenAIProvider } from '../src/provider.js';
import type { AITool } from '../src/types.js';

const mockClient = new AIClient(new OpenAIProvider({ apiKey: 'mock' }));

describe('MemoryManager', () => {
  it('starts empty', () => {
    const mem = new MemoryManager();
    expect(mem.getAll()).toHaveLength(0);
  });

  it('adds and retrieves messages', () => {
    const mem = new MemoryManager();
    mem.add({ role: 'user', content: 'hello' });
    expect(mem.getAll()).toHaveLength(1);
    expect(mem.getAll()[0].content).toBe('hello');
  });

  it('sets system prompt', () => {
    const mem = new MemoryManager();
    mem.setSystemPrompt('You are a bot');
    expect(mem.getAll()[0]).toEqual({ role: 'system', content: 'You are a bot' });
  });

  it('replaces system prompt', () => {
    const mem = new MemoryManager();
    mem.setSystemPrompt('First');
    mem.setSystemPrompt('Second');
    expect(mem.getAll().filter((m) => m.role === 'system')).toHaveLength(1);
    expect(mem.getAll()[0].content).toBe('Second');
  });

  it('clear keeps system prompt by default', () => {
    const mem = new MemoryManager();
    mem.setSystemPrompt('System');
    mem.add({ role: 'user', content: 'hello' });
    mem.clear();
    expect(mem.getAll()).toHaveLength(1);
    expect(mem.getAll()[0].content).toBe('System');
  });

  it('tokenCount returns a number', () => {
    const mem = new MemoryManager();
    mem.add({ role: 'user', content: 'Hello, world!' });
    expect(mem.tokenCount()).toBeGreaterThan(0);
  });

  it('recent returns last N messages', () => {
    const mem = new MemoryManager();
    mem.add({ role: 'user', content: 'a' });
    mem.add({ role: 'assistant', content: 'b' });
    mem.add({ role: 'user', content: 'c' });
    expect(mem.recent(2)).toHaveLength(2);
    expect(mem.recent(2)[1].content).toBe('c');
  });
});

describe('estimateTokens', () => {
  it('counts English text', () => {
    const tokens = estimateTokens([{ role: 'user', content: 'Hello world' }]);
    expect(tokens).toBeGreaterThan(0);
    expect(tokens).toBeLessThan(10);
  });

  it('counts Chinese text', () => {
    const tokens = estimateTokens([{ role: 'user', content: '你好世界' }]);
    expect(tokens).toBeGreaterThan(0);
  });

  it('estimateTokensMixed counts CJK differently', () => {
    const enTokens = estimateTokensMixed([{ role: 'user', content: 'Hello world' }]);
    const zhTokens = estimateTokensMixed([{ role: 'user', content: '你好世界' }]);
    // Both should return positive numbers
    expect(enTokens).toBeGreaterThan(0);
    expect(zhTokens).toBeGreaterThan(0);
  });
});

describe('Agent', () => {
  const echoTool: AITool = {
    name: 'echo',
    description: 'Echo back the input',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to echo' } },
      required: ['text'],
    },
    execute: (params) => `Echo: ${params.text}`,
  };

  it('constructs with defaults', () => {
    const agent = new Agent(mockClient);
    expect(agent).toBeDefined();
    expect(agent.getMemory()).toHaveLength(1); // system prompt
  });

  it('constructs with custom system prompt', () => {
    const agent = new Agent(mockClient, { systemPrompt: 'Custom prompt' });
    expect(agent.getMemory()[0].content).toBe('Custom prompt');
  });

  it('addTool and removeTool', () => {
    const agent = new Agent(mockClient);
    agent.addTool(echoTool);
    expect(agent.getTools()).toHaveLength(1);

    agent.removeTool('echo');
    expect(agent.getTools()).toHaveLength(0);
  });

  it('setSystemPrompt updates', () => {
    const agent = new Agent(mockClient, { systemPrompt: 'Old' });
    agent.setSystemPrompt('New');
    expect(agent.getMemory()[0].content).toBe('New');
  });

  it('clearMemory preserves system prompt', () => {
    const agent = new Agent(mockClient, { systemPrompt: 'System' });
    agent.clearMemory();
    expect(agent.getMemory()).toHaveLength(1);
  });

  it('tokenCount works', () => {
    const agent = new Agent(mockClient, { systemPrompt: 'You are helpful' });
    expect(agent.tokenCount()).toBeGreaterThan(0);
  });
});
