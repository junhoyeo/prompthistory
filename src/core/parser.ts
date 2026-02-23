import { createReadStream, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import type { EnrichedEntry } from '../types/history.js';
import { parseEntry } from './schema.js';
import { parseOpenCodeHistory, getOpenCodeDbPath, openCodeDbExists } from './opencode-parser.js';

export { parseOpenCodeHistory, getOpenCodeDbPath, openCodeDbExists };

export async function parseHistory(filePath: string): Promise<EnrichedEntry[]> {
  if (filePath.endsWith('.db') || filePath.endsWith('opencode.db')) {
    return parseOpenCodeHistory(filePath);
  }

  if (filePath === getOpenCodeDbPath() || !existsSync(filePath)) {
    if (openCodeDbExists()) {
      return parseOpenCodeHistory();
    }
  }

  return parseHistoryJsonl(filePath);
}

export async function parseHistoryJsonl(filePath: string): Promise<EnrichedEntry[]> {
  if (!existsSync(filePath)) {
    throw new Error(
      `History file not found: ${filePath}\n` +
        `Make sure Claude Code has been used at least once, or specify a valid path with --file.`
    );
  }

  const entries: EnrichedEntry[] = [];
  const fileStream = createReadStream(filePath);
  const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

  try {
    let lineNumber = 0;
    for await (const line of rl) {
      lineNumber++;
      if (!line.trim()) continue;

      const entry = parseEntry(line, lineNumber);
      if (entry) {
        entries.push(entry);
      }
    }
  } catch (err) {
    rl.close();
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EACCES') {
      throw new Error(`Permission denied reading history file: ${filePath}`);
    }
    throw err;
  }

  return entries;
}
