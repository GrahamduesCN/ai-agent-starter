# ai-agent-starter

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/GrahamduesCN/ai-agent-starter/pulls)
[![GitHub stars](https://img.shields.io/github/stars/GrahamduesCN/ai-agent-starter?style=social)](https://github.com/GrahamduesCN/ai-agent-starter)

> Production-ready AI agent framework starter kit - Build AI agents in minutes, not weeks

## ✨ Features

- Multi-provider support (OpenAI, Anthropic, Ollama)
- Built-in tool execution engine
- Conversation memory with compression
- Type-safe agent configuration
- CLI and programmatic API

## 🚀 Quick Start

```bash
npm install ai-agent-starter
npx ai-agent-starter
```

## 📖 Basic Usage

```typescript
import { Agent, OpenAIProvider } from 'ai-agent-starter';

const agent = new Agent({
  provider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }),
  systemPrompt: 'You are a helpful assistant.'
});

const response = await agent.run('Hello!');
console.log(response);
```

## 💖 Support

If this project helps you, please consider:
- ⭐ Starring the repository
- 💰 [Sponsoring on GitHub](https://github.com/sponsors/GrahamduesCN)

## 📄 License

MIT © [GrahamduesCN](https://github.com/GrahamduesCN)\n\n## 💖 Support This Project\n\nIf this project helps you, please support:\n\n| Method | Link |\n|--------|------|\n| PayPal | [paypal.me/GrahamduesCN](https://paypal.me/GrahamduesCN) |\n| Buy Me a Coffee | [buymeacoffee.com/GrahamduesCN](https://www.buymeacoffee.com/GrahamduesCN) |\n| GitHub Sponsor | [github.com/sponsors/GrahamduesCN](https://github.com/sponsors/GrahamduesCN) |\n\nEvery contribution helps keep this project maintained and growing!