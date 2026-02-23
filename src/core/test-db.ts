import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type {
  TestCase,
  TestCaseRow,
  PromptResult,
  PromptResultRow,
  TestResult,
  TestResultRow,
} from '../types/test.js';

const DEFAULT_DB_PATH = join(homedir(), '.local', 'share', 'prompthistory', 'tests.db');

let db: Database | null = null;

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Initialize the test database
 */
export function initTestDb(dbPath: string = DEFAULT_DB_PATH): Database {
  if (db) return db;

  // Ensure directory exists
  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS test_cases (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      prompt TEXT NOT NULL,
      expected_patterns TEXT,
      expected_not_patterns TEXT,
      provider TEXT,
      model TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      tags TEXT,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS prompt_results (
      id TEXT PRIMARY KEY,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      latency_ms INTEGER NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      total_tokens INTEGER NOT NULL,
      cost REAL,
      metadata TEXT,
      source_id TEXT,
      source_type TEXT
    );

    CREATE TABLE IF NOT EXISTS test_results (
      id TEXT PRIMARY KEY,
      test_case_id TEXT NOT NULL,
      passed INTEGER NOT NULL,
      prompt_result_id TEXT NOT NULL,
      matched_patterns TEXT NOT NULL,
      unmatched_patterns TEXT NOT NULL,
      forbidden_matches TEXT NOT NULL,
      error_message TEXT,
      run_at INTEGER NOT NULL,
      FOREIGN KEY (test_case_id) REFERENCES test_cases(id),
      FOREIGN KEY (prompt_result_id) REFERENCES prompt_results(id)
    );

    CREATE INDEX IF NOT EXISTS idx_test_cases_name ON test_cases(name);
    CREATE INDEX IF NOT EXISTS idx_test_cases_tags ON test_cases(tags);
    CREATE INDEX IF NOT EXISTS idx_prompt_results_timestamp ON prompt_results(timestamp);
    CREATE INDEX IF NOT EXISTS idx_prompt_results_source ON prompt_results(source_id, source_type);
    CREATE INDEX IF NOT EXISTS idx_test_results_test_case ON test_results(test_case_id);
    CREATE INDEX IF NOT EXISTS idx_test_results_run_at ON test_results(run_at);
  `);

  return db;
}

/**
 * Get the database instance
 */
export function getTestDb(): Database {
  if (!db) {
    return initTestDb();
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeTestDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ============ Test Cases ============

function rowToTestCase(row: TestCaseRow): TestCase {
  return {
    id: row.id,
    name: row.name,
    prompt: row.prompt,
    expectedPatterns: row.expected_patterns ? JSON.parse(row.expected_patterns) : undefined,
    expectedNotPatterns: row.expected_not_patterns ? JSON.parse(row.expected_not_patterns) : undefined,
    provider: row.provider as TestCase['provider'],
    model: row.model || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    description: row.description || undefined,
  };
}

export function createTestCase(testCase: Omit<TestCase, 'id' | 'createdAt' | 'updatedAt'>): TestCase {
  const db = getTestDb();
  const now = Date.now();
  const id = generateId('tc');

  const stmt = db.prepare(`
    INSERT INTO test_cases (id, name, prompt, expected_patterns, expected_not_patterns, provider, model, created_at, updated_at, tags, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    testCase.name,
    testCase.prompt,
    testCase.expectedPatterns ? JSON.stringify(testCase.expectedPatterns) : null,
    testCase.expectedNotPatterns ? JSON.stringify(testCase.expectedNotPatterns) : null,
    testCase.provider || null,
    testCase.model || null,
    now,
    now,
    testCase.tags ? JSON.stringify(testCase.tags) : null,
    testCase.description || null
  );

  return {
    ...testCase,
    id,
    createdAt: now,
    updatedAt: now,
  };
}

export function getTestCase(nameOrId: string): TestCase | null {
  const db = getTestDb();
  const stmt = db.prepare(`
    SELECT * FROM test_cases WHERE id = ? OR name = ?
  `);
  const row = stmt.get(nameOrId, nameOrId) as TestCaseRow | null;
  return row ? rowToTestCase(row) : null;
}

export function getAllTestCases(): TestCase[] {
  const db = getTestDb();
  const stmt = db.prepare(`SELECT * FROM test_cases ORDER BY created_at DESC`);
  const rows = stmt.all() as TestCaseRow[];
  return rows.map(rowToTestCase);
}

export function getTestCasesByTag(tag: string): TestCase[] {
  const db = getTestDb();
  const stmt = db.prepare(`
    SELECT * FROM test_cases WHERE tags LIKE ? ORDER BY created_at DESC
  `);
  const rows = stmt.all(`%"${tag}"%`) as TestCaseRow[];
  return rows.map(rowToTestCase);
}

export function updateTestCase(id: string, updates: Partial<Omit<TestCase, 'id' | 'createdAt'>>): TestCase | null {
  const existing = getTestCase(id);
  if (!existing) return null;

  const db = getTestDb();
  const now = Date.now();

  const stmt = db.prepare(`
    UPDATE test_cases SET
      name = ?,
      prompt = ?,
      expected_patterns = ?,
      expected_not_patterns = ?,
      provider = ?,
      model = ?,
      updated_at = ?,
      tags = ?,
      description = ?
    WHERE id = ?
  `);

  const updated = { ...existing, ...updates, updatedAt: now };

  stmt.run(
    updated.name,
    updated.prompt,
    updated.expectedPatterns ? JSON.stringify(updated.expectedPatterns) : null,
    updated.expectedNotPatterns ? JSON.stringify(updated.expectedNotPatterns) : null,
    updated.provider || null,
    updated.model || null,
    now,
    updated.tags ? JSON.stringify(updated.tags) : null,
    updated.description || null,
    id
  );

  return updated;
}

export function deleteTestCase(nameOrId: string): boolean {
  const db = getTestDb();
  const testCase = getTestCase(nameOrId);
  if (!testCase) return false;

  const stmt = db.prepare(`DELETE FROM test_cases WHERE id = ?`);
  stmt.run(testCase.id);
  return true;
}

// ============ Prompt Results ============

function rowToPromptResult(row: PromptResultRow): PromptResult {
  return {
    id: row.id,
    prompt: row.prompt,
    response: row.response,
    provider: row.provider as PromptResult['provider'],
    model: row.model,
    timestamp: row.timestamp,
    latencyMs: row.latency_ms,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens,
    cost: row.cost || undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

export function savePromptResult(
  result: PromptResult,
  sourceId?: string,
  sourceType?: 'replay' | 'test'
): PromptResult {
  const db = getTestDb();

  const stmt = db.prepare(`
    INSERT INTO prompt_results (id, prompt, response, provider, model, timestamp, latency_ms, input_tokens, output_tokens, total_tokens, cost, metadata, source_id, source_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    result.id,
    result.prompt,
    result.response,
    result.provider,
    result.model,
    result.timestamp,
    result.latencyMs,
    result.inputTokens,
    result.outputTokens,
    result.totalTokens,
    result.cost || null,
    result.metadata ? JSON.stringify(result.metadata) : null,
    sourceId || null,
    sourceType || null
  );

  return result;
}

export function getPromptResult(id: string): PromptResult | null {
  const db = getTestDb();
  const stmt = db.prepare(`SELECT * FROM prompt_results WHERE id = ?`);
  const row = stmt.get(id) as PromptResultRow | null;
  return row ? rowToPromptResult(row) : null;
}

export function getPromptResults(limit: number = 50): PromptResult[] {
  const db = getTestDb();
  const stmt = db.prepare(`SELECT * FROM prompt_results ORDER BY timestamp DESC LIMIT ?`);
  const rows = stmt.all(limit) as PromptResultRow[];
  return rows.map(rowToPromptResult);
}

export function getPromptResultsBySource(sourceId: string, sourceType: string): PromptResult[] {
  const db = getTestDb();
  const stmt = db.prepare(`
    SELECT * FROM prompt_results WHERE source_id = ? AND source_type = ? ORDER BY timestamp DESC
  `);
  const rows = stmt.all(sourceId, sourceType) as PromptResultRow[];
  return rows.map(rowToPromptResult);
}

// ============ Test Results ============

function rowToTestResult(row: TestResultRow, promptResult: PromptResult, testCaseName: string): TestResult {
  return {
    testCaseId: row.test_case_id,
    testCaseName,
    passed: row.passed === 1,
    promptResult,
    matchedPatterns: JSON.parse(row.matched_patterns),
    unmatchedPatterns: JSON.parse(row.unmatched_patterns),
    forbiddenMatches: JSON.parse(row.forbidden_matches),
    errorMessage: row.error_message || undefined,
    runAt: row.run_at,
  };
}

export function saveTestResult(result: TestResult): TestResult {
  const db = getTestDb();
  const id = generateId('tr');

  const stmt = db.prepare(`
    INSERT INTO test_results (id, test_case_id, passed, prompt_result_id, matched_patterns, unmatched_patterns, forbidden_matches, error_message, run_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    result.testCaseId,
    result.passed ? 1 : 0,
    result.promptResult.id,
    JSON.stringify(result.matchedPatterns),
    JSON.stringify(result.unmatchedPatterns),
    JSON.stringify(result.forbiddenMatches),
    result.errorMessage || null,
    result.runAt
  );

  return result;
}

export function getTestResultsForCase(testCaseId: string, limit: number = 10): TestResult[] {
  const db = getTestDb();
  const testCase = getTestCase(testCaseId);
  if (!testCase) return [];

  const stmt = db.prepare(`
    SELECT tr.*, pr.* 
    FROM test_results tr
    JOIN prompt_results pr ON tr.prompt_result_id = pr.id
    WHERE tr.test_case_id = ?
    ORDER BY tr.run_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(testCase.id, limit) as (TestResultRow & PromptResultRow)[];

  return rows.map((row) => {
    const promptResult = rowToPromptResult(row);
    return rowToTestResult(row, promptResult, testCase.name);
  });
}

export function getLatestTestResults(limit: number = 20): TestResult[] {
  const db = getTestDb();

  const stmt = db.prepare(`
    SELECT tr.*, pr.*, tc.name as test_case_name
    FROM test_results tr
    JOIN prompt_results pr ON tr.prompt_result_id = pr.id
    JOIN test_cases tc ON tr.test_case_id = tc.id
    ORDER BY tr.run_at DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as (TestResultRow & PromptResultRow & { test_case_name: string })[];

  return rows.map((row) => {
    const promptResult = rowToPromptResult(row);
    return rowToTestResult(row, promptResult, row.test_case_name);
  });
}

/**
 * Get database path
 */
export function getTestDbPath(): string {
  return DEFAULT_DB_PATH;
}
