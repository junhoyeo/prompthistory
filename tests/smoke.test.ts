import { describe, it, expect } from 'vitest';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { HistoryEntry } from '../src/types/history.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURE_PATH = join(__dirname, 'fixtures', 'sample-history.jsonl');

async function loadFixture(): Promise<{ entries: HistoryEntry[]; malformedCount: number }> {
  const entries: HistoryEntry[] = [];
  let malformedCount = 0;

  const fileStream = createReadStream(FIXTURE_PATH);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as HistoryEntry;
      entries.push(entry);
    } catch {
      malformedCount++;
    }
  }

  return { entries, malformedCount };
}

describe('Smoke Test: Fixture Loading', () => {
  it('should load the sample-history.jsonl fixture', async () => {
    const { entries, malformedCount } = await loadFixture();

    // Should have at least 9 valid entries (1 malformed is expected)
    expect(entries.length).toBeGreaterThanOrEqual(9);
    
    // Should have exactly 1 malformed line
    expect(malformedCount).toBe(1);
  });

  it('should contain entries with sessionId', async () => {
    const { entries } = await loadFixture();
    const withSessionId = entries.filter(e => e.sessionId);
    
    expect(withSessionId.length).toBeGreaterThan(0);
  });

  it('should contain legacy entries without sessionId', async () => {
    const { entries } = await loadFixture();
    const withoutSessionId = entries.filter(e => !e.sessionId);
    
    expect(withoutSessionId.length).toBeGreaterThan(0);
  });

  it('should contain Korean text (UTF-8)', async () => {
    const { entries } = await loadFixture();
    const koreanEntry = entries.find(e => /[\uAC00-\uD7AF]/.test(e.display));
    
    expect(koreanEntry).toBeDefined();
    expect(koreanEntry?.display).toContain('한국어');
  });

  it('should contain slash commands', async () => {
    const { entries } = await loadFixture();
    const slashCommands = entries.filter(e => e.display.startsWith('/'));
    
    expect(slashCommands.length).toBeGreaterThanOrEqual(2);
  });

  it('should contain duplicate entries (same display)', async () => {
    const { entries } = await loadFixture();
    const displayCounts = new Map<string, number>();
    
    for (const entry of entries) {
      displayCounts.set(entry.display, (displayCounts.get(entry.display) || 0) + 1);
    }
    
    const hasDuplicates = Array.from(displayCounts.values()).some(count => count > 1);
    expect(hasDuplicates).toBe(true);
  });

  it('should contain long prompts (>500 chars)', async () => {
    const { entries } = await loadFixture();
    const longPrompts = entries.filter(e => e.display.length > 500);
    
    expect(longPrompts.length).toBeGreaterThan(0);
  });

  it('should have valid structure for all entries', async () => {
    const { entries } = await loadFixture();
    
    for (const entry of entries) {
      expect(entry).toHaveProperty('display');
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('project');
      expect(typeof entry.display).toBe('string');
      expect(typeof entry.timestamp).toBe('number');
      expect(typeof entry.project).toBe('string');
    }
  });
});
