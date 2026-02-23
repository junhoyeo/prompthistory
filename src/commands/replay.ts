import chalk from 'chalk';
import { select, input, confirm } from '@inquirer/prompts';
import type { EnrichedEntry } from '../types/history.js';
import type { Provider, PromptResult, ReplayOptions } from '../types/test.js';
import { runPrompt, getDefaultModel, getAvailableModels } from '../core/provider.js';
import { savePromptResult, getPromptResult } from '../core/test-db.js';

function formatCost(cost: number | undefined): string {
  if (!cost) return 'N/A';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

export async function replayPrompt(
  entry: EnrichedEntry,
  options: ReplayOptions = {}
): Promise<PromptResult> {
  const provider = options.provider || 'openai';
  const model = options.model || getDefaultModel(provider);

  console.log(chalk.cyan('\n📤 Sending prompt to'), chalk.bold(`${provider}/${model}`));
  console.log(chalk.dim('─'.repeat(50)));

  const result = await runPrompt(entry.display, {
    provider,
    model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  });

  if (options.save !== false) {
    savePromptResult(result, entry.sessionId, 'replay');
  }

  return result;
}

export function displayReplayResult(result: PromptResult): void {
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.green('\n📥 Response:'));
  console.log(result.response);
  console.log(chalk.dim('\n─'.repeat(50)));
  console.log(
    chalk.dim('Stats:'),
    chalk.cyan(`${result.latencyMs}ms`),
    chalk.dim('|'),
    chalk.cyan(`${formatTokens(result.totalTokens)} tokens`),
    chalk.dim('|'),
    chalk.cyan(formatCost(result.cost))
  );
}

export async function interactiveReplay(entry: EnrichedEntry): Promise<PromptResult | null> {
  console.log(chalk.bold.cyan('\n🔄 Replay Prompt'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.dim('Original prompt:'));
  console.log(entry.display.substring(0, 500) + (entry.display.length > 500 ? '...' : ''));
  console.log();

  const provider = (await select({
    message: 'Select provider:',
    choices: [
      { name: 'OpenAI', value: 'openai' },
      { name: 'Anthropic', value: 'anthropic' },
    ],
  })) as Provider;

  const models = getAvailableModels(provider);
  const model = await select({
    message: 'Select model:',
    choices: models.map((m) => ({ name: m, value: m })),
    default: getDefaultModel(provider),
  });

  const customizeSettings = await confirm({
    message: 'Customize temperature/max tokens?',
    default: false,
  });

  let temperature: number | undefined;
  let maxTokens: number | undefined;

  if (customizeSettings) {
    const tempInput = await input({
      message: 'Temperature (0.0-2.0, empty for default):',
      validate: (v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) <= 2),
    });
    if (tempInput) temperature = parseFloat(tempInput);

    const tokensInput = await input({
      message: 'Max tokens (empty for default):',
      validate: (v) => !v || (!isNaN(parseInt(v)) && parseInt(v) > 0),
    });
    if (tokensInput) maxTokens = parseInt(tokensInput);
  }

  const result = await replayPrompt(entry, {
    provider,
    model,
    temperature,
    maxTokens,
    save: true,
  });

  displayReplayResult(result);

  return result;
}

export function displayStoredResult(id: string): PromptResult | null {
  const result = getPromptResult(id);
  if (!result) {
    console.log(chalk.red(`Result not found: ${id}`));
    return null;
  }

  console.log(chalk.bold.cyan('\n📋 Stored Result'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.dim('ID:'), result.id);
  console.log(chalk.dim('Provider:'), `${result.provider}/${result.model}`);
  console.log(chalk.dim('Time:'), new Date(result.timestamp).toLocaleString());
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.cyan('Prompt:'));
  console.log(result.prompt.substring(0, 300) + (result.prompt.length > 300 ? '...' : ''));
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.green('Response:'));
  console.log(result.response);
  console.log(chalk.dim('─'.repeat(50)));
  console.log(
    chalk.dim('Stats:'),
    chalk.cyan(`${result.latencyMs}ms`),
    chalk.dim('|'),
    chalk.cyan(`${formatTokens(result.totalTokens)} tokens`),
    chalk.dim('|'),
    chalk.cyan(formatCost(result.cost))
  );

  return result;
}
