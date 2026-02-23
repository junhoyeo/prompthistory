import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface CodexEntry {
  display: string;
  project: string;
  timestamp: number;
  sessionId: string;
  client: 'codex';
  _lineNumber: number;
  _isSlashCommand: boolean;
}

export async function parseCodexHistory(): Promise<CodexEntry[]> {
  const codexPath = join(homedir(), '.codex', 'sessions');
  
  try {
    const files = await readdir(codexPath);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
    
    const allEntries: CodexEntry[] = [];
    let lineNumber = 1;
    
    for (const file of jsonlFiles) {
      const filePath = join(codexPath, file);
      const entries = parseCodexFile(filePath, lineNumber);
      allEntries.push(...entries);
      lineNumber += entries.length;
    }
    
    return allEntries;
  } catch (error) {
    return [];
  }
}

function parseCodexFile(filePath: string, startLine: number): CodexEntry[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    const entries: CodexEntry[] = [];
    const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || 'unknown';
    
    let lineNumber = startLine;
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        if (entry.type === 'user_prompt') {
          const timestamp = entry.timestamp 
            ? new Date(entry.timestamp).getTime()
            : Date.now();
          
          const display = entry.payload?.content || line.substring(0, 200);
          const project = entry.payload?.project || 'unknown';
          
          entries.push({
            display,
            project,
            timestamp,
            sessionId,
            client: 'codex',
            _lineNumber: lineNumber++,
            _isSlashCommand: display.startsWith('/'),
          });
        }
      } catch (e) {
        continue;
      }
    }
    
    return entries;
  } catch (error) {
    return [];
  }
}
