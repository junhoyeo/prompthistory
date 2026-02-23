import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface ClaudeCodeEntry {
  display: string;
  project: string;
  timestamp: number;
  sessionId: string;
  client: 'claudecode';
  _lineNumber: number;
  _isSlashCommand: boolean;
}

interface ClaudeJSONLEntry {
  type: string;
  timestamp?: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
    id?: string;
  };
  requestId?: string;
}

export async function parseClaudeCodeHistory(): Promise<ClaudeCodeEntry[]> {
  const claudePath = join(homedir(), '.claude', 'projects');
  
  try {
    const files = await readdir(claudePath, { recursive: true });
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
    
    const allEntries: ClaudeCodeEntry[] = [];
    let lineNumber = 1;
    
    for (const file of jsonlFiles) {
      const filePath = join(claudePath, file);
      const entries = parseClaudeFile(filePath, lineNumber);
      allEntries.push(...entries);
      lineNumber += entries.length;
    }
    
    return allEntries;
  } catch (error) {
    // Claude Code not installed or no history
    return [];
  }
}

function parseClaudeFile(filePath: string, startLine: number): ClaudeCodeEntry[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim());
    
    const entries: ClaudeCodeEntry[] = [];
    const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || 'unknown';
    const project = filePath.split('/projects/')[1]?.split('/')[0] || 'unknown';
    
    let lineNumber = startLine;
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as ClaudeJSONLEntry;
        
        // Only process user messages
        if (entry.type === 'user' || entry.type === 'assistant') {
          const timestamp = entry.timestamp 
            ? new Date(entry.timestamp).getTime()
            : Date.now();
          
          // Extract display text (simplified - would need more logic for full content)
          const display = line.substring(0, 200); // Simplified extraction
          
          entries.push({
            display,
            project,
            timestamp,
            sessionId,
            client: 'claudecode',
            _lineNumber: lineNumber++,
            _isSlashCommand: false,
          });
        }
      } catch (e) {
        // Skip malformed lines
        continue;
      }
    }
    
    return entries;
  } catch (error) {
    return [];
  }
}
