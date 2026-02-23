// Type definitions for prompt testing and replay features

/**
 * Supported LLM providers
 */
export type Provider = 'openai' | 'anthropic';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  provider: Provider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Result from running a prompt through a provider
 */
export interface PromptResult {
  id: string;
  prompt: string;
  response: string;
  provider: Provider;
  model: string;
  timestamp: number;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Test case definition
 */
export interface TestCase {
  id: string;
  name: string;
  prompt: string;
  expectedPatterns?: string[];
  expectedNotPatterns?: string[];
  provider?: Provider;
  model?: string;
  createdAt: number;
  updatedAt: number;
  tags?: string[];
  description?: string;
}

/**
 * Result of running a test case
 */
export interface TestResult {
  testCaseId: string;
  testCaseName: string;
  passed: boolean;
  promptResult: PromptResult;
  matchedPatterns: string[];
  unmatchedPatterns: string[];
  forbiddenMatches: string[];
  errorMessage?: string;
  runAt: number;
}

/**
 * Test run summary
 */
export interface TestRunSummary {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  totalLatencyMs: number;
  totalTokens: number;
  totalCost: number;
  results: TestResult[];
  startedAt: number;
  completedAt: number;
}

/**
 * Comparison between two prompt results
 */
export interface PromptComparison {
  result1: PromptResult;
  result2: PromptResult;
  diff: DiffLine[];
  similarity: number;
  tokenDiff: number;
  latencyDiff: number;
  costDiff?: number;
}

/**
 * Single line in a diff
 */
export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber1?: number;
  lineNumber2?: number;
}

/**
 * Replay options
 */
export interface ReplayOptions {
  provider?: Provider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  save?: boolean;
}

/**
 * Database row types for test storage
 */
export interface TestCaseRow {
  id: string;
  name: string;
  prompt: string;
  expected_patterns: string | null;
  expected_not_patterns: string | null;
  provider: string | null;
  model: string | null;
  created_at: number;
  updated_at: number;
  tags: string | null;
  description: string | null;
}

export interface PromptResultRow {
  id: string;
  prompt: string;
  response: string;
  provider: string;
  model: string;
  timestamp: number;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost: number | null;
  metadata: string | null;
  source_id: string | null;
  source_type: string | null;
}

export interface TestResultRow {
  id: string;
  test_case_id: string;
  passed: number;
  prompt_result_id: string;
  matched_patterns: string;
  unmatched_patterns: string;
  forbidden_matches: string;
  error_message: string | null;
  run_at: number;
}
