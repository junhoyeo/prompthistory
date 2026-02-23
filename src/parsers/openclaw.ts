import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface OpenClawEntry {
  display: string;
  project: string;
  timestamp: number;
  sessionId: string;
  client: 'openclaw';
  _lineNumber: number;
  _isSlashCommand: boolean;
}

export async function parseOpenClawHistory(): Promise<OpenClawEntry[]> {
  const paths = [
    join(homedir(), '.openclaw', 'agents'),
    join(homedir(), '.clawdbot'),
    join(homedir(), '.moltbot'),
    join(homedir(), '.moldbot'),
  ];
  
  const allEntries: OpenClawEntry[] = [];
  let lineNumber = 1;
  
  for (const basePath of paths) {
    try {
      const files = await readdir(basePath, { recursive: true });
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl') || f.endsWith('.json'));
      
      for (const file of jsonlFiles) {
        const filePath = join(basePath, file);
        const entries = parseOpenClawFile(filePath, lineNumber);
        allEntries.push(...entries);
        lineNumber += entries.length;
      }
    } catch (error) {
      // Path doesn't exist, skip
      continue;
    }
  }
  
  return allEntries;
}

function parseOpenClawFile(filePath: string, startLine: number): OpenClawEntry[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    const entries: OpenClawEntry[] = [];
    const sessionId = filePath.split('/').pop()?.replace(/\.(jsonl|json)$/, '') || 'unknown';
    
    let lineNumber = startLine;
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        
        if (entry.role === 'user') {
          const timestamp = entry.timestamp 
            ? new Date(entry.timestamp).getTime()
            : Date.now();
          
          const display = entry.content || '';
          const project = entry.project || 'unknown';
          
          entries.push({
            display,
            project,
            timestamp,
            sessionId,
            client: 'openclaw',
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
