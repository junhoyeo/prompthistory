import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { HistoryEntrySchema, parseEntry } from '../src/core/schema.js';
import type { EnrichedEntry } from '../src/types/history.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_PATH = join(__dirname, 'fixtures', 'sample-history.jsonl');

async function loadAndParseFixture(): Promise<{
  entries: EnrichedEntry[];
  nullCount: number;
}> {
  const entries: EnrichedEntry[] = [];
  let nullCount = 0;
  let lineNumber = 0;

  const fileStream = createReadStream(FIXTURE_PATH);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    lineNumber++;
    if (!line.trim()) continue;

    const entry = parseEntry(line, lineNumber);
    if (entry) {
      entries.push(entry);
    } else {
      nullCount++;
    }
  }

  return { entries, nullCount };
}

describe('HistoryEntrySchema', () => {
  it('should validate a minimal valid entry', () => {
    const entry = {
      display: 'test prompt',
      pastedContents: {},
      timestamp: 1705147200000,
      project: '/Users/user/project',
    };

    const result = HistoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should validate entry with sessionId', () => {
    const entry = {
      display: 'test prompt',
      pastedContents: {},
      timestamp: 1705147200000,
      project: '/Users/user/project',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
    };

    const result = HistoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });

  it('should reject timestamp below minimum', () => {
    const entry = {
      display: 'test prompt',
      pastedContents: {},
      timestamp: 999_999_999_999,
      project: '/Users/user/project',
    };

    const result = HistoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('should reject invalid sessionId format', () => {
    const entry = {
      display: 'test prompt',
      pastedContents: {},
      timestamp: 1705147200000,
      project: '/Users/user/project',
      sessionId: 'not-a-uuid',
    };

    const result = HistoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(false);
  });

  it('should allow unknown fields with catchall', () => {
    const entry = {
      display: 'test prompt',
      pastedContents: {},
      timestamp: 1705147200000,
      project: '/Users/user/project',
      unknownField: 'should be preserved',
    };

    const result = HistoryEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).unknownField).toBe('should be preserved');
    }
  });
});

describe('parseEntry', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should return null for malformed JSON', () => {
    const result = parseEntry('not valid json', 1);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Malformed JSON'));
  });

  it('should return null for invalid schema', () => {
    const result = parseEntry('{"display":"test"}', 1);
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Schema validation failed'));
  });

  it('should enrich valid entries with metadata', () => {
    const line = JSON.stringify({
      display: 'test prompt',
      pastedContents: {},
      timestamp: 1705147200000,
      project: '/Users/user/project',
    });

    const result = parseEntry(line, 42);

    expect(result).not.toBeNull();
    expect(result!._lineNumber).toBe(42);
    expect(result!._truncatedDisplay).toBe('test prompt');
    expect(result!._isSlashCommand).toBe(false);
  });

  it('should detect slash commands', () => {
    const line = JSON.stringify({
      display: '/rewind',
      pastedContents: {},
      timestamp: 1705147200000,
      project: '/Users/user/project',
    });

    const result = parseEntry(line, 1);

    expect(result).not.toBeNull();
    expect(result!._isSlashCommand).toBe(true);
  });

  it('should truncate long display text to 500 characters', () => {
    const longText = 'x'.repeat(600);
    const line = JSON.stringify({
      display: longText,
      pastedContents: {},
      timestamp: 1705147200000,
      project: '/Users/user/project',
    });

    const result = parseEntry(line, 1);

    expect(result).not.toBeNull();
    expect(result!._truncatedDisplay.length).toBe(500);
    expect(result!._truncatedDisplay).toMatch(/\.\.\.$/);
  });
});

describe('Schema with sample-history.jsonl fixture', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should parse all valid entries from fixture', async () => {
    const { entries, nullCount } = await loadAndParseFixture();

    expect(entries.length).toBe(10);
    expect(nullCount).toBe(1);
  });

  it('should correctly set _lineNumber for each entry', async () => {
    const { entries } = await loadAndParseFixture();

    expect(entries[0]._lineNumber).toBe(1);
    expect(entries[9]._lineNumber).toBe(11);
  });

  it('should detect slash commands in fixture', async () => {
    const { entries } = await loadAndParseFixture();
    const slashCommands = entries.filter((e) => e._isSlashCommand);

    expect(slashCommands.length).toBe(2);
    expect(slashCommands[0].display).toBe('/rewind');
    expect(slashCommands[1].display).toBe('/model claude-3-opus');
  });

  it('should handle entries with and without sessionId', async () => {
    const { entries } = await loadAndParseFixture();
    const withSessionId = entries.filter((e) => e.sessionId);
    const withoutSessionId = entries.filter((e) => !e.sessionId);

    expect(withSessionId.length).toBe(8);
    expect(withoutSessionId.length).toBe(2);
  });

  it('should truncate long prompts in fixture', async () => {
    const { entries } = await loadAndParseFixture();
    const longEntry = entries.find((e) => e.display.length > 500);

    expect(longEntry).toBeDefined();
    expect(longEntry!._truncatedDisplay.length).toBe(500);
    expect(longEntry!._truncatedDisplay).toMatch(/\.\.\.$/);
  });

  it('should preserve Korean text (UTF-8)', async () => {
    const { entries } = await loadAndParseFixture();
    const koreanEntry = entries.find((e) => /[\uAC00-\uD7AF]/.test(e.display));

    expect(koreanEntry).toBeDefined();
    expect(koreanEntry!.display).toContain('한국어');
  });

  it('should handle special characters', async () => {
    const { entries } = await loadAndParseFixture();
    const specialEntry = entries.find((e) => e.display.includes('<>&'));

    expect(specialEntry).toBeDefined();
    expect(specialEntry!.display).toContain('<>&"\'');
  });
});
