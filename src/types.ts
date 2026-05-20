/**
 * Core types for AI Agent framework.
 */

// --- Messages ---

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
}

export interface AIResponse {
  content: string;
  usage?: AIUsage;
  toolCalls?: AIToolCall[];
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

// --- Tools ---

export interface AITool {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  execute(params: Record<string, unknown>): Promise<string> | string;
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description: string;
    enum?: string[];
  }>;
  required?: string[];
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

// --- Provider ---

export interface AIProvider {
  /** Chat completion (non-streaming) */
  chat(
    messages: AIMessage[],
    options?: ProviderChatOptions
  ): Promise<AIResponse>;

  /** Chat completion with streaming */
  stream?(
    messages: AIMessage[],
    options?: ProviderChatOptions
  ): AsyncIterable<StreamChunk>;
}

export interface ProviderChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AITool[];
  toolChoice?: 'auto' | 'none' | { name: string };
}

export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: AIUsage;
}

// --- Agent ---

export interface AgentOptions {
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxMemoryTokens?: number;
  tools?: AITool[];
}
