/**
 * Multi-provider AI client with streaming support.
 *
 * Supported: OpenAI, Anthropic, Ollama (local)
 */

import type {
  AIProvider,
  AIMessage,
  AIResponse,
  AITool,
  AIToolCall,
  ProviderChatOptions,
  StreamChunk,
  AIUsage,
} from './types.js';

// ============================================================
// OpenAI Provider (uses official openai SDK)
// ============================================================

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private baseURL: string;

  constructor(config: { apiKey: string; baseURL?: string }) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.openai.com/v1';
  }

  async chat(
    messages: AIMessage[],
    options: ProviderChatOptions = {}
  ): Promise<AIResponse> {
    const body: Record<string, unknown> = {
      model: options.model || 'gpt-4o',
      messages: toOpenAIMessages(messages),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(toolToOpenAI);
      body.tool_choice = options.toolChoice || 'auto';
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as any;
    const choice = data.choices[0];
    const msg = choice.message;

    const toolCalls: AIToolCall[] | undefined = msg.tool_calls?.map(
      (tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments),
      })
    );

    return {
      content: msg.content || '',
      usage: toUsage(data.usage),
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  async *stream(
    messages: AIMessage[],
    options: ProviderChatOptions = {}
  ): AsyncIterable<StreamChunk> {
    const body: Record<string, unknown> = {
      model: options.model || 'gpt-4o',
      messages: toOpenAIMessages(messages),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(toolToOpenAI);
      body.tool_choice = options.toolChoice || 'auto';
    }

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI stream error ${response.status}: ${err}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const json = trimmed.slice(6);
        if (json === '[DONE]') {
          yield { content: '', done: true };
          return;
        }
        try {
          const parsed = JSON.parse(json);
          const delta = parsed.choices?.[0]?.delta;
          const content = delta?.content || '';
          if (parsed.usage) {
            yield { content, done: false, usage: toUsage(parsed.usage) };
          } else {
            yield { content, done: false };
          }
        } catch {
          // skip unparseable chunks
        }
      }
    }
  }
}

// ============================================================
// Anthropic Provider
// ============================================================

export class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private baseURL: string;

  constructor(config: { apiKey: string; baseURL?: string }) {
    this.apiKey = config.apiKey;
    this.baseURL = config.baseURL || 'https://api.anthropic.com';
  }

  async chat(
    messages: AIMessage[],
    options: ProviderChatOptions = {}
  ): Promise<AIResponse> {
    const systemMsg = messages.filter((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      messages: chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMsg.length > 0) {
      body.system = systemMsg.map((m) => m.content).join('\n');
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(toolToAnthropic);
    }

    const response = await fetch(`${this.baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as any;
    let content = '';
    const toolCalls: AIToolCall[] = [];

    for (const block of data.content) {
      if (block.type === 'text') content += block.text;
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        });
      }
    }

    return {
      content,
      usage: toUsage(data.usage),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  async *stream(
    messages: AIMessage[],
    options: ProviderChatOptions = {}
  ): AsyncIterable<StreamChunk> {
    const systemMsg = messages.filter((m) => m.role === 'system');
    const chatMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      model: options.model || 'claude-sonnet-4-20250514',
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      messages: chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    };

    if (systemMsg.length > 0) {
      body.system = systemMsg.map((m) => m.content).join('\n');
    }

    if (options.tools && options.tools.length > 0) {
      body.tools = options.tools.map(toolToAnthropic);
    }

    const response = await fetch(`${this.baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic stream error ${response.status}: ${err}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const json = trimmed.slice(6);
        try {
          const parsed = JSON.parse(json);
          if (parsed.type === 'content_block_delta') {
            yield {
              content: parsed.delta?.text || '',
              done: false,
            };
          }
          if (parsed.type === 'message_stop') {
            yield { content: '', done: true };
            return;
          }
        } catch {
          // skip
        }
      }
    }
  }
}

// ============================================================
// Ollama Provider (local, OpenAI-compatible endpoint)
// ============================================================

export class OllamaProvider implements AIProvider {
  private baseURL: string;

  constructor(config: { baseURL?: string }) {
    this.baseURL = config.baseURL || 'http://localhost:11434';
  }

  async chat(
    messages: AIMessage[],
    options: ProviderChatOptions = {}
  ): Promise<AIResponse> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || 'llama3',
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: false,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 4096,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama API error ${response.status}: ${err}`);
    }

    const data = (await response.json()) as any;
    return {
      content: data.message?.content || '',
    };
  }

  async *stream(
    messages: AIMessage[],
    options: ProviderChatOptions = {}
  ): AsyncIterable<StreamChunk> {
    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model || 'llama3',
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        options: {
          temperature: options.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 4096,
        },
      }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.done) {
            yield { content: '', done: true };
            return;
          }
          yield {
            content: parsed.message?.content || '',
            done: false,
          };
        } catch {
          // skip
        }
      }
    }
  }
}

// ============================================================
// AIClient — unified interface
// ============================================================

export class AIClient {
  private provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  /** Simple one-shot question */
  async ask(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: AIMessage[] = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });
    const resp = await this.provider.chat(messages);
    return resp.content;
  }

  /** Full chat with tools */
  async chat(
    messages: AIMessage[],
    options?: ProviderChatOptions
  ): Promise<AIResponse> {
    return this.provider.chat(messages, options);
  }

  /** Streaming chat */
  stream(
    messages: AIMessage[],
    options?: ProviderChatOptions
  ): AsyncIterable<StreamChunk> {
    if (!this.provider.stream) {
      throw new Error('Streaming not supported by this provider');
    }
    return this.provider.stream(messages, options);
  }

  setProvider(provider: AIProvider) {
    this.provider = provider;
  }
}

// ============================================================
// Helpers
// ============================================================

function toUsage(raw: any): AIUsage | undefined {
  if (!raw) return undefined;
  return {
    promptTokens: raw.prompt_tokens ?? raw.input_tokens ?? 0,
    completionTokens: raw.completion_tokens ?? raw.output_tokens ?? 0,
    totalTokens: raw.total_tokens ?? 0,
  };
}

function toOpenAIMessages(messages: AIMessage[]) {
  return messages.map((m) => {
    const out: Record<string, unknown> = { role: m.role, content: m.content };
    if (m.name) out.name = m.name;
    if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
    return out;
  });
}

function toolToOpenAI(tool: AITool) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}

function toolToAnthropic(tool: AITool) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      properties: tool.parameters.properties,
      required: tool.parameters.required,
    },
  };
}
