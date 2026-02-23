import type { Provider, ProviderConfig, PromptResult } from '../types/test.js';

// Cost per 1M tokens (as of 2024)
const PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI models
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
  'o1': { input: 15, output: 60 },
  'o1-mini': { input: 3, output: 12 },
  'o1-preview': { input: 15, output: 60 },
  // Anthropic models
  'claude-3-5-sonnet-20241022': { input: 3, output: 15 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4 },
  'claude-3-opus-20240229': { input: 15, output: 75 },
  'claude-3-sonnet-20240229': { input: 3, output: 15 },
  'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
};

function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

function generateId(): string {
  return `pr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export interface LLMProvider {
  name: Provider;
  run(prompt: string, config: ProviderConfig): Promise<PromptResult>;
}

/**
 * OpenAI Provider
 */
export class OpenAIProvider implements LLMProvider {
  name: Provider = 'openai';

  async run(prompt: string, config: ProviderConfig): Promise<PromptResult> {
    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable.');
    }

    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey,
      baseURL: config.baseUrl,
    });

    const startTime = performance.now();

    const response = await client.chat.completions.create({
      model: config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: config.maxTokens,
      temperature: config.temperature,
    });

    const latencyMs = Math.round(performance.now() - startTime);
    const choice = response.choices[0];
    const usage = response.usage;

    const inputTokens = usage?.prompt_tokens || 0;
    const outputTokens = usage?.completion_tokens || 0;
    const totalTokens = usage?.total_tokens || inputTokens + outputTokens;

    return {
      id: generateId(),
      prompt,
      response: choice?.message?.content || '',
      provider: 'openai',
      model: config.model,
      timestamp: Date.now(),
      latencyMs,
      inputTokens,
      outputTokens,
      totalTokens,
      cost: calculateCost(config.model, inputTokens, outputTokens),
      metadata: {
        finishReason: choice?.finish_reason,
        responseId: response.id,
      },
    };
  }
}

/**
 * Anthropic Provider
 */
export class AnthropicProvider implements LLMProvider {
  name: Provider = 'anthropic';

  async run(prompt: string, config: ProviderConfig): Promise<PromptResult> {
    const apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('Anthropic API key not found. Set ANTHROPIC_API_KEY environment variable.');
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey,
      baseURL: config.baseUrl,
    });

    const startTime = performance.now();

    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens || 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const latencyMs = Math.round(performance.now() - startTime);

    const textContent = response.content.find((c) => c.type === 'text');
    const responseText = textContent?.type === 'text' ? textContent.text : '';

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;

    return {
      id: generateId(),
      prompt,
      response: responseText,
      provider: 'anthropic',
      model: config.model,
      timestamp: Date.now(),
      latencyMs,
      inputTokens,
      outputTokens,
      totalTokens,
      cost: calculateCost(config.model, inputTokens, outputTokens),
      metadata: {
        stopReason: response.stop_reason,
        responseId: response.id,
      },
    };
  }
}

/**
 * Provider factory
 */
export function createProvider(provider: Provider): LLMProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      return new AnthropicProvider();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Run a prompt with the specified configuration
 */
export async function runPrompt(prompt: string, config: ProviderConfig): Promise<PromptResult> {
  const provider = createProvider(config.provider);
  return provider.run(prompt, config);
}

/**
 * Get default model for a provider
 */
export function getDefaultModel(provider: Provider): string {
  switch (provider) {
    case 'openai':
      return 'gpt-4o-mini';
    case 'anthropic':
      return 'claude-3-5-sonnet-20241022';
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * List available models for a provider
 */
export function getAvailableModels(provider: Provider): string[] {
  switch (provider) {
    case 'openai':
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o1-preview'];
    case 'anthropic':
      return [
        'claude-3-5-sonnet-20241022',
        'claude-3-5-haiku-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ];
    default:
      return [];
  }
}
