/**
 * AI Agent Starter — entry point.
 *
 * Usage:
 *   import { Agent, AIClient, OpenAIProvider } from 'ai-agent-starter';
 *
 * CLI:
 *   npx ai-agent-starter chat    — interactive chat
 *   npx ai-agent-starter run "..." — one-shot
 */

export { AIClient, OpenAIProvider, AnthropicProvider, OllamaProvider } from './provider.js';
export { Agent } from './agent.js';
export { MemoryManager, estimateTokens } from './memory.js';
export type {
  AIMessage,
  AIResponse,
  AIUsage,
  AIProvider,
  AITool,
  AIToolCall,
  AgentOptions,
  ProviderChatOptions,
} from './types.js';

// ---- CLI entry ----
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { AIClient, OpenAIProvider, AnthropicProvider, OllamaProvider } from './provider.js';
import { Agent } from './agent.js';
import type { AIProvider, AITool } from './types.js';

// Built-in tools
const builtinTools: AITool[] = [
  {
    name: 'get_current_time',
    description: 'Get the current date and time.',
    parameters: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
    execute: () => new Date().toISOString(),
  },
  {
    name: 'calculate',
    description: 'Evaluate a mathematical expression.',
    parameters: {
      type: 'object' as const,
      properties: {
        expression: {
          type: 'string',
          description: 'A math expression, e.g. "2 + 2 * 3"',
        },
      },
      required: ['expression'],
    },
    execute: (params: Record<string, unknown>) => {
      const expr = String(params.expression);
      try {
        // Safe eval using Function
        const result = new Function(`return (${expr})`)();
        return String(result);
      } catch {
        return `Error: cannot evaluate "${expr}"`;
      }
    },
  },
];

function createProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER || 'openai';

  switch (provider) {
    case 'anthropic':
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY not set');
      }
      return new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });

    case 'ollama':
      return new OllamaProvider({
        baseURL: process.env.OLLAMA_BASE_URL,
      });

    case 'openai':
    default: {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          'OPENAI_API_KEY not set. Export it or use AI_PROVIDER=ollama for local models.'
        );
      }
      return new OpenAIProvider({
        apiKey,
        baseURL: process.env.OPENAI_BASE_URL,
      });
    }
  }
}

async function chatMode() {
  const provider = createProvider();
  const client = new AIClient(provider);
  const agent = new Agent(client, {
    systemPrompt: 'You are a helpful AI assistant.',
    tools: builtinTools,
    model: process.env.AI_MODEL || undefined,
  });

  console.log('AI Agent Starter — interactive chat');
  console.log(`Provider: ${process.env.AI_PROVIDER || 'openai'}`);
  console.log('Type /quit to exit, /clear to reset conversation.\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = () => {
    rl.question('You: ', async (input) => {
      if (input === '/quit') {
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      }
      if (input === '/clear') {
        agent.clearMemory();
        console.log('— Conversation cleared —\n');
        return ask();
      }
      if (!input.trim()) return ask();

      process.stdout.write('AI: ');
      try {
        for await (const chunk of agent.stream(input)) {
          process.stdout.write(chunk);
        }
        process.stdout.write('\n\n');
      } catch (err: any) {
        console.error(`\nError: ${err.message}\n`);
      }
      ask();
    });
  };

  ask();
}

async function runMode(prompt: string) {
  const provider = createProvider();
  const client = new AIClient(provider);
  const agent = new Agent(client, {
    systemPrompt: 'You are a helpful AI assistant.',
    tools: builtinTools,
    model: process.env.AI_MODEL || undefined,
  });

  try {
    const answer = await agent.run(prompt);
    console.log(answer);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function serveMode(port: number) {
  // Simple HTTP API server
  const http = await import('node:http');
  const provider = createProvider();
  const client = new AIClient(provider);

  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'POST' && req.url === '/chat') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', async () => {
        try {
          const { messages, systemPrompt } = JSON.parse(body);
          const agent = new Agent(client, {
            systemPrompt: systemPrompt || 'You are a helpful AI assistant.',
            tools: builtinTools,
          });
          const answer = await agent.run(
            typeof messages === 'string' ? messages : messages[messages.length - 1]?.content || ''
          );
          res.end(JSON.stringify({ response: answer }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
        }
      });
    } else if (req.url === '/health') {
      res.end(JSON.stringify({ status: 'ok' }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });

  server.listen(port, () => {
    console.log(`AI Agent API server running on http://localhost:${port}`);
    console.log('Endpoints: POST /chat, GET /health');
  });
}

// ---- Main ----

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('chat')) {
    return chatMode();
  }

  if (args.includes('serve')) {
    const portIdx = args.indexOf('--port');
    const port = portIdx >= 0 ? parseInt(args[portIdx + 1]) || 3000 : 3000;
    return serveMode(port);
  }

  // run mode (default)
  const prompt = args.join(' ');
  if (prompt) {
    return runMode(prompt);
  }

  // No args — show help
  console.log(`AI Agent Starter v0.2.0

Usage:
  ai-agent-starter chat          Interactive chat mode
  ai-agent-starter run "prompt"   One-shot completion
  ai-agent-starter serve          Start HTTP API server (--port 3000)

Environment:
  OPENAI_API_KEY       OpenAI API key
  ANTHROPIC_API_KEY    Anthropic API key
  AI_PROVIDER          openai | anthropic | ollama
  AI_MODEL             Override default model
`);
}

// Only run CLI if this is the main module
const isMain = process.argv[1]?.includes('index');
if (isMain) {
  main().catch((err) => {
    console.error('Fatal:', err.message);
    process.exit(1);
  });
}
