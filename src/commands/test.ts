import chalk from 'chalk';
import { input, select, confirm, checkbox } from '@inquirer/prompts';
import type { TestCase, TestResult, TestRunSummary, Provider } from '../types/test.js';
import {
  createTestCase,
  getTestCase,
  getAllTestCases,
  deleteTestCase,
  updateTestCase,
} from '../core/test-db.js';
import { runSingleTest, runAllTests, runTestByName } from '../core/test-runner.js';
import { getAvailableModels, getDefaultModel } from '../core/provider.js';
import type { EnrichedEntry } from '../types/history.js';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

export async function addTestFromEntry(entry: EnrichedEntry): Promise<TestCase> {
  console.log(chalk.bold.cyan('\n📝 Create Test Case'));
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.dim('Prompt:'));
  console.log(entry.display.substring(0, 300) + (entry.display.length > 300 ? '...' : ''));
  console.log();

  const name = await input({
    message: 'Test case name:',
    validate: (v) => v.trim().length > 0 || 'Name is required',
  });

  const description = await input({
    message: 'Description (optional):',
  });

  const addPatterns = await confirm({
    message: 'Add expected patterns?',
    default: false,
  });

  let expectedPatterns: string[] | undefined;
  let expectedNotPatterns: string[] | undefined;

  if (addPatterns) {
    const patternsInput = await input({
      message: 'Expected patterns (comma-separated regex):',
    });
    if (patternsInput.trim()) {
      expectedPatterns = patternsInput.split(',').map((p) => p.trim());
    }

    const notPatternsInput = await input({
      message: 'Forbidden patterns (comma-separated regex):',
    });
    if (notPatternsInput.trim()) {
      expectedNotPatterns = notPatternsInput.split(',').map((p) => p.trim());
    }
  }

  const configureProvider = await confirm({
    message: 'Configure default provider/model?',
    default: false,
  });

  let provider: Provider | undefined;
  let model: string | undefined;

  if (configureProvider) {
    provider = (await select({
      message: 'Default provider:',
      choices: [
        { name: 'OpenAI', value: 'openai' },
        { name: 'Anthropic', value: 'anthropic' },
      ],
    })) as Provider;

    const models = getAvailableModels(provider);
    model = await select({
      message: 'Default model:',
      choices: models.map((m) => ({ name: m, value: m })),
      default: getDefaultModel(provider),
    });
  }

  const tagsInput = await input({
    message: 'Tags (comma-separated, optional):',
  });
  const tags = tagsInput.trim() ? tagsInput.split(',').map((t) => t.trim()) : undefined;

  const testCase = createTestCase({
    name: name.trim(),
    prompt: entry.display,
    description: description.trim() || undefined,
    expectedPatterns,
    expectedNotPatterns,
    provider,
    model,
    tags,
  });

  console.log(chalk.green(`\n✅ Test case "${testCase.name}" created successfully!`));
  console.log(chalk.dim(`ID: ${testCase.id}`));

  return testCase;
}

export async function addTestInteractive(): Promise<TestCase> {
  console.log(chalk.bold.cyan('\n📝 Create Test Case'));

  const name = await input({
    message: 'Test case name:',
    validate: (v) => v.trim().length > 0 || 'Name is required',
  });

  const prompt = await input({
    message: 'Prompt text:',
    validate: (v) => v.trim().length > 0 || 'Prompt is required',
  });

  const description = await input({
    message: 'Description (optional):',
  });

  const patternsInput = await input({
    message: 'Expected patterns (comma-separated regex, optional):',
  });
  const expectedPatterns = patternsInput.trim()
    ? patternsInput.split(',').map((p) => p.trim())
    : undefined;

  const notPatternsInput = await input({
    message: 'Forbidden patterns (comma-separated regex, optional):',
  });
  const expectedNotPatterns = notPatternsInput.trim()
    ? notPatternsInput.split(',').map((p) => p.trim())
    : undefined;

  const tagsInput = await input({
    message: 'Tags (comma-separated, optional):',
  });
  const tags = tagsInput.trim() ? tagsInput.split(',').map((t) => t.trim()) : undefined;

  const testCase = createTestCase({
    name: name.trim(),
    prompt: prompt.trim(),
    description: description.trim() || undefined,
    expectedPatterns,
    expectedNotPatterns,
    tags,
  });

  console.log(chalk.green(`\n✅ Test case "${testCase.name}" created!`));
  return testCase;
}

export function listTests(): void {
  const tests = getAllTestCases();

  if (tests.length === 0) {
    console.log(chalk.yellow('\nNo test cases found. Use "prompthistory test add" to create one.'));
    return;
  }

  console.log(chalk.bold.cyan(`\n📋 Test Cases (${tests.length})`));
  console.log(chalk.dim('─'.repeat(70)));

  for (const test of tests) {
    const patterns = test.expectedPatterns?.length || 0;
    const notPatterns = test.expectedNotPatterns?.length || 0;
    const tags = test.tags?.join(', ') || '';

    console.log(
      chalk.bold(test.name),
      chalk.dim(`(${test.id.substring(0, 12)}...)`)
    );
    if (test.description) {
      console.log(chalk.dim(`  ${test.description}`));
    }
    console.log(
      chalk.dim('  Patterns:'),
      chalk.cyan(`${patterns} expected`),
      chalk.dim('|'),
      chalk.red(`${notPatterns} forbidden`)
    );
    if (tags) {
      console.log(chalk.dim('  Tags:'), chalk.magenta(tags));
    }
    console.log();
  }
}

export function showTest(nameOrId: string): TestCase | null {
  const test = getTestCase(nameOrId);

  if (!test) {
    console.log(chalk.red(`\nTest case not found: ${nameOrId}`));
    return null;
  }

  console.log(chalk.bold.cyan(`\n📋 Test Case: ${test.name}`));
  console.log(chalk.dim('─'.repeat(50)));
  console.log(chalk.dim('ID:'), test.id);
  console.log(chalk.dim('Created:'), new Date(test.createdAt).toLocaleString());
  console.log(chalk.dim('Updated:'), new Date(test.updatedAt).toLocaleString());

  if (test.description) {
    console.log(chalk.dim('\nDescription:'));
    console.log(test.description);
  }

  console.log(chalk.dim('\nPrompt:'));
  console.log(test.prompt);

  if (test.expectedPatterns?.length) {
    console.log(chalk.dim('\nExpected patterns:'));
    for (const p of test.expectedPatterns) {
      console.log(chalk.green(`  ✓ ${p}`));
    }
  }
  if (test.expectedNotPatterns?.length) {
    console.log(chalk.dim('\nForbidden patterns:'));
    for (const p of test.expectedNotPatterns) {
      console.log(chalk.red(`  ✗ ${p}`));
    }
  }

  if (test.provider || test.model) {
    console.log(chalk.dim('\nDefault config:'));
    if (test.provider) console.log(`  Provider: ${test.provider}`);
    if (test.model) console.log(`  Model: ${test.model}`);
  }

  if (test.tags?.length) {
    console.log(chalk.dim('\nTags:'), chalk.magenta(test.tags.join(', ')));
  }

  return test;
}

export function removeTest(nameOrId: string): boolean {
  const deleted = deleteTestCase(nameOrId);
  if (deleted) {
    console.log(chalk.green(`\n✅ Test case deleted successfully`));
  } else {
    console.log(chalk.red(`\nTest case not found: ${nameOrId}`));
  }
  return deleted;
}

export function displayTestResult(result: TestResult): void {
  const status = result.passed ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');

  console.log(`${status} ${chalk.bold(result.testCaseName)}`);

  if (!result.passed) {
    if (result.errorMessage) {
      console.log(chalk.red(`  Error: ${result.errorMessage}`));
    }
    if (result.unmatchedPatterns.length > 0) {
      console.log(chalk.yellow(`  Missing patterns: ${result.unmatchedPatterns.join(', ')}`));
    }
    if (result.forbiddenMatches.length > 0) {
      console.log(chalk.red(`  Forbidden matches: ${result.forbiddenMatches.join(', ')}`));
    }
  }

  console.log(
    chalk.dim(`  ${formatDuration(result.promptResult.latencyMs)} | ${result.promptResult.totalTokens} tokens | ${formatCost(result.promptResult.cost || 0)}`)
  );
}

export function displayTestSummary(summary: TestRunSummary): void {
  console.log(chalk.dim('\n' + '─'.repeat(50)));
  console.log(chalk.bold('Test Summary'));
  console.log(chalk.dim('─'.repeat(50)));

  const duration = summary.completedAt - summary.startedAt;

  console.log(
    chalk.green(`  Passed: ${summary.passed}`),
    chalk.dim('|'),
    chalk.red(`Failed: ${summary.failed}`),
    summary.skipped > 0 ? chalk.dim(`| Skipped: ${summary.skipped}`) : ''
  );
  console.log(chalk.dim(`  Duration: ${formatDuration(duration)}`));
  console.log(chalk.dim(`  Total tokens: ${summary.totalTokens}`));
  console.log(chalk.dim(`  Total cost: ${formatCost(summary.totalCost)}`));

  if (summary.failed === 0 && summary.skipped === 0) {
    console.log(chalk.green.bold('\n✅ All tests passed!'));
  } else {
    console.log(chalk.red.bold(`\n❌ ${summary.failed} test(s) failed`));
  }
}

export interface RunTestsOptions {
  filter?: string;
  tags?: string[];
  provider?: Provider;
  model?: string;
  verbose?: boolean;
  stopOnFailure?: boolean;
}

export async function runTests(options: RunTestsOptions = {}): Promise<TestRunSummary> {
  console.log(chalk.bold.cyan('\n🧪 Running Tests'));
  console.log(chalk.dim('─'.repeat(50)));

  const summary = await runAllTests({
    ...options,
    onProgress: (completed, total, result) => {
      if (options.verbose) {
        displayTestResult(result);
      } else {
        const status = result.passed ? chalk.green('✓') : chalk.red('✗');
        process.stdout.write(`${status} `);
        if (completed === total || completed % 10 === 0) {
          process.stdout.write(`(${completed}/${total})\n`);
        }
      }
    },
  });

  if (!options.verbose) {
    console.log();
  }

  displayTestSummary(summary);

  return summary;
}

export async function runSingleTestByName(
  nameOrId: string,
  options: { provider?: Provider; model?: string } = {}
): Promise<TestResult | null> {
  const result = await runTestByName(nameOrId, options);

  if (!result) {
    console.log(chalk.red(`\nTest case not found: ${nameOrId}`));
    return null;
  }

  console.log(chalk.bold.cyan('\n🧪 Test Result'));
  console.log(chalk.dim('─'.repeat(50)));
  displayTestResult(result);

  console.log(chalk.dim('\nResponse preview:'));
  const preview = result.promptResult.response.substring(0, 500);
  console.log(preview + (result.promptResult.response.length > 500 ? '...' : ''));

  return result;
}
