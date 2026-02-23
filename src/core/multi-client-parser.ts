import { parseHistory as parseOpenCodeHistory } from './parser.js';
import {
  parseClaudeCodeHistory,
  parseCodexHistory,
  parseGeminiHistory,
  parseOpenClawHistory,
  type ClientEntry,
} from '../parsers/index.js';
import type { HistoryEntry } from '../types/history.js';

export interface MultiClientOptions {
  clients?: string[];
}

export async function parseMultiClientHistory(
  options: MultiClientOptions = {}
): Promise<HistoryEntry[]> {
  const { clients } = options;
  
  const allEntries: HistoryEntry[] = [];
  
  // OpenCode (primary, always included unless explicitly excluded)
  if (!clients || clients.includes('opencode')) {
    try {
      const openCodeEntries = await parseOpenCodeHistory();
      const enriched = openCodeEntries.map(e => ({ ...e, client: 'opencode' as const }));
      allEntries.push(...enriched);
    } catch (error) {
      // Skip if OpenCode not available
    }
  }
  
  // Claude Code
  if (!clients || clients.includes('claudecode')) {
    try {
      const claudeEntries = await parseClaudeCodeHistory();
      allEntries.push(...(claudeEntries as unknown as HistoryEntry[]));
    } catch (error) {
      // Skip if Claude Code not available
    }
  }
  
  // Codex
  if (!clients || clients.includes('codex')) {
    try {
      const codexEntries = await parseCodexHistory();
      allEntries.push(...(codexEntries as unknown as HistoryEntry[]));
    } catch (error) {
      // Skip if Codex not available
    }
  }
  
  // Gemini
  if (!clients || clients.includes('gemini')) {
    try {
      const geminiEntries = await parseGeminiHistory();
      allEntries.push(...(geminiEntries as unknown as HistoryEntry[]));
    } catch (error) {
      // Skip if Gemini not available
    }
  }
  
  // OpenClaw
  if (!clients || clients.includes('openclaw')) {
    try {
      const openclawEntries = await parseOpenClawHistory();
      allEntries.push(...(openclawEntries as unknown as HistoryEntry[]));
    } catch (error) {
      // Skip if OpenClaw not available
    }
  }
  
  // Sort by timestamp (most recent first)
  return allEntries.sort((a, b) => b.timestamp - a.timestamp);
}
