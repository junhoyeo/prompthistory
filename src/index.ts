#!/usr/bin/env node

import { program } from 'commander';
import { homedir } from 'node:os';
import { join } from 'node:path';
import chalk from 'chalk';
import { parseHistory } from './core/parser.js';
import { HistorySearchEngine } from './core/search.js';
import { formatSearchResults, formatDetailedResult } from './utils/formatter.js';
import type { SearchOptions } from './types/history.js';

const DEFAULT_HISTORY_PATH = join(homedir(), '.claude', 'history.jsonl');

program
  .name('prompthistory')
  .description('CLI tool to search and navigate OpenCode prompt history')
  .version('0.1.0');

program
  .command('search')
  .description('Search through prompt history')
  .argument('[query]', 'search term')
  .option('-p, --project <project>', 'filter by project path')
  .option('-f, --from <date>', 'filter from date (YYYY-MM-DD)')
  .option('-t, --to <date>', 'filter to date (YYYY-MM-DD)')
  .option('-l, --limit <number>', 'limit number of results', '20')
  .option('-u, --unique', 'show only unique prompts')
  .option('--include-slash-commands', 'include slash commands in results')
  .action(async (query, options) => {
    try {
      const entries = await parseHistory(DEFAULT_HISTORY_PATH);
      const searchEngine = new HistorySearchEngine(entries);

      const searchOptions: SearchOptions = {
        query,
        project: options.project,
        from: options.from ? new Date(options.from) : undefined,
        to: options.to ? new Date(options.to) : undefined,
        limit: parseInt(options.limit, 10),
        unique: options.unique,
        includeSlashCommands: options.includeSlashCommands,
      };

      const results = searchEngine.search(searchOptions);
      console.log(formatSearchResults(results));
      console.log(chalk.dim(`\nFound ${results.length} results`));
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
  .option('--include-slash-commands', 'include slash commands in results')
  .action(async (options) => {
    try {
      const entries = await parseHistory(DEFAULT_HISTORY_PATH);
      const sorted = entries
        .sort((a, b) => b.timestamp - a.timestamp);

      const searchEngine = new HistorySearchEngine(sorted);
      const results = searchEngine.search({
        project: options.project,
        limit: parseInt(options.limit, 10),
        includeSlashCommands: options.includeSlashCommands,
      });

      console.log(formatSearchResults(results));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('show')
  .description('Show detailed information about a specific prompt')
  .argument('<index>', 'index from search/list results')
  .action(async (index) => {
    try {
      const entries = await parseHistory(DEFAULT_HISTORY_PATH);
      const idx = parseInt(index, 10) - 1;
      
      if (idx < 0 || idx >= entries.length) {
        console.error(chalk.red('Error: Invalid index'));
        process.exit(1);
      }

      const sorted = entries.sort((a, b) => b.timestamp - a.timestamp);
      console.log(formatDetailedResult({ entry: sorted[idx] }));
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
