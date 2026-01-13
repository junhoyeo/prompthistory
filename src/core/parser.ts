import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { EnrichedEntry } from '../types/history.js';
import { parseEntry } from './schema.js';

export async function parseHistory(filePath: string): Promise<EnrichedEntry[]> {
  const entries: EnrichedEntry[] = [];
  
  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    if (!line.trim()) continue;
    
    const entry = parseEntry(line, lineNumber);
    if (entry) {
      entries.push(entry);
    }
  }

  return entries;
}
