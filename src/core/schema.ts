import { z } from 'zod/v4';
import type { EnrichedEntry } from '../types/history.js';

const MIN_TIMESTAMP = 1_000_000_000_000; // Milliseconds (year ~2001)
const MAX_DISPLAY_LENGTH = 500;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PastedContentSchema = z.object({
  id: z.number(),
  type: z.literal('text'),
  content: z.string().optional(),
  contentHash: z.string().optional(),
});

export const HistoryEntrySchema = z
  .object({
    display: z.string(),
    pastedContents: z.record(z.string(), PastedContentSchema).or(z.object({})),
    timestamp: z.number().min(MIN_TIMESTAMP),
    project: z.string(),
    sessionId: z.string().regex(UUID_REGEX).optional(),
  })
  .catchall(z.unknown());

export type ParsedHistoryEntry = z.infer<typeof HistoryEntrySchema>;

function truncateDisplay(display: string): string {
  if (display.length <= MAX_DISPLAY_LENGTH) {
    return display;
  }
  return display.substring(0, MAX_DISPLAY_LENGTH - 3) + '...';
}

function isSlashCommand(display: string): boolean {
  return display.trimStart().startsWith('/');
}

export function parseEntry(
  line: string,
  lineNumber: number,
): EnrichedEntry | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(line);
  } catch {
    console.warn(`[parseEntry] Malformed JSON at line ${lineNumber}: ${line.substring(0, 50)}...`);
    return null;
  }

  const result = HistoryEntrySchema.safeParse(parsed);

  if (!result.success) {
    console.warn(
      `[parseEntry] Schema validation failed at line ${lineNumber}: ${result.error.message}`,
    );
    return null;
  }

  const entry = result.data;

  return {
    ...entry,
    pastedContents: entry.pastedContents as EnrichedEntry['pastedContents'],
    _lineNumber: lineNumber,
    _truncatedDisplay: truncateDisplay(entry.display),
    _isSlashCommand: isSlashCommand(entry.display),
  };
}
