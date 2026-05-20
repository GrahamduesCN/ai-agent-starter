/**
 * AI Agent Framework - Auto-generated
 */

import { AIClient, AIMessage } from './provider.js';

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute(params: Record<string, any>): Promise<string>;
}

export class Agent {
  private client: AIClient;
  private tools: Map<string, AgentTool>;
  private memory: AIMessage[];

  constructor(client: AIClient, options?: { systemPrompt?: string }) {
    this.client = client;
    this.tools = new Map();
    this.memory = [];
    if (options?.systemPrompt) {
      this.memory.push({ role: 'system', content: options.systemPrompt });
    }
  }

  addTool(tool: AgentTool) {
    this.tools.set(tool.name, tool);
  }

  async run(userInput: string): Promise<string> {
    this.memory.push({ role: 'user', content: userInput });
    
    const response = await this.client.chat(this.memory);
    this.memory.push({ role: 'assistant', content: response.content });
    
    // 检查是否需要调用工具
    if (response.content.includes('[TOOL:')) {
      return this.executeTool(response.content);
    }
    
    return response.content;
  }

  private async executeTool(response: string): Promise<string> {
    // 简单的工具调用解析
    const toolMatch = response.match(/\[TOOL:(\w+)\(([^)]*)\)\]/);
    if (toolMatch) {
      const toolName = toolMatch[1];
      const toolArgs = toolMatch[2];
      const tool = this.tools.get(toolName);
      if (tool) {
        try {
          const params = JSON.parse(toolArgs);
          return tool.execute(params);
        } catch {
          return tool.execute({ input: toolArgs });
        }
      }
    }
    return response;
  }

  getMemory(): AIMessage[] {
    return [...this.memory];
  }

  clearMemory() {
    this.memory = this.memory.slice(0, 1); // 保留 system prompt
  }
}
