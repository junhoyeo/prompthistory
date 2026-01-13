import chalk from 'chalk';
import Table from 'cli-table3';
import { formatDistanceToNow } from 'date-fns';
import type { SearchResult } from '../types/history.js';

export function formatSearchResults(results: SearchResult[], detailed = false): string {
  if (results.length === 0) {
    return chalk.yellow('No results found');
  }

  const table = new Table({
    head: [chalk.cyan('#'), chalk.cyan('Prompt'), chalk.cyan('Project'), chalk.cyan('Time')],
    colWidths: [5, 60, 30, 15],
    wordWrap: true,
  });

  results.forEach((result, index) => {
    const { entry } = result;
    const display = truncate(entry.display, 200);
    const project = entry.project.split('/').pop() || entry.project;
    const timeAgo = formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true });

    table.push([
      chalk.gray((index + 1).toString()),
      display,
      chalk.dim(project),
      chalk.dim(timeAgo),
    ]);
  });

  return table.toString();
}

export function formatDetailedResult(result: SearchResult): string {
  const { entry } = result;
  const lines = [
    chalk.bold.cyan('Prompt:'),
    entry.display,
    '',
    chalk.bold.cyan('Project:'),
    entry.project,
    '',
    chalk.bold.cyan('Timestamp:'),
    new Date(entry.timestamp).toLocaleString(),
    '',
    chalk.bold.cyan('Time Ago:'),
    formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true }),
  ];

  if (entry.sessionId) {
    lines.push('', chalk.bold.cyan('Session ID:'), entry.sessionId);
  }

  return lines.join('\n');
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
