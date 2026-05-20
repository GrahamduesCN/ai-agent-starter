/**
 * Example usage - Auto-generated
 */
import { openai } from '@ai-sdk/openai';
import { AIClient, OpenAIProvider } from './provider.js';
import { Agent } from './agent.js';

async function main() {
  // 初始化客户端
  const client = new AIClient(
    new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY || '' })
  );

  // 创建 Agent
  const agent = new Agent(client, {
    systemPrompt: 'You are a helpful AI assistant.'
  });

  // 运行对话
  const response = await agent.run('Hello! What can you do?');
  console.log('AI:', response);
}

main().catch(console.error);
