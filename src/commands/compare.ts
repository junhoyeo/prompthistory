import chalk from 'chalk';
import type { PromptResult, PromptComparison, DiffLine } from '../types/test.js';
import { getPromptResult } from '../core/test-db.js';

function computeLineDiff(text1: string, text2: string): DiffLine[] {
  const lines1 = text1.split('\n');
  const lines2 = text2.split('\n');
  const result: DiffLine[] = [];

  const lcs = computeLCS(lines1, lines2);
  let i = 0;
  let j = 0;
  let lcsIdx = 0;

  while (i < lines1.length || j < lines2.length) {
    if (lcsIdx < lcs.length && i < lines1.length && lines1[i] === lcs[lcsIdx]) {
      if (j < lines2.length && lines2[j] === lcs[lcsIdx]) {
        result.push({
          type: 'unchanged',
          content: lines1[i],
          lineNumber1: i + 1,
          lineNumber2: j + 1,
        });
        i++;
        j++;
        lcsIdx++;
      } else {
        result.push({
          type: 'added',
          content: lines2[j],
          lineNumber2: j + 1,
        });
        j++;
      }
    } else if (i < lines1.length) {
      result.push({
        type: 'removed',
        content: lines1[i],
        lineNumber1: i + 1,
      });
      i++;
    } else {
      result.push({
        type: 'added',
        content: lines2[j],
        lineNumber2: j + 1,
      });
      j++;
    }
  }

  return result;
}

function computeLCS(arr1: string[], arr2: string[]): string[] {
  const m = arr1.length;
  const n = arr2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const lcs: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (arr1[i - 1] === arr2[j - 1]) {
      lcs.unshift(arr1[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

function calculateSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1;
  if (!text1 || !text2) return 0;

  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

export function compareResults(result1: PromptResult, result2: PromptResult): PromptComparison {
  const diff = computeLineDiff(result1.response, result2.response);
  const similarity = calculateSimilarity(result1.response, result2.response);

  return {
    result1,
    result2,
    diff,
    similarity,
    tokenDiff: result2.totalTokens - result1.totalTokens,
    latencyDiff: result2.latencyMs - result1.latencyMs,
    costDiff:
      result1.cost !== undefined && result2.cost !== undefined
        ? result2.cost - result1.cost
        : undefined,
  };
}

function formatLineNumber(num: number | undefined, width: number): string {
  if (num === undefined) return ' '.repeat(width);
  return num.toString().padStart(width, ' ');
}

export function displayComparison(comparison: PromptComparison): void {
  const { result1, result2, diff, similarity } = comparison;

  console.log(chalk.bold.cyan('\n📊 Comparison Results'));
  console.log(chalk.dim('═'.repeat(70)));

  console.log(chalk.bold('\nMetadata:'));
  console.log(chalk.dim('─'.repeat(70)));
  console.log(
    `  ${chalk.cyan('Result 1:')} ${result1.provider}/${result1.model} (${new Date(result1.timestamp).toLocaleString()})`
  );
  console.log(
    `  ${chalk.cyan('Result 2:')} ${result2.provider}/${result2.model} (${new Date(result2.timestamp).toLocaleString()})`
  );

  console.log(chalk.bold('\nStatistics:'));
  console.log(chalk.dim('─'.repeat(70)));

  const similarityColor = similarity > 0.8 ? chalk.green : similarity > 0.5 ? chalk.yellow : chalk.red;
  console.log(`  Similarity: ${similarityColor((similarity * 100).toFixed(1) + '%')}`);

  const tokenDiffStr = comparison.tokenDiff >= 0 ? `+${comparison.tokenDiff}` : comparison.tokenDiff.toString();
  const tokenColor = comparison.tokenDiff > 0 ? chalk.red : comparison.tokenDiff < 0 ? chalk.green : chalk.dim;
  console.log(
    `  Tokens: ${result1.totalTokens} → ${result2.totalTokens} (${tokenColor(tokenDiffStr)})`
  );

  const latencyDiffStr = comparison.latencyDiff >= 0 ? `+${comparison.latencyDiff}ms` : `${comparison.latencyDiff}ms`;
  const latencyColor = comparison.latencyDiff > 0 ? chalk.red : comparison.latencyDiff < 0 ? chalk.green : chalk.dim;
  console.log(
    `  Latency: ${result1.latencyMs}ms → ${result2.latencyMs}ms (${latencyColor(latencyDiffStr)})`
  );

  if (comparison.costDiff !== undefined) {
    const costDiffStr = comparison.costDiff >= 0 ? `+$${comparison.costDiff.toFixed(6)}` : `-$${Math.abs(comparison.costDiff).toFixed(6)}`;
    const costColor = comparison.costDiff > 0 ? chalk.red : comparison.costDiff < 0 ? chalk.green : chalk.dim;
    console.log(
      `  Cost: $${(result1.cost || 0).toFixed(6)} → $${(result2.cost || 0).toFixed(6)} (${costColor(costDiffStr)})`
    );
  }

  console.log(chalk.bold('\nDiff:'));
  console.log(chalk.dim('─'.repeat(70)));

  const maxLineNum1 = Math.max(...diff.filter((d) => d.lineNumber1).map((d) => d.lineNumber1!), 1);
  const maxLineNum2 = Math.max(...diff.filter((d) => d.lineNumber2).map((d) => d.lineNumber2!), 1);
  const width1 = maxLineNum1.toString().length;
  const width2 = maxLineNum2.toString().length;

  let changesCount = 0;
  const maxLinesToShow = 100;

  for (let i = 0; i < Math.min(diff.length, maxLinesToShow); i++) {
    const line = diff[i];
    const ln1 = formatLineNumber(line.lineNumber1, width1);
    const ln2 = formatLineNumber(line.lineNumber2, width2);
    const prefix = `${ln1} ${ln2}`;

    switch (line.type) {
      case 'added':
        console.log(chalk.green(`${prefix} + ${line.content}`));
        changesCount++;
        break;
      case 'removed':
        console.log(chalk.red(`${prefix} - ${line.content}`));
        changesCount++;
        break;
      case 'unchanged':
        console.log(chalk.dim(`${prefix}   ${line.content}`));
        break;
    }
  }

  if (diff.length > maxLinesToShow) {
    console.log(chalk.dim(`\n... and ${diff.length - maxLinesToShow} more lines`));
  }

  console.log(chalk.dim('\n─'.repeat(70)));
  console.log(
    chalk.dim('Legend:'),
    chalk.green('+ added'),
    chalk.dim('|'),
    chalk.red('- removed'),
    chalk.dim(`| ${changesCount} changes`)
  );
}

export function compareByIds(id1: string, id2: string): PromptComparison | null {
  const result1 = getPromptResult(id1);
  const result2 = getPromptResult(id2);

  if (!result1) {
    console.log(chalk.red(`Result not found: ${id1}`));
    return null;
  }

  if (!result2) {
    console.log(chalk.red(`Result not found: ${id2}`));
    return null;
  }

  const comparison = compareResults(result1, result2);
  displayComparison(comparison);

  return comparison;
}

export function displaySideBySide(result1: PromptResult, result2: PromptResult): void {
  const width = Math.floor((process.stdout.columns || 120) / 2) - 3;

  console.log(chalk.bold.cyan('\n📊 Side-by-Side Comparison'));
  console.log(chalk.dim('═'.repeat(width * 2 + 3)));

  const header1 = `${result1.provider}/${result1.model}`.substring(0, width);
  const header2 = `${result2.provider}/${result2.model}`.substring(0, width);
  console.log(chalk.bold(header1.padEnd(width)) + ' │ ' + chalk.bold(header2));
  console.log(chalk.dim('─'.repeat(width) + '─┼─' + '─'.repeat(width)));

  const lines1 = result1.response.split('\n');
  const lines2 = result2.response.split('\n');
  const maxLines = Math.max(lines1.length, lines2.length);

  for (let i = 0; i < Math.min(maxLines, 50); i++) {
    const line1 = (lines1[i] || '').substring(0, width).padEnd(width);
    const line2 = (lines2[i] || '').substring(0, width);
    console.log(line1 + ' │ ' + line2);
  }

  if (maxLines > 50) {
    console.log(chalk.dim(`\n... ${maxLines - 50} more lines`));
  }
}
