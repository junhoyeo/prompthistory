import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface GeminiEntry {
  display: string;
  project: string;
  timestamp: number;
  sessionId: string;
  client: 'gemini';
  _lineNumber: number;
  _isSlashCommand: boolean;
}

export async function parseGeminiHistory(): Promise<GeminiEntry[]> {
  const geminiPath = join(homedir(), '.gemini', 'tmp');
  
  try {
    const files = await readdir(geminiPath, { recursive: true });
    const sessionFiles = files.filter(f => f.includes('session-') && f.endsWith('.json'));
    
    const allEntries: GeminiEntry[] = [];
    let lineNumber = 1;
    
    for (const file of sessionFiles) {
      const filePath = join(geminiPath, file);
      const entries = parseGeminiFile(filePath, lineNumber);
      allEntries.push(...entries);
      lineNumber += entries.length;
    }
    
    return allEntries;
  } catch (error) {
    return [];
  }
}

function parseGeminiFile(filePath: string, startLine: number): GeminiEntry[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const session = JSON.parse(content);
    
    const entries: GeminiEntry[] = [];
    const sessionId = session.sessionId || 'unknown';
    const project = session.projectHash || 'unknown';
    
    let lineNumber = startLine;
    
    for (const msg of session.messages || []) {
      if (msg.type === 'user') {
        const timestamp = msg.timestamp 
          ? new Date(msg.timestamp).getTime()
          : Date.now();
        
        const display = msg.content || '';
        
        entries.push({
          display,
          project,
          timestamp,
          sessionId,
          client: 'gemini',
          _lineNumber: lineNumber++,
          _isSlashCommand: display.startsWith('/'),
        });
      }
    }
    
    return entries;
  } catch (error) {
    return [];
  }
}
