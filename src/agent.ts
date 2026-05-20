/**
 * AI Agent with real function calling, conversation memory, and streaming.
 *
 * Features:
 * - Native function calling via provider tool API (not string parsing)
 * - Automatic tool execution loop
 * - Token-aware memory management
 * - Streaming output
 * - Multi-turn conversation with context
 */

import { AIClient } from './provider.js';
import { MemoryManager } from './memory.js';
import type {
  AgentOptions,
  AIMessage,
  AITool,
  AIToolCall,
  StreamChunk,
} from './types.js';

export class Agent {
  private client: AIClient;
  private tools: Map<string, AITool>;
  private memory: MemoryManager;
  private options: Required<Omit<AgentOptions, 'tools'>>;
  private toolList: AITool[];

  constructor(client: AIClient, options: AgentOptions = {}) {
    this.client = client;
    this.tools = new Map();
    this.toolList = [];

    this.options = {
      systemPrompt: options.systemPrompt || 'You are a helpful AI assistant.',
      model: options.model || '',
      temperature: options.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? 4096,
      maxMemoryTokens: options.maxMemoryTokens ?? 8000,
    };

    this.memory = new MemoryManager({
      maxTokens: this.options.maxMemoryTokens,
    });
    this.memory.setSystemPrompt(this.options.systemPrompt);

    if (options.tools) {
      for (const tool of options.tools) {
        this.addTool(tool);
      }
    }
  }

  // ---- Tools ----

  addTool(tool: AITool): this {
    this.tools.set(tool.name, tool);
    this.toolList.push(tool);
    return this;
  }

  removeTool(name: string): this {
    this.tools.delete(name);
    this.toolList = this.toolList.filter((t) => t.name !== name);
    return this;
  }

  getTools(): AITool[] {
    return [...this.toolList];
  }

  // ---- Conversation ----

  async run(userInput: string): Promise<string> {
    this.memory.add({ role: 'user', content: userInput });

    const providerOptions = {
      model: this.options.model || undefined,
      temperature: this.options.temperature,
      maxTokens: this.options.maxTokens,
      tools: this.toolList.length > 0 ? this.toolList : undefined,
    };

    const response = await this.client.chat(
      this.memory.getAll(),
      providerOptions
    );

    // Handle tool calls with automatic loop
    if (response.toolCalls && response.toolCalls.length > 0) {
      return this.handleToolCalls(response.toolCalls);
    }

    this.memory.add({
      role: 'assistant',
      content: response.content,
    });

    return response.content;
  }

  async *stream(userInput: string): AsyncIterable<string> {
    this.memory.add({ role: 'user', content: userInput });

    const providerOptions = {
      model: this.options.model || undefined,
      temperature: this.options.temperature,
      maxTokens: this.options.maxTokens,
      tools: this.toolList.length > 0 ? this.toolList : undefined,
    };

    let fullContent = '';

    for await (const chunk of this.client.stream(
      this.memory.getAll(),
      providerOptions
    )) {
      if (chunk.content) {
        fullContent += chunk.content;
        yield chunk.content;
      }
    }

    this.memory.add({ role: 'assistant', content: fullContent });
  }

  // ---- Tool execution loop ----

  private async handleToolCalls(toolCalls: AIToolCall[]): Promise<string> {
    const results: string[] = [];

    for (const tc of toolCalls) {
      const tool = this.tools.get(tc.name);
      if (!tool) {
        results.push(`Error: unknown tool "${tc.name}"`);
        continue;
      }

      try {
        const result = await tool.execute(tc.arguments);
        results.push(result);
      } catch (err: any) {
        results.push(`Error executing ${tc.name}: ${err.message}`);
      }
    }

    // Feed tool results back to the LLM
    this.memory.addMany([
      {
        role: 'assistant',
        content: '',
        name: undefined,
      },
      ...toolCalls.map((tc, i) => ({
        role: 'tool' as const,
        content: results[i],
        tool_call_id: tc.id,
      })),
    ]);

    // Run again to get the final response
    const followUp = await this.client.chat(
      this.memory.getAll(),
      {
        model: this.options.model || undefined,
        temperature: this.options.temperature,
        maxTokens: this.options.maxTokens,
      }
    );

    this.memory.add({
      role: 'assistant',
      content: followUp.content,
    });

    return followUp.content;
  }

  // ---- Memory ----

  getMemory(): AIMessage[] {
    return this.memory.getAll();
  }

  clearMemory(): void {
    this.memory.clear(true);
  }

  tokenCount(): number {
    return this.memory.tokenCount();
  }

  setSystemPrompt(prompt: string): void {
    this.options.systemPrompt = prompt;
    this.memory.setSystemPrompt(prompt);
  }
}
