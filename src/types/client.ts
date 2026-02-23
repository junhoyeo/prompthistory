// Supported AI coding clients
export type Client =
  | 'opencode'
  | 'claudecode'
  | 'openclaw'
  | 'codex'
  | 'gemini'
  | 'cursor'
  | 'amp'
  | 'droid'
  | 'pi'
  | 'kimi';

export interface ClientConfig {
  name: string;
  paths: string[];
  extensions: string[];
  enabled: boolean;
}

export const CLIENT_CONFIGS: Record<Client, ClientConfig> = {
  opencode: {
    name: 'OpenCode',
    paths: [
      '~/.local/share/opencode/opencode.db',
      '~/.local/share/opencode/storage/message/',
    ],
    extensions: ['.db', '.json'],
    enabled: true,
  },
  claudecode: {
    name: 'Claude Code',
    paths: ['~/.claude/projects/'],
    extensions: ['.jsonl', '.json'],
    enabled: true,
  },
  openclaw: {
    name: 'OpenClaw',
    paths: ['~/.openclaw/agents/', '~/.clawdbot/', '~/.moltbot/', '~/.moldbot/'],
    extensions: ['.jsonl', '.json'],
    enabled: true,
  },
  codex: {
    name: 'Codex CLI',
    paths: ['~/.codex/sessions/'],
    extensions: ['.jsonl'],
    enabled: true,
  },
  gemini: {
    name: 'Gemini CLI',
    paths: ['~/.gemini/tmp/'],
    extensions: ['.json', '.jsonl'],
    enabled: true,
  },
  cursor: {
    name: 'Cursor IDE',
    paths: ['~/.config/tokscale/cursor-cache/'],
    extensions: ['.json'],
    enabled: true,
  },
  amp: {
    name: 'Amp (AmpCode)',
    paths: ['~/.local/share/amp/threads/'],
    extensions: ['.json'],
    enabled: true,
  },
  droid: {
    name: 'Droid (Factory Droid)',
    paths: ['~/.factory/sessions/'],
    extensions: ['.json'],
    enabled: true,
  },
  pi: {
    name: 'Pi',
    paths: ['~/.pi/agent/sessions/'],
    extensions: ['.json'],
    enabled: true,
  },
  kimi: {
    name: 'Kimi CLI',
    paths: ['~/.kimi/sessions/'],
    extensions: ['.jsonl'],
    enabled: true,
  },
};
