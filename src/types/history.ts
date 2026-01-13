// Type definitions for OpenCode history

/**
 * Represents pasted content attached to a history entry
 */
export interface PastedContent {
  id: number;
  type: 'text';
  content?: string;
  contentHash?: string;
}

/**
 * Represents a single entry in the OpenCode prompt history
 */
export interface HistoryEntry {
  display: string;
  pastedContents: Record<string, PastedContent> | Record<string, never>;
  timestamp: number;
  project: string;
  sessionId?: string; // Optional - not present in older entries
}

/**
 * Extended history entry with metadata added during parsing
 */
export interface EnrichedEntry extends HistoryEntry {
  /** Line number in the source file (1-indexed) */
  _lineNumber: number;
  /** Display text truncated to 500 characters */
  _truncatedDisplay: string;
  /** Whether this entry is a slash command (starts with /) */
  _isSlashCommand: boolean;
  /** Whether this entry is a duplicate of another entry */
  _isDuplicate?: boolean;
}

export interface SearchOptions {
  query?: string;
  project?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  unique?: boolean;
  includeSlashCommands?: boolean;
}

export interface SearchResult {
  entry: HistoryEntry;
  score?: number;
  matches?: Array<{
    key: string;
    value: string;
    indices: Array<[number, number]>;
  }>;
}
