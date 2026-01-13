import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import type { HistoryEntry } from '../types/history.js';

export async function parseHistory(filePath: string): Promise<HistoryEntry[]> {
  const entries: HistoryEntry[] = [];
  
  const fileStream = createReadStream(filePath);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    
    try {
      const entry = JSON.parse(line) as HistoryEntry;
      entries.push(entry);
    } catch (error) {
      // Skip malformed lines
      console.warn('Skipping malformed line:', line.substring(0, 50));
    }
  }

  return entries;
}
