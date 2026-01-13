# prompthistory

> CLI tool to search and navigate your OpenCode prompt history

[![npm version](https://badge.fury.io/js/@junhoyeo/prompthistory.svg)](https://www.npmjs.com/package/@junhoyeo/prompthistory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔍 **Fuzzy search** through all your prompts
- 📁 **Filter by project** - find prompts from specific projects
- 📅 **Date range filtering** - search within time ranges
- 🎨 **Beautiful output** - formatted tables with colors
- ⚡ **Fast** - streaming parser handles large history files efficiently
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

## Usage

### List recent prompts

```bash
prompthistory list --limit 10
```

### Search by keyword

```bash
prompthistory search "bug fix"
prompthistory search "api"
```

### Filter by project

```bash
prompthistory search "refactor" --project tokscale
```

### Filter by date

```bash
prompthistory search "commit" --from 2026-01-01 --to 2026-01-13
```

### Show detailed information

```bash
prompthistory show 5
```

## Commands

### `prompthistory search [query]`

Search through your prompt history with optional filters.

**Options:**
- `-p, --project <project>` - Filter by project path (partial match)
- `-f, --from <date>` - Filter from date (YYYY-MM-DD)
- `-t, --to <date>` - Filter to date (YYYY-MM-DD)
- `-l, --limit <number>` - Limit number of results (default: 20)
- `-u, --unique` - Show only unique prompts (deduplicate)
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

### `prompthistory export [query]`

Export search results to a file or stdout.

**Options:**
- `-p, --project <project>` - Filter by project path
- `-f, --from <date>` - Filter from date (YYYY-MM-DD)
- `-t, --to <date>` - Filter to date (YYYY-MM-DD)
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

## Data Source

This tool reads from your OpenCode history file:
- **Location**: `~/.claude/history.jsonl`
- **Format**: JSON Lines (one JSON object per line)
- **Read-only**: Never modifies your history file

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

- **CLI Framework**: [Commander.js](https://github.com/tj/commander.js)
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

- [OpenCode](https://github.com/cline/cline) - AI coding assistant
- [tokscale](https://github.com/junhoyeo/tokscale) - Track token usage from coding agents

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Made with ❤️ by [@junhoyeo](https://github.com/junhoyeo)
