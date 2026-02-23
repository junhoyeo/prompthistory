import { program } from 'commander';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import chalk from 'chalk';
import clipboard from 'clipboardy';
import { select } from '@inquirer/prompts';
import { parseHistory, getOpenCodeDbPath, openCodeDbExists } from './core/parser.js';
import { HistorySearchEngine } from './core/search.js';
import { formatSearchResults, formatDetailedResult } from './utils/formatter.js';
import { parseRelativeDate } from './utils/date.js';
import type { SearchOptions, SearchResult } from './types/history.js';
import type { Provider } from './types/test.js';
import { replayPrompt, displayReplayResult, interactiveReplay } from './commands/replay.js';
import {
  addTestFromEntry,
  addTestInteractive,
  listTests,
  showTest,
  removeTest,
  runTests,
  runSingleTestByName,
} from './commands/test.js';
import { compareByIds, displaySideBySide } from './commands/compare.js';
import { getPromptResult, getPromptResults } from './core/test-db.js';
import { getDefaultModel } from './core/provider.js';
import { registerStatsCommand } from './commands/stats.js';

const LEGACY_HISTORY_PATH = join(homedir(), '.claude', 'history.jsonl');

function getDefaultHistoryPath(): string {
  if (openCodeDbExists()) {
    return getOpenCodeDbPath();
  }
  return LEGACY_HISTORY_PATH;
}

const DEFAULT_HISTORY_PATH = getDefaultHistoryPath();

interface DateOptions {
  from?: string;
  to?: string;
  today?: boolean;
  last7d?: boolean;
}

function resolveDateRange(options: DateOptions): { from?: Date; to?: Date } {
  if (options.today) {
    const range = parseRelativeDate('today');
    return { from: range.from, to: range.to };
  }
  if (options.last7d) {
    const range = parseRelativeDate('last-7d');
    return { from: range.from, to: range.to };
  }
  return {
    from: options.from ? new Date(options.from) : undefined,
    to: options.to ? new Date(options.to) : undefined,
  };
}

function stripInternalFields(entry: SearchResult['entry']): Record<string, unknown> {
  const { _lineNumber, _truncatedDisplay, _isSlashCommand, _isDuplicate, ...clean } = entry;
  return clean;
}

function exportResults(results: SearchResult[], format: string, outputPath?: string): string {
  let content: string;
  
  switch (format) {
    case 'json':
      content = JSON.stringify(results.map(r => stripInternalFields(r.entry)), null, 2);
      break;
    case 'csv': {
      const headers = 'timestamp,project,display,sessionId';
      const rows = results.map(r => {
        const e = r.entry;
        const escapedDisplay = `"${e.display.replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
        return `${e.timestamp},${e.project},${escapedDisplay},${e.sessionId || ''}`;
      });
      content = [headers, ...rows].join('\n');
      break;
    }
    case 'txt':
    default:
      content = results.map(r => r.entry.display).join('\n\n---\n\n');
      break;
  }
  
  if (outputPath) {
    writeFileSync(outputPath, content);
    return `Exported ${results.length} results to ${outputPath}`;
  }
  
  return content;
}

async function interactiveSelect(results: SearchResult[]): Promise<SearchResult | null> {
  if (results.length === 0) {
    console.log(chalk.yellow('No results to select from'));
    return null;
  }

  const choices = results.map((r, i) => ({
    name: `${i + 1}. ${r.entry.display.substring(0, 80)}${r.entry.display.length > 80 ? '...' : ''}`,
    value: i,
    description: `${r.entry.project} - ${new Date(r.entry.timestamp).toLocaleDateString()}`,
  }));

  const selectedIndex = await select({
    message: 'Select a prompt:',
    choices,
    pageSize: 15,
  });

  return results[selectedIndex];
}

async function interactiveCommand(options: { project?: string; limit?: number }): Promise<void> {
  try {
    const entries = await parseHistory(DEFAULT_HISTORY_PATH);
    const searchEngine = new HistorySearchEngine(entries);
    
    const results = searchEngine.search({
      project: options.project,
      limit: options.limit || 20,
    });
    
    const selected = await interactiveSelect(results);
    if (selected) {
      console.log(formatDetailedResult(selected));
    }
  } catch (error) {
    console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

program
  .name('prompthistory')
  .description('CLI tool to search and navigate OpenCode prompt history')
  .version('0.1.0')
  .action(async () => {
    // Launch interactive mode when no command specified
    await interactiveCommand({});
  });

program
  .command('search')
  .description('Search through prompt history')
  .argument('[query]', 'search term')
  .option('-p, --project <project>', 'filter by project path')
  .option('-f, --from <date>', 'filter from date (YYYY-MM-DD)')
  .option('-t, --to <date>', 'filter to date (YYYY-MM-DD)')
  .option('--today', 'filter to today only')
  .option('--last-7d', 'filter to last 7 days')
  .option('-l, --limit <number>', 'limit number of results', '20')
  .option('-u, --unique', 'show only unique prompts')
  .option('--include-slash-commands', 'include slash commands in results')
  .option('--truncate', 'truncate long prompts in output')
  .option('-c, --copy', 'copy selected result to clipboard')
  .option('-i, --interactive', 'interactive mode with arrow key navigation')
  .action(async (query, options) => {
    try {
      const startTime = performance.now();
      const entries = await parseHistory(DEFAULT_HISTORY_PATH);
      const searchEngine = new HistorySearchEngine(entries);

      const dateRange = resolveDateRange(options);
      const searchOptions: SearchOptions = {
        query,
        project: options.project,
        from: dateRange.from,
        to: dateRange.to,
        limit: parseInt(options.limit, 10),
        unique: options.unique,
        includeSlashCommands: options.includeSlashCommands,
      };

      const results = searchEngine.search(searchOptions);
      const elapsed = performance.now() - startTime;

      if (options.interactive || options.copy) {
        const selected = await interactiveSelect(results);
        if (selected) {
          if (options.copy) {
            await clipboard.write(selected.entry.display);
            console.log(chalk.green('Copied to clipboard!'));
          }
          console.log(formatDetailedResult(selected));
        }
      } else {
        console.log(formatSearchResults(results, { truncate: options.truncate }));
        console.log(chalk.dim(`\nFound ${results.length} results in ${elapsed.toFixed(0)}ms`));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('List recent prompts')
  .option('-l, --limit <number>', 'number of prompts to show', '10')
  .option('-p, --project <project>', 'filter by project path')
  .option('-f, --from <date>', 'filter from date (YYYY-MM-DD)')
  .option('-t, --to <date>', 'filter to date (YYYY-MM-DD)')
  .option('--today', 'filter to today only')
  .option('--last-7d', 'filter to last 7 days')
  .option('--include-slash-commands', 'include slash commands in results')
  .option('--truncate', 'truncate long prompts in output')
  .action(async (options) => {
    try {
      const startTime = performance.now();
      const entries = await parseHistory(DEFAULT_HISTORY_PATH);
      const sorted = entries
        .sort((a, b) => b.timestamp - a.timestamp);

      const dateRange = resolveDateRange(options);
      const searchEngine = new HistorySearchEngine(sorted);
      const results = searchEngine.search({
        project: options.project,
        from: dateRange.from,
        to: dateRange.to,
        limit: parseInt(options.limit, 10),
        includeSlashCommands: options.includeSlashCommands,
      });
      const elapsed = performance.now() - startTime;

      console.log(formatSearchResults(results, { truncate: options.truncate }));
      console.log(chalk.dim(`\nLoaded ${entries.length} prompts in ${elapsed.toFixed(0)}ms`));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('show')
  .description('Show detailed information about a specific prompt')
  .argument('<index>', 'index from search/list results')
  .option('-c, --copy', 'copy prompt to clipboard')
  .action(async (index, options) => {
    try {
      const entries = await parseHistory(DEFAULT_HISTORY_PATH);
      const idx = parseInt(index, 10) - 1;
      
      if (idx < 0 || idx >= entries.length) {
        console.error(chalk.red('Error: Invalid index'));
        process.exit(1);
      }

      const sorted = entries.sort((a, b) => b.timestamp - a.timestamp);
      const entry = sorted[idx];
      
      if (options.copy) {
        await clipboard.write(entry.display);
        console.log(chalk.green('Copied to clipboard!'));
      }
      
      console.log(formatDetailedResult({ entry }));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Export search results to file')
  .argument('[query]', 'search term')
  .option('-p, --project <project>', 'filter by project path')
  .option('-f, --from <date>', 'filter from date (YYYY-MM-DD)')
  .option('-t, --to <date>', 'filter to date (YYYY-MM-DD)')
  .option('--today', 'filter to today only')
  .option('--last-7d', 'filter to last 7 days')
  .option('-l, --limit <number>', 'limit number of results', '100')
  .option('--format <format>', 'output format: json, csv, txt', 'json')
  .option('-o, --output <path>', 'output file path')
  .action(async (query, options) => {
    try {
      const entries = await parseHistory(DEFAULT_HISTORY_PATH);
      const searchEngine = new HistorySearchEngine(entries);

      const dateRange = resolveDateRange(options);
      const searchOptions: SearchOptions = {
        query,
        project: options.project,
        from: dateRange.from,
        to: dateRange.to,
        limit: parseInt(options.limit, 10),
      };

      const results = searchEngine.search(searchOptions);
      const output = exportResults(results, options.format, options.output);
      console.log(output);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============ REPLAY COMMAND ============

program
  .command('replay')
  .description('Re-run a prompt with current/different model')
  .argument('<index>', 'index from search/list results')
  .option('--provider <provider>', 'provider to use (openai, anthropic)', 'openai')
  .option('--model <model>', 'model to use')
  .option('--temperature <temp>', 'temperature (0.0-2.0)')
  .option('--max-tokens <tokens>', 'max tokens in response')
  .option('-i, --interactive', 'interactive mode to select provider/model')
  .option('--no-save', 'do not save result to database')
  .action(async (index, options) => {
    try {
      const entries = await parseHistory(DEFAULT_HISTORY_PATH);
      const idx = parseInt(index, 10) - 1;

      if (idx < 0 || idx >= entries.length) {
        console.error(chalk.red('Error: Invalid index'));
        process.exit(1);
      }

      const sorted = entries.sort((a, b) => b.timestamp - a.timestamp);
      const entry = sorted[idx];

      if (options.interactive) {
        await interactiveReplay(entry);
      } else {
        const provider = options.provider as Provider;
        const model = options.model || getDefaultModel(provider);
        const result = await replayPrompt(entry, {
          provider,
          model,
          temperature: options.temperature ? parseFloat(options.temperature) : undefined,
          maxTokens: options.maxTokens ? parseInt(options.maxTokens) : undefined,
          save: options.save,
        });
        displayReplayResult(result);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============ TEST COMMANDS ============

const testCommand = program
  .command('test')
  .description('Manage and run prompt test cases');

testCommand
  .command('add')
  .description('Create a new test case')
  .argument('[name]', 'test case name')
  .option('-i, --interactive', 'create from interactive selection')
  .action(async (name, options) => {
    try {
      if (options.interactive) {
        const entries = await parseHistory(DEFAULT_HISTORY_PATH);
        const sorted = entries.sort((a, b) => b.timestamp - a.timestamp);
        const searchEngine = new HistorySearchEngine(sorted);
        const results = searchEngine.search({ limit: 50 });
        const selected = await interactiveSelect(results);
        if (selected) {
          await addTestFromEntry(selected.entry);
        }
      } else {
        await addTestInteractive();
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

testCommand
  .command('run')
  .description('Run test cases')
  .argument('[name]', 'test case name (runs all if not specified)')
  .option('--provider <provider>', 'override provider')
  .option('--model <model>', 'override model')
  .option('--filter <pattern>', 'filter tests by name pattern')
  .option('--tags <tags>', 'filter by tags (comma-separated)')
  .option('-v, --verbose', 'show detailed output')
  .option('--stop-on-failure', 'stop on first failure')
  .action(async (name, options) => {
    try {
      if (name) {
        await runSingleTestByName(name, {
          provider: options.provider as Provider,
          model: options.model,
        });
      } else {
        await runTests({
          filter: options.filter,
          tags: options.tags?.split(','),
          provider: options.provider as Provider,
          model: options.model,
          verbose: options.verbose,
          stopOnFailure: options.stopOnFailure,
        });
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

testCommand
  .command('list')
  .description('List all test cases')
  .action(() => {
    listTests();
  });

testCommand
  .command('show')
  .description('Show test case details')
  .argument('<name>', 'test case name or ID')
  .action((name) => {
    showTest(name);
  });

testCommand
  .command('delete')
  .description('Delete a test case')
  .argument('<name>', 'test case name or ID')
  .action((name) => {
    removeTest(name);
  });

// ============ COMPARE COMMAND ============

program
  .command('compare')
  .description('Diff two prompt results')
  .argument('<id1>', 'first result ID')
  .argument('<id2>', 'second result ID')
  .option('--side-by-side', 'show side-by-side comparison')
  .action((id1, id2, options) => {
    try {
      const result1 = getPromptResult(id1);
      const result2 = getPromptResult(id2);

      if (!result1) {
        console.log(chalk.red(`Result not found: ${id1}`));
        process.exit(1);
      }
      if (!result2) {
        console.log(chalk.red(`Result not found: ${id2}`));
        process.exit(1);
      }

      if (options.sideBySide) {
        displaySideBySide(result1, result2);
      } else {
        compareByIds(id1, id2);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ============ RESULTS COMMAND ============

program
  .command('results')
  .description('List saved prompt results')
  .option('-l, --limit <number>', 'number of results to show', '20')
  .action((options) => {
    try {
      const results = getPromptResults(parseInt(options.limit));

      if (results.length === 0) {
        console.log(chalk.yellow('No results found. Use "prompthistory replay" to create some.'));
        return;
      }

      console.log(chalk.bold.cyan(`\n📊 Saved Results (${results.length})`));
      console.log(chalk.dim('─'.repeat(70)));

      for (const result of results) {
        const preview = result.prompt.substring(0, 60) + (result.prompt.length > 60 ? '...' : '');
        console.log(
          chalk.dim(result.id.substring(0, 20) + '...'),
          chalk.cyan(`${result.provider}/${result.model}`)
        );
        console.log(chalk.dim(`  ${preview}`));
        console.log(
          chalk.dim(`  ${result.latencyMs}ms | ${result.totalTokens} tokens | ${new Date(result.timestamp).toLocaleString()}`)
        );
        console.log();
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Register stats command
registerStatsCommand(program);

program.parse();
