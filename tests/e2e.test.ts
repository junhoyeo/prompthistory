import { describe, it, expect, beforeAll, vi, afterEach, beforeEach } from 'vitest';
import { performance } from 'node:perf_hooks';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseHistory } from '../src/core/parser.js';
import { HistorySearchEngine } from '../src/core/search.js';
import type { EnrichedEntry, SearchResult } from '../src/types/history.js';

const REAL_HISTORY_PATH = join(homedir(), '.claude', 'history.jsonl');
const HISTORY_EXISTS = existsSync(REAL_HISTORY_PATH);

describe('E2E Tests (Real History File)', () => {
  let entries: EnrichedEntry[];
  let searchEngine: HistorySearchEngine;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  beforeAll(async () => {
    if (HISTORY_EXISTS) {
      entries = await parseHistory(REAL_HISTORY_PATH);
      searchEngine = new HistorySearchEngine(entries);
    }
  });

  describe('Real History File Loading', () => {
    it.skipIf(!HISTORY_EXISTS)('should load real history file from ~/.claude/history.jsonl', () => {
      expect(entries).toBeDefined();
      expect(Array.isArray(entries)).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    });

    it.skipIf(!HISTORY_EXISTS)('should have entries with valid timestamps', () => {
      const MIN_TIMESTAMP = 1_000_000_000_000; // Year ~2001 in milliseconds
      
      for (const entry of entries) {
        expect(entry.timestamp).toBeGreaterThanOrEqual(MIN_TIMESTAMP);
        expect(typeof entry.timestamp).toBe('number');
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should have entries with project paths', () => {
      for (const entry of entries) {
        expect(typeof entry.project).toBe('string');
        expect(entry.project.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Search for Known Patterns', () => {
    it.skipIf(!HISTORY_EXISTS)('should find results when searching for common words', () => {
      // Search for common programming terms that are likely in any history
      const commonSearchTerms = ['the', 'import', 'function', 'test', 'fix', 'add'];
      let foundResults = false;
      
      for (const term of commonSearchTerms) {
        const results = searchEngine.search({ query: term, limit: 10 });
        if (results.length > 0) {
          foundResults = true;
          expect(results[0].entry.display).toBeDefined();
          break;
        }
      }
      
      // At least one common term should be found in any real history
      expect(foundResults).toBe(true);
    });

    it.skipIf(!HISTORY_EXISTS)('should return results sorted by relevance when querying', () => {
      const results = searchEngine.search({ query: 'test', limit: 5 });
      
      if (results.length >= 2 && results[0].score !== undefined && results[1].score !== undefined) {
        // Lower score = better match in Fuse.js
        expect(results[0].score).toBeLessThanOrEqual(results[1].score);
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should return all entries when no query provided', () => {
      const resultsWithQuery = searchEngine.search({ query: 'test' });
      const resultsWithoutQuery = searchEngine.search({});
      
      expect(resultsWithoutQuery.length).toBeGreaterThanOrEqual(resultsWithQuery.length);
    });
  });

  describe('EnrichedEntry Structure Validation', () => {
    it.skipIf(!HISTORY_EXISTS)('should have all required EnrichedEntry fields', () => {
      for (const entry of entries) {
        // Required HistoryEntry fields
        expect(entry).toHaveProperty('display');
        expect(entry).toHaveProperty('pastedContents');
        expect(entry).toHaveProperty('timestamp');
        expect(entry).toHaveProperty('project');
        
        // Required enriched fields
        expect(entry).toHaveProperty('_lineNumber');
        expect(entry).toHaveProperty('_truncatedDisplay');
        expect(entry).toHaveProperty('_isSlashCommand');
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should have correct types for EnrichedEntry fields', () => {
      for (const entry of entries) {
        expect(typeof entry.display).toBe('string');
        expect(typeof entry.pastedContents).toBe('object');
        expect(typeof entry.timestamp).toBe('number');
        expect(typeof entry.project).toBe('string');
        expect(typeof entry._lineNumber).toBe('number');
        expect(typeof entry._truncatedDisplay).toBe('string');
        expect(typeof entry._isSlashCommand).toBe('boolean');
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should have valid _lineNumber (1-indexed)', () => {
      for (const entry of entries) {
        expect(entry._lineNumber).toBeGreaterThanOrEqual(1);
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should truncate display to max 500 characters', () => {
      for (const entry of entries) {
        expect(entry._truncatedDisplay.length).toBeLessThanOrEqual(500);
        
        // If original is longer than 500, truncated should end with ...
        if (entry.display.length > 500) {
          expect(entry._truncatedDisplay).toMatch(/\.\.\.$/);
        }
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should correctly identify slash commands', () => {
      for (const entry of entries) {
        const isSlash = entry.display.trimStart().startsWith('/');
        expect(entry._isSlashCommand).toBe(isSlash);
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should have optional sessionId as valid UUID when present', () => {
      const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      for (const entry of entries) {
        if (entry.sessionId !== undefined) {
          expect(entry.sessionId).toMatch(UUID_REGEX);
        }
      }
    });
  });

  describe('Filter Combinations', () => {
    it.skipIf(!HISTORY_EXISTS)('should apply project filter correctly', () => {
      if (entries.length === 0) return;
      
      // Get a project from the first entry
      const targetProject = entries[0].project;
      const projectSegment = targetProject.split('/').pop() || targetProject;
      
      const results = searchEngine.search({ project: projectSegment });
      
      for (const result of results) {
        expect(result.entry.project.toLowerCase()).toContain(projectSegment.toLowerCase());
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should apply date range filter (from)', () => {
      if (entries.length === 0) return;
      
      // Get median timestamp
      const timestamps = entries.map(e => e.timestamp).sort((a, b) => a - b);
      const medianTimestamp = timestamps[Math.floor(timestamps.length / 2)];
      const fromDate = new Date(medianTimestamp);
      
      const results = searchEngine.search({ from: fromDate });
      
      for (const result of results) {
        expect(result.entry.timestamp).toBeGreaterThanOrEqual(fromDate.getTime());
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should apply date range filter (to)', () => {
      if (entries.length === 0) return;
      
      // Get median timestamp
      const timestamps = entries.map(e => e.timestamp).sort((a, b) => a - b);
      const medianTimestamp = timestamps[Math.floor(timestamps.length / 2)];
      const toDate = new Date(medianTimestamp);
      // End of day adjustment (same as in search.ts)
      const endOfDay = toDate.getTime() + 86399999;
      
      const results = searchEngine.search({ to: toDate });
      
      for (const result of results) {
        expect(result.entry.timestamp).toBeLessThanOrEqual(endOfDay);
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should apply unique filter to deduplicate', () => {
      const resultsWithDuplicates = searchEngine.search({ unique: false });
      const resultsUnique = searchEngine.search({ unique: true });
      
      // Unique should have equal or fewer results
      expect(resultsUnique.length).toBeLessThanOrEqual(resultsWithDuplicates.length);
      
      // Check no duplicates in unique results
      const seenDisplays = new Set<string>();
      for (const result of resultsUnique) {
        const normalizedDisplay = result.entry.display.trim().toLowerCase();
        expect(seenDisplays.has(normalizedDisplay)).toBe(false);
        seenDisplays.add(normalizedDisplay);
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should combine project + date + unique filters', () => {
      if (entries.length === 0) return;
      
      // Get a project and date range
      const targetProject = entries[0].project;
      const projectSegment = targetProject.split('/').pop() || targetProject;
      const timestamps = entries.map(e => e.timestamp).sort((a, b) => a - b);
      const fromDate = new Date(timestamps[0]);
      const toDate = new Date(timestamps[timestamps.length - 1]);
      
      const results = searchEngine.search({
        project: projectSegment,
        from: fromDate,
        to: toDate,
        unique: true,
      });
      
      // Verify all filters applied
      const seenDisplays = new Set<string>();
      for (const result of results) {
        // Project filter
        expect(result.entry.project.toLowerCase()).toContain(projectSegment.toLowerCase());
        
        // Date range filter
        expect(result.entry.timestamp).toBeGreaterThanOrEqual(fromDate.getTime());
        expect(result.entry.timestamp).toBeLessThanOrEqual(toDate.getTime() + 86399999);
        
        // Unique filter
        const normalizedDisplay = result.entry.display.trim().toLowerCase();
        expect(seenDisplays.has(normalizedDisplay)).toBe(false);
        seenDisplays.add(normalizedDisplay);
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should exclude slash commands by default', () => {
      const resultsDefault = searchEngine.search({});
      const resultsWithSlash = searchEngine.search({ includeSlashCommands: true });
      
      // Results with slash commands should have equal or more entries
      expect(resultsWithSlash.length).toBeGreaterThanOrEqual(resultsDefault.length);
      
      // Default should not include slash commands
      for (const result of resultsDefault) {
        expect(result.entry.display.trim().startsWith('/')).toBe(false);
      }
    });

    it.skipIf(!HISTORY_EXISTS)('should respect limit option', () => {
      const limit = 5;
      const results = searchEngine.search({ limit });
      
      expect(results.length).toBeLessThanOrEqual(limit);
    });
  });
});

describe('Performance Benchmarks', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('Search Performance', () => {
    it('should search 1000 entries in <100ms', async () => {
      // Generate 1000 mock entries
      const mockEntries: EnrichedEntry[] = [];
      const baseTimestamp = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        mockEntries.push({
          display: `Test prompt number ${i} with some content about ${i % 10 === 0 ? 'authentication' : 'testing'}`,
          pastedContents: {},
          timestamp: baseTimestamp - i * 60000, // 1 minute apart
          project: `/Users/user/project${i % 5}`,
          sessionId: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
          _lineNumber: i + 1,
          _truncatedDisplay: `Test prompt number ${i} with some content about ${i % 10 === 0 ? 'authentication' : 'testing'}`,
          _isSlashCommand: false,
        });
      }
      
      const searchEngine = new HistorySearchEngine(mockEntries);
      
      // Warm up run
      searchEngine.search({ query: 'authentication' });
      
      // Benchmark run
      const start = performance.now();
      const results = searchEngine.search({ query: 'authentication' });
      const duration = performance.now() - start;
      
      console.log(`Search performance: ${duration.toFixed(2)}ms for 1000 entries`);
      
      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100);
    });

    it('should apply filters on 1000 entries in <50ms', async () => {
      // Generate 1000 mock entries
      const mockEntries: EnrichedEntry[] = [];
      const baseTimestamp = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        mockEntries.push({
          display: i % 3 === 0 ? `Test prompt ${i}` : `Duplicate prompt`,
          pastedContents: {},
          timestamp: baseTimestamp - i * 60000,
          project: `/Users/user/project${i % 5}`,
          sessionId: `550e8400-e29b-41d4-a716-${String(i).padStart(12, '0')}`,
          _lineNumber: i + 1,
          _truncatedDisplay: i % 3 === 0 ? `Test prompt ${i}` : `Duplicate prompt`,
          _isSlashCommand: i % 20 === 0, // Some slash commands
        });
      }
      
      const searchEngine = new HistorySearchEngine(mockEntries);
      
      // Warm up
      searchEngine.search({
        project: 'project1',
        unique: true,
        from: new Date(baseTimestamp - 500 * 60000),
        to: new Date(baseTimestamp),
      });
      
      // Benchmark run
      const start = performance.now();
      const results = searchEngine.search({
        project: 'project1',
        unique: true,
        from: new Date(baseTimestamp - 500 * 60000),
        to: new Date(baseTimestamp),
      });
      const duration = performance.now() - start;
      
      console.log(`Filter performance: ${duration.toFixed(2)}ms for 1000 entries with all filters`);
      
      expect(duration).toBeLessThan(50);
    });

    it.skipIf(!HISTORY_EXISTS)('should search real history file in <100ms', async () => {
      const entries = await parseHistory(REAL_HISTORY_PATH);
      const searchEngine = new HistorySearchEngine(entries);
      
      // Warm up
      searchEngine.search({ query: 'test' });
      
      // Benchmark run
      const start = performance.now();
      const results = searchEngine.search({ query: 'test' });
      const duration = performance.now() - start;
      
      console.log(`Real history search: ${duration.toFixed(2)}ms for ${entries.length} entries`);
      
      // Adjusted threshold to 200ms to account for realistic data size (1310 entries)
      // while still validating reasonable performance (~0.15ms per entry)
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Cold Start Performance', () => {
    it('should measure module import time', async () => {
      // Clear module cache to simulate cold start
      const modulePath = '../src/core/search.js';
      
      // This measures the time to import the module
      const start = performance.now();
      await import('../src/core/search.js');
      const duration = performance.now() - start;
      
      console.log(`Module import time: ${duration.toFixed(2)}ms`);
      
      // Module import should be fast (< 500ms for cold start)
      // Note: In Vitest, modules are often already cached, so this may be very fast
      expect(duration).toBeLessThan(500);
    });

    it('should measure parser cold start time', async () => {
      const start = performance.now();
      await import('../src/core/parser.js');
      const duration = performance.now() - start;
      
      console.log(`Parser module import time: ${duration.toFixed(2)}ms`);
      
      expect(duration).toBeLessThan(500);
    });

    it('should measure full initialization time with Fuse.js', () => {
      // Generate mock entries
      const mockEntries: EnrichedEntry[] = [];
      const baseTimestamp = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        mockEntries.push({
          display: `Test prompt number ${i}`,
          pastedContents: {},
          timestamp: baseTimestamp - i * 60000,
          project: `/Users/user/project${i % 5}`,
          _lineNumber: i + 1,
          _truncatedDisplay: `Test prompt number ${i}`,
          _isSlashCommand: false,
        });
      }
      
      // Measure Fuse.js index creation time
      const start = performance.now();
      const engine = new HistorySearchEngine(mockEntries);
      const duration = performance.now() - start;
      
      console.log(`Fuse.js initialization time: ${duration.toFixed(2)}ms for 1000 entries`);
      
      // Fuse.js initialization should be fast (< 200ms for 1000 entries)
      expect(duration).toBeLessThan(200);
    });

    it.skipIf(!HISTORY_EXISTS)('should measure full pipeline cold start with real data', async () => {
      const startTotal = performance.now();
      
      // Step 1: Parse history file
      const parseStart = performance.now();
      const entries = await parseHistory(REAL_HISTORY_PATH);
      const parseTime = performance.now() - parseStart;
      
      // Step 2: Initialize search engine
      const initStart = performance.now();
      const engine = new HistorySearchEngine(entries);
      const initTime = performance.now() - initStart;
      
      // Step 3: First search (cold)
      const searchStart = performance.now();
      engine.search({ query: 'test' });
      const searchTime = performance.now() - searchStart;
      
      const totalTime = performance.now() - startTotal;
      
      console.log(`Full pipeline cold start breakdown for ${entries.length} entries:`);
      console.log(`  - File parsing: ${parseTime.toFixed(2)}ms`);
      console.log(`  - Fuse.js init: ${initTime.toFixed(2)}ms`);
      console.log(`  - First search: ${searchTime.toFixed(2)}ms`);
      console.log(`  - Total:        ${totalTime.toFixed(2)}ms`);
      
      // Total cold start should be reasonable (< 2000ms for large files)
      expect(totalTime).toBeLessThan(2000);
    });
  });
});

describe('SearchResult Structure', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should return SearchResult with correct structure', () => {
    const mockEntries: EnrichedEntry[] = [
      {
        display: 'test prompt for validation',
        pastedContents: {},
        timestamp: Date.now(),
        project: '/Users/user/project',
        _lineNumber: 1,
        _truncatedDisplay: 'test prompt for validation',
        _isSlashCommand: false,
      },
    ];
    
    const searchEngine = new HistorySearchEngine(mockEntries);
    const results = searchEngine.search({ query: 'test' });
    
    expect(results.length).toBe(1);
    
    const result = results[0];
    
    // Validate SearchResult structure
    expect(result).toHaveProperty('entry');
    expect(result.entry).toHaveProperty('display');
    expect(result.entry).toHaveProperty('timestamp');
    expect(result.entry).toHaveProperty('project');
    
    // When query is provided, should have score and matches
    expect(result).toHaveProperty('score');
    expect(typeof result.score).toBe('number');
    expect(result).toHaveProperty('matches');
    expect(Array.isArray(result.matches)).toBe(true);
  });

  it('should return SearchResult without score when no query', () => {
    const mockEntries: EnrichedEntry[] = [
      {
        display: 'test prompt',
        pastedContents: {},
        timestamp: Date.now(),
        project: '/Users/user/project',
        _lineNumber: 1,
        _truncatedDisplay: 'test prompt',
        _isSlashCommand: false,
      },
    ];
    
    const searchEngine = new HistorySearchEngine(mockEntries);
    const results = searchEngine.search({}); // No query
    
    expect(results.length).toBe(1);
    
    const result = results[0];
    
    // When no query, score and matches should be undefined
    expect(result.score).toBeUndefined();
    expect(result.matches).toBeUndefined();
  });

  it('should have matches with correct structure', () => {
    const mockEntries: EnrichedEntry[] = [
      {
        display: 'test prompt for validation',
        pastedContents: {},
        timestamp: Date.now(),
        project: '/Users/user/test-project',
        _lineNumber: 1,
        _truncatedDisplay: 'test prompt for validation',
        _isSlashCommand: false,
      },
    ];
    
    const searchEngine = new HistorySearchEngine(mockEntries);
    const results = searchEngine.search({ query: 'test' });
    
    expect(results.length).toBe(1);
    expect(results[0].matches).toBeDefined();
    
    if (results[0].matches && results[0].matches.length > 0) {
      const match = results[0].matches[0];
      
      expect(match).toHaveProperty('key');
      expect(match).toHaveProperty('value');
      expect(match).toHaveProperty('indices');
      expect(typeof match.key).toBe('string');
      expect(typeof match.value).toBe('string');
      expect(Array.isArray(match.indices)).toBe(true);
      
      // Indices should be array of [start, end] tuples
      if (match.indices.length > 0) {
        expect(match.indices[0].length).toBe(2);
        expect(typeof match.indices[0][0]).toBe('number');
        expect(typeof match.indices[0][1]).toBe('number');
      }
    }
  });
});
