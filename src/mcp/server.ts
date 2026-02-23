#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { parseHistory } from '../core/parser.js';
import { HistorySearchEngine } from '../core/search.js';
import { getOpenCodeDbPath, openCodeDbExists } from '../core/parser.js';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_HISTORY_PATH = openCodeDbExists() 
  ? getOpenCodeDbPath() 
  : join(homedir(), '.claude', 'history.jsonl');

const server = new Server(
  {
    name: 'prompthistory',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_prompts',
        description: 'Search through OpenCode prompt history',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query text',
            },
            project: {
              type: 'string',
              description: 'Filter by project path (partial match)',
            },
            from: {
              type: 'string',
              description: 'Filter from date (YYYY-MM-DD)',
            },
            to: {
              type: 'string',
              description: 'Filter to date (YYYY-MM-DD)',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results (default: 20)',
              default: 20,
            },
            unique: {
              type: 'boolean',
              description: 'Show only unique prompts (deduplicate)',
              default: false,
            },
          },
        },
      },
      {
        name: 'list_prompts',
        description: 'List recent prompts',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Number of prompts to show (default: 10)',
              default: 10,
            },
            project: {
              type: 'string',
              description: 'Filter by project path',
            },
            from: {
              type: 'string',
              description: 'Filter from date (YYYY-MM-DD)',
            },
            to: {
              type: 'string',
              description: 'Filter to date (YYYY-MM-DD)',
            },
          },
        },
      },
      {
        name: 'get_prompt',
        description: 'Get a specific prompt by line number from search results',
        inputSchema: {
          type: 'object',
          properties: {
            lineNumber: {
              type: 'number',
              description: 'Line number of the prompt (from _lineNumber field)',
            },
          },
          required: ['lineNumber'],
        },
      },
    ],
  };
});

// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: 'Missing arguments' }),
        },
      ],
      isError: true,
    };
  }

  try {
    const entries = await parseHistory(DEFAULT_HISTORY_PATH);
    const searchEngine = new HistorySearchEngine(entries);

    switch (name) {
      case 'search_prompts': {
        const results = searchEngine.search({
          query: args.query as string | undefined,
          project: args.project as string | undefined,
          from: args.from ? new Date(args.from as string) : undefined,
          to: args.to ? new Date(args.to as string) : undefined,
          limit: (args.limit as number) || 20,
          unique: args.unique as boolean | undefined,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                results.map(r => ({
                  display: r.entry.display,
                  project: r.entry.project,
                  timestamp: r.entry.timestamp,
                  sessionId: r.entry.sessionId,
                  lineNumber: r.entry._lineNumber,
                  score: r.score,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'list_prompts': {
        const results = searchEngine.search({
          project: args.project as string | undefined,
          from: args.from ? new Date(args.from as string) : undefined,
          to: args.to ? new Date(args.to as string) : undefined,
          limit: (args.limit as number) || 10,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                results.map(r => ({
                  display: r.entry.display,
                  project: r.entry.project,
                  timestamp: r.entry.timestamp,
                  sessionId: r.entry.sessionId,
                  lineNumber: r.entry._lineNumber,
                })),
                null,
                2
              ),
            },
          ],
        };
      }

      case 'get_prompt': {
        const lineNumber = args.lineNumber as number;
        const entry = entries.find(e => e._lineNumber === lineNumber);

        if (!entry) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: 'Prompt not found' }),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  display: entry.display,
                  project: entry.project,
                  timestamp: entry.timestamp,
                  sessionId: entry.sessionId,
                  lineNumber: entry._lineNumber,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('prompthistory MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
