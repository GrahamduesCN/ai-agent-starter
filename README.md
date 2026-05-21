# AI Agent Starter

Multi-provider AI agent framework with **real** function calling, conversation memory, and streaming output.

## What this actually is

A TypeScript library that lets you:

- Call LLMs from **OpenAI**, **Anthropic**, or **Ollama** (local) through one unified API
- Give agents tools (functions) they can call — using native `function calling`, not string parsing
- Manage conversation memory with automatic token-aware pruning
- Stream responses in real-time
- Run as a CLI (`npx ai-agent-starter chat`) or import as a library

## What this is NOT

- Not a no-code drag-and-drop AI builder
- Not a production SaaS with a dashboard
- Does not include a web UI

## Quick Start

### Install

```bash
npm install ai-agent-starter
```

### Use in code

```typescript
import { Agent, AIClient, OpenAIProvider } from 'ai-agent-starter';

const client = new AIClient(
  new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY! })
);

const agent = new Agent(client, {
  systemPrompt: 'You are a helpful assistant.',
  tools: [
    {
      name: 'get_weather',
      description: 'Get current weather for a city',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'City name' }
        },
        required: ['city']
      },
      execute: async (params) => {
        // Call your weather API here
        return `Weather in ${params.city}: 22°C, sunny`;
      }
    }
  ]
});

// One-shot
const answer = await agent.run('What is the weather in Tokyo?');
console.log(answer);

// Streaming
for await (const chunk of agent.stream('Tell me a story')) {
  process.stdout.write(chunk);
}
```

### CLI

```bash
# Set your API key
export OPENAI_API_KEY=sk-...

# Interactive chat
npx ai-agent-starter chat

# One-shot
npx ai-agent-starter run "Explain quantum computing in one sentence"

# HTTP API server
npx ai-agent-starter serve --port 3000
# Then: curl -X POST http://localhost:3000/chat -d '{"messages":"hello"}'
```

### Other providers

```typescript
// Anthropic
import { AnthropicProvider } from 'ai-agent-starter';
const client = new AIClient(
  new AnthropicProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
);

// Ollama (local)
import { OllamaProvider } from 'ai-agent-starter';
const client = new AIClient(
  new OllamaProvider({ baseURL: 'http://localhost:11434' })
);
```

## API Reference

### `AIClient`

Unified interface for all providers.

| Method | Description |
|--------|-------------|
| `ask(prompt, systemPrompt?)` | Simple one-shot question, returns string |
| `chat(messages, options?)` | Full chat with tools, returns `AIResponse` |
| `stream(messages, options?)` | Streaming chat, returns `AsyncIterable<StreamChunk>` |
| `setProvider(provider)` | Switch provider at runtime |

### `Agent`

Stateful agent with memory and tools.

| Method | Description |
|--------|-------------|
| `run(input)` | Process user input, execute tools, return response |
| `stream(input)` | Same as `run()` but yields tokens as they arrive |
| `addTool(tool)` | Register a tool the agent can call |
| `removeTool(name)` | Remove a tool |
| `getMemory()` | Get full conversation history |
| `clearMemory()` | Reset conversation (keeps system prompt) |
| `setSystemPrompt(text)` | Change system prompt |
| `tokenCount()` | Estimated token count of current memory |

### `AITool`

```typescript
interface AITool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
  execute(params: Record<string, unknown>): Promise<string> | string;
}
```

### `MemoryManager`

```typescript
const mem = new MemoryManager({ maxTokens: 8000 });
mem.add({ role: 'user', content: '...' });
mem.setSystemPrompt('You are helpful.');
mem.clear(); // keeps system prompt
mem.tokenCount(); // estimated tokens
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | (required for OpenAI) |
| `OPENAI_BASE_URL` | OpenAI-compatible endpoint | `https://api.openai.com/v1` |
| `ANTHROPIC_API_KEY` | Anthropic API key | (required for Anthropic) |
| `OLLAMA_BASE_URL` | Ollama server URL | `http://localhost:11434` |
| `AI_PROVIDER` | `openai` / `anthropic` / `ollama` | `openai` |
| `AI_MODEL` | Override default model | provider default |

## Running Tests

```bash
npm test
```

24 tests covering providers, agent, memory, and token counting.

## License

MIT

## Related Projects

| Project | Description |
|---------|-------------|
| [dev-cli-kit](https://github.com/GrahamduesCN/dev-cli-kit) | Developer CLI toolkit with project scaffolding and code generation |
| [nextjs-saas-starter](https://github.com/GrahamduesCN/nextjs-saas-starter) | Next.js 14 SaaS starter with dashboard, auth pages, and billing |
| [ai-chat-saas](https://github.com/GrahamduesCN/ai-chat-saas) | Complete AI chat app built with this framework ($19 template) |

## Support

If you find this useful, consider starring the repo ⭐.
