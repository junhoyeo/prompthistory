# prompthistory

> CLI tool to search, replay, test, and compare your AI coding assistant prompts

Supports **OpenCode**, **Claude Code**, **Codex**, **Gemini CLI**, **OpenClaw**, and more!

<div align="center">

[![npm Version](https://img.shields.io/npm/v/%40junhoyeo%2Fprompthistory?color=0073FF&labelColor=black&style=flat-square&logo=npm)](https://www.npmjs.com/package/@junhoyeo/prompthistory)
[![npm Downloads](https://img.shields.io/npm/dt/%40junhoyeo%2Fprompthistory?color=0073FF&labelColor=black&style=flat-square)](https://www.npmjs.com/package/@junhoyeo/prompthistory)
[![GitHub Stars](https://img.shields.io/github/stars/junhoyeo/prompthistory?color=0073FF&labelColor=black&style=flat-square)](https://github.com/junhoyeo/prompthistory/stargazers)
[![License](https://img.shields.io/badge/license-MIT-white?labelColor=black&style=flat-square)](https://github.com/junhoyeo/prompthistory/blob/main/LICENSE)

</div>

## Features

- 🔍 **Fuzzy search** through all your prompts
- 🔄 **Replay prompts** with different providers (OpenAI, Anthropic) and models
- 🧪 **Test framework** - create test cases with expected patterns, run and track results
- 📊 **Compare responses** - diff outputs from different models side-by-side
- 📁 **Filter by project** - find prompts from specific projects
- 📅 **Date range filtering** - search within time ranges
- 🎨 **Beautiful output** - formatted tables with colors
- ⚡ **Fast** - native SQLite queries for instant results
- 🧹 **Smart filtering** - automatically excludes slash commands, optional deduplication
- 📋 **Clipboard support** - copy any prompt with `--copy`
- 🖱️ **Interactive mode** - arrow key navigation with `--interactive`
- 📤 **Export** - save results as JSON, CSV, or plain text

## Installation

```bash
# Using npm
npm install -g @junhoyeo/prompthistory

# Using pnpm
pnpm add -g @junhoyeo/prompthistory

# Using bunx (no install needed)
bunx @junhoyeo/prompthistory
```

## Quick Start

```bash
# Interactive mode - browse recent prompts
prompthistory

# Search for prompts
prompthistory search "bug fix"

# Replay a prompt with a different model
prompthistory replay 1 --provider anthropic --model claude-sonnet-4-20250514

# Create and run test cases
prompthistory test add -i
prompthistory test run
```

## Commands

### `prompthistory` (default)

Launch interactive mode to browse and select from recent prompts.

### `prompthistory search [query]`

Search through your prompt history with optional filters.

**Options:**
- `-p, --project <project>` - Filter by project path (partial match)
- `-f, --from <date>` - Filter from date (YYYY-MM-DD)
- `-t, --to <date>` - Filter to date (YYYY-MM-DD)
- `--today` - Filter to today only
- `--last-7d` - Filter to last 7 days
- `-l, --limit <number>` - Limit number of results (default: 20)
- `-u, --unique` - Show only unique prompts (deduplicate)
- `--truncate` - Truncate long prompts in output
- `-c, --copy` - Copy selected result to clipboard
- `-i, --interactive` - Interactive mode with arrow key navigation
- `--include-slash-commands` - Include slash commands in results (excluded by default)

**Examples:**

```bash
# Basic search
prompthistory search "commit"

# Search with project filter
prompthistory search "api" --project my-project

# Search with date range
prompthistory search "bug" --from 2026-01-01

# Deduplicated results
prompthistory search "refactor" --unique --limit 10

# Interactive mode with copy
prompthistory search "api" --interactive --copy
```

### `prompthistory list`

List recent prompts without searching.

**Options:**
- `-l, --limit <number>` - Number of prompts to show (default: 10)
- `-p, --project <project>` - Filter by project path
- `-f, --from <date>` - Filter from date (YYYY-MM-DD)
- `-t, --to <date>` - Filter to date (YYYY-MM-DD)
- `--today` - Filter to today only
- `--last-7d` - Filter to last 7 days
- `--truncate` - Truncate long prompts in output
- `--include-slash-commands` - Include slash commands

**Examples:**

```bash
# Show 10 most recent prompts
prompthistory list

# Show 50 recent prompts
prompthistory list --limit 50

# Show recent prompts from specific project
prompthistory list --project my-project --limit 20
```

### `prompthistory show <index>`

Show detailed information about a specific prompt by its index from search/list results.

**Options:**
- `-c, --copy` - Copy prompt to clipboard

**Examples:**

```bash
prompthistory list --limit 5
prompthistory show 3

# Copy prompt to clipboard
prompthistory show 3 --copy
```

### `prompthistory replay <index>`

Re-run a prompt with a different provider or model. Great for comparing responses across models.

**Options:**
- `--provider <provider>` - Provider to use: `openai`, `anthropic` (default: openai)
- `--model <model>` - Model to use (defaults to provider's default)
- `--temperature <temp>` - Temperature (0.0-2.0)
- `--max-tokens <tokens>` - Max tokens in response
- `-i, --interactive` - Interactive mode to select provider/model
- `--no-save` - Do not save result to database

**Examples:**

```bash
# Replay prompt 1 with default settings
prompthistory replay 1

# Replay with Anthropic Claude
prompthistory replay 1 --provider anthropic --model claude-sonnet-4-20250514

# Interactive selection of provider and model
prompthistory replay 1 -i

# Replay with custom temperature
prompthistory replay 1 --provider openai --model gpt-4o --temperature 0.7
```

### `prompthistory test`

Manage and run prompt test cases. Create reusable tests with expected patterns.

#### `prompthistory test add [name]`

Create a new test case.

**Options:**
- `-i, --interactive` - Create from interactive prompt selection

**Examples:**

```bash
# Create test interactively from scratch
prompthistory test add

# Create test from an existing prompt
prompthistory test add -i
```

#### `prompthistory test run [name]`

Run test cases.

**Options:**
- `--provider <provider>` - Override provider
- `--model <model>` - Override model
- `--filter <pattern>` - Filter tests by name pattern
- `--tags <tags>` - Filter by tags (comma-separated)
- `-v, --verbose` - Show detailed output
- `--stop-on-failure` - Stop on first failure

**Examples:**

```bash
# Run all tests
prompthistory test run

# Run a specific test
prompthistory test run "my-test"

# Run with verbose output
prompthistory test run -v

# Run tests with specific tag
prompthistory test run --tags api,auth
```

#### `prompthistory test list`

List all test cases.

#### `prompthistory test show <name>`

Show detailed information about a test case.

#### `prompthistory test delete <name>`

Delete a test case.

### `prompthistory compare <id1> <id2>`

Compare two prompt results side-by-side with diff view.

**Options:**
- `--side-by-side` - Show side-by-side comparison instead of diff

**Examples:**

```bash
# Diff two results
prompthistory compare abc123 def456

# Side-by-side view
prompthistory compare abc123 def456 --side-by-side
```

### `prompthistory results`

List saved prompt results from replays and tests.

**Options:**
- `-l, --limit <number>` - Number of results to show (default: 20)

**Examples:**

```bash
prompthistory results
prompthistory results --limit 50
```

### `prompthistory stats`

Show statistics about your prompt history.

**Options:**
- `-p, --project <project>` - Filter by project path
- `-f, --from <date>` - Filter from date (YYYY-MM-DD)
- `-t, --to <date>` - Filter to date (YYYY-MM-DD)

**Statistics shown:**
- Total prompts, unique projects, unique sessions
- Average prompt length
- Top 5 most active projects with percentages
- Hourly activity distribution (ASCII bar chart)
- Top 10 keywords with frequency

**Examples:**

```bash
# Show all stats
prompthistory stats

# Stats for specific project
prompthistory stats --project my-project

# Stats for date range
prompthistory stats --from 2026-01-01 --to 2026-01-31
```

### `prompthistory export [query]`

Export search results to a file or stdout.

**Options:**
- `-p, --project <project>` - Filter by project path
- `-f, --from <date>` - Filter from date (YYYY-MM-DD)
- `-t, --to <date>` - Filter to date (YYYY-MM-DD)
- `--today` - Filter to today only
- `--last-7d` - Filter to last 7 days
- `-l, --limit <number>` - Limit number of results (default: 100)
- `--format <format>` - Output format: `json`, `csv`, or `txt` (default: json)
- `-o, --output <path>` - Output file path (prints to stdout if not specified)

**Examples:**

```bash
# Export as JSON to stdout
prompthistory export --limit 50 --format json

# Export to file
prompthistory export --format csv --output prompts.csv

# Export filtered results
prompthistory export "api" --project my-project --format txt -o api-prompts.txt
```

## MCP Server Mode

prompthistory can run as an MCP (Model Context Protocol) server, allowing AI assistants to query your prompt history.

### Installation as MCP Server

Add to your MCP settings (e.g., `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "prompthistory": {
      "command": "prompthistory-mcp"
    }
  }
}
```

Or if installed locally:

```json
{
  "mcpServers": {
    "prompthistory": {
      "command": "bunx",
      "args": ["@junhoyeo/prompthistory-mcp"]
    }
  }
}
```

### Available MCP Tools

Once configured, AI assistants can use these tools:

#### `search_prompts`

Search through OpenCode prompt history.

**Parameters:**
- `query` (string, optional): Search query text
- `project` (string, optional): Filter by project path
- `from` (string, optional): Filter from date (YYYY-MM-DD)
- `to` (string, optional): Filter to date (YYYY-MM-DD)
- `limit` (number, optional): Maximum results (default: 20)
- `unique` (boolean, optional): Deduplicate results

#### `list_prompts`

List recent prompts.

**Parameters:**
- `limit` (number, optional): Number of prompts (default: 10)
- `project` (string, optional): Filter by project path
- `from` (string, optional): Filter from date (YYYY-MM-DD)
- `to` (string, optional): Filter to date (YYYY-MM-DD)

#### `get_prompt`

Get a specific prompt by line number.

**Parameters:**
- `lineNumber` (number, required): Line number from search results

## Configuration

### Environment Variables

For replay and test features, set your API keys:

```bash
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
```

## Supported AI Coding Clients

prompthistory automatically detects and parses history from multiple AI coding assistants:

| Client | Location | Status |
|--------|----------|--------|
| **OpenCode** | `~/.local/share/opencode/opencode.db` | ✅ Full support |
| **Claude Code** | `~/.claude/projects/` | ✅ Full support |
| **Codex CLI** | `~/.codex/sessions/` | ✅ Full support |
| **Gemini CLI** | `~/.gemini/tmp/*/chats/` | ✅ Full support |
| **OpenClaw** | `~/.openclaw/agents/` | ✅ Full support |
| **Cursor IDE** | `~/.config/tokscale/cursor-cache/` | 🔜 Coming soon |
| **Amp** | `~/.local/share/amp/threads/` | 🔜 Coming soon |
| **Droid** | `~/.factory/sessions/` | 🔜 Coming soon |
| **Pi** | `~/.pi/agent/sessions/` | 🔜 Coming soon |
| **Kimi CLI** | `~/.kimi/sessions/` | 🔜 Coming soon |

All history is merged and sorted by timestamp for unified search across all your AI assistants!

> **Note**: Requires [Bun](https://bun.sh/) runtime due to use of `bun:sqlite` for native SQLite support.

## Development

```bash
# Clone the repo
git clone https://github.com/junhoyeo/prompthistory.git
cd prompthistory

# Install dependencies
bun install

# Build
bun run build

# Test locally
bun run dev search "test"
```

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/) (required for `bun:sqlite`)
- **Database**: [bun:sqlite](https://bun.sh/docs/api/sqlite) - Native SQLite bindings
- **CLI Framework**: [Commander.js](https://github.com/tj/commander.js)
- **AI Providers**: [OpenAI](https://github.com/openai/openai-node), [Anthropic](https://github.com/anthropics/anthropic-sdk-typescript)
- **Fuzzy Search**: [Fuse.js](https://fusejs.io)
- **Output Formatting**: [chalk](https://github.com/chalk/chalk), [cli-table3](https://github.com/cli-table/cli-table3)
- **Interactive UI**: [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js)
- **Clipboard**: [clipboardy](https://github.com/sindresorhus/clipboardy)
- **Date Handling**: [date-fns](https://date-fns.org)
- **Schema Validation**: [Zod](https://zod.dev)
- **Build Tool**: [tsup](https://tsup.egoist.dev)

## License

MIT © [junhoyeo](https://github.com/junhoyeo)

## Related

- [OpenCode](https://github.com/sst/opencode) - AI coding assistant
- [tokscale](https://github.com/junhoyeo/tokscale) - Track token usage from coding agents

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Made with ❤️ by [@junhoyeo](https://github.com/junhoyeo)
