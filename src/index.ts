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
        console.log(formatSearchResults(results));
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

      console.log(formatSearchResults(results));
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

program.parse();
