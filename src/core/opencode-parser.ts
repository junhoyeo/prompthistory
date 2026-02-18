import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { EnrichedEntry } from '../types/history.js';

const DEFAULT_OPENCODE_DB_PATH = join(
  homedir(),
  '.local',
  'share',
  'opencode',
  'opencode.db'
);

interface RawMessageRow {
  message_id: string;
  session_id: string;
  session_title: string;
  project_worktree: string;
  time_created: number;
  message_data: string;
  part_data: string;
}

interface PartData {
  type: string;
  text?: string;
}

export function parseOpenCodeHistory(dbPath?: string): EnrichedEntry[] {
  const path = dbPath || DEFAULT_OPENCODE_DB_PATH;

  if (!existsSync(path)) {
    console.warn(`[parseOpenCodeHistory] Database not found at ${path}`);
    return [];
  }

  const db = new Database(path, { readonly: true });

  try {
    const query = `
      SELECT 
        m.id as message_id,
        m.session_id,
        s.title as session_title,
        p.worktree as project_worktree,
        m.time_created,
        m.data as message_data,
        pt.data as part_data
      FROM message m
      JOIN session s ON m.session_id = s.id
      JOIN project p ON s.project_id = p.id
      LEFT JOIN part pt ON m.id = pt.message_id
      WHERE json_extract(m.data, '$.role') = 'user'
        AND pt.data IS NOT NULL
        AND json_extract(pt.data, '$.type') = 'text'
      ORDER BY m.time_created DESC
    `;

    const rows = db.query(query).all() as RawMessageRow[];
    const entries: EnrichedEntry[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const partData: PartData = JSON.parse(row.part_data);

        if (!partData.text) {
          continue;
        }

        const display = partData.text;
        const isSlashCommand = display.trimStart().startsWith('/');

        entries.push({
          display,
          pastedContents: {},
          timestamp: row.time_created,
          project: row.project_worktree,
          sessionId: row.session_id,
          _lineNumber: i + 1,
          _truncatedDisplay: truncateDisplay(display),
          _isSlashCommand: isSlashCommand,
        });
      } catch {
        continue;
      }
    }

    return entries;
  } finally {
    db.close();
  }
}

function truncateDisplay(display: string, maxLength = 500): string {
  if (display.length <= maxLength) {
    return display;
  }
  return display.substring(0, maxLength - 3) + '...';
}

export function getOpenCodeDbPath(): string {
  return DEFAULT_OPENCODE_DB_PATH;
}

export function openCodeDbExists(dbPath?: string): boolean {
  const path = dbPath || DEFAULT_OPENCODE_DB_PATH;
  return existsSync(path);
}
