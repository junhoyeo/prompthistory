import type {
  TestCase,
  TestResult,
  TestRunSummary,
  PromptResult,
  Provider,
} from '../types/test.js';
import { runPrompt, getDefaultModel } from './provider.js';
import { savePromptResult, saveTestResult, getTestCase, getAllTestCases } from './test-db.js';

function evaluatePatterns(
  response: string,
  expectedPatterns?: string[],
  expectedNotPatterns?: string[]
): {
  matchedPatterns: string[];
  unmatchedPatterns: string[];
  forbiddenMatches: string[];
  passed: boolean;
} {
  const matchedPatterns: string[] = [];
  const unmatchedPatterns: string[] = [];
  const forbiddenMatches: string[] = [];

  if (expectedPatterns) {
    for (const pattern of expectedPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(response)) {
        matchedPatterns.push(pattern);
      } else {
        unmatchedPatterns.push(pattern);
      }
    }
  }

  if (expectedNotPatterns) {
    for (const pattern of expectedNotPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(response)) {
        forbiddenMatches.push(pattern);
      }
    }
  }

  const passed = unmatchedPatterns.length === 0 && forbiddenMatches.length === 0;

  return { matchedPatterns, unmatchedPatterns, forbiddenMatches, passed };
}

export interface RunTestOptions {
  provider?: Provider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  save?: boolean;
}

export async function runSingleTest(
  testCase: TestCase,
  options: RunTestOptions = {}
): Promise<TestResult> {
  const provider = options.provider || testCase.provider || 'openai';
  const model = options.model || testCase.model || getDefaultModel(provider);

  let promptResult: PromptResult;
  let errorMessage: string | undefined;

  try {
    promptResult = await runPrompt(testCase.prompt, {
      provider,
      model,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
    promptResult = {
      id: `err_${Date.now()}`,
      prompt: testCase.prompt,
      response: '',
      provider,
      model,
      timestamp: Date.now(),
      latencyMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };
  }

  const evaluation = evaluatePatterns(
    promptResult.response,
    testCase.expectedPatterns,
    testCase.expectedNotPatterns
  );

  const testResult: TestResult = {
    testCaseId: testCase.id,
    testCaseName: testCase.name,
    passed: errorMessage ? false : evaluation.passed,
    promptResult,
    matchedPatterns: evaluation.matchedPatterns,
    unmatchedPatterns: evaluation.unmatchedPatterns,
    forbiddenMatches: evaluation.forbiddenMatches,
    errorMessage,
    runAt: Date.now(),
  };

  if (options.save !== false) {
    savePromptResult(promptResult, testCase.id, 'test');
    saveTestResult(testResult);
  }

  return testResult;
}

export async function runTestByName(
  nameOrId: string,
  options: RunTestOptions = {}
): Promise<TestResult | null> {
  const testCase = getTestCase(nameOrId);
  if (!testCase) return null;
  return runSingleTest(testCase, options);
}

export interface RunAllTestsOptions extends RunTestOptions {
  filter?: string;
  tags?: string[];
  concurrency?: number;
  stopOnFailure?: boolean;
  onProgress?: (completed: number, total: number, result: TestResult) => void;
}

export async function runAllTests(options: RunAllTestsOptions = {}): Promise<TestRunSummary> {
  let testCases = getAllTestCases();

  if (options.filter) {
    const filterRegex = new RegExp(options.filter, 'i');
    testCases = testCases.filter(
      (tc) => filterRegex.test(tc.name) || (tc.description && filterRegex.test(tc.description))
    );
  }

  if (options.tags && options.tags.length > 0) {
    testCases = testCases.filter(
      (tc) => tc.tags && options.tags!.some((tag) => tc.tags!.includes(tag))
    );
  }

  const startedAt = Date.now();
  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  const concurrency = options.concurrency || 1;

  if (concurrency === 1) {
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const result = await runSingleTest(testCase, options);
      results.push(result);

      if (result.passed) {
        passed++;
      } else {
        failed++;
      }

      options.onProgress?.(i + 1, testCases.length, result);

      if (options.stopOnFailure && !result.passed) {
        skipped = testCases.length - i - 1;
        break;
      }
    }
  } else {
    const chunks: TestCase[][] = [];
    for (let i = 0; i < testCases.length; i += concurrency) {
      chunks.push(testCases.slice(i, i + concurrency));
    }

    let completed = 0;
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map((testCase) => runSingleTest(testCase, options))
      );

      for (const result of chunkResults) {
        results.push(result);
        completed++;

        if (result.passed) {
          passed++;
        } else {
          failed++;
        }

        options.onProgress?.(completed, testCases.length, result);
      }

      if (options.stopOnFailure && chunkResults.some((r) => !r.passed)) {
        skipped = testCases.length - completed;
        break;
      }
    }
  }

  const completedAt = Date.now();

  return {
    totalTests: testCases.length,
    passed,
    failed,
    skipped,
    totalLatencyMs: results.reduce((sum, r) => sum + r.promptResult.latencyMs, 0),
    totalTokens: results.reduce((sum, r) => sum + r.promptResult.totalTokens, 0),
    totalCost: results.reduce((sum, r) => sum + (r.promptResult.cost || 0), 0),
    results,
    startedAt,
    completedAt,
  };
}
