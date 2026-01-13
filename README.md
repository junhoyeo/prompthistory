# prompthistory

> CLI tool to search and navigate your OpenCode prompt history

[![npm version](https://badge.fury.io/js/prompthistory.svg)](https://www.npmjs.com/package/prompthistory)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔍 **Fuzzy search** through all your prompts
- 📁 **Filter by project** - find prompts from specific projects
- 📅 **Date range filtering** - search within time ranges
- 🎨 **Beautiful output** - formatted tables with colors
- ⚡ **Fast** - streaming parser handles large history files efficiently
- 🧹 **Smart filtering** - automatically excludes slash commands, optional deduplication

## Installation

```bash
# Using npm
npm install -g prompthistory

# Using pnpm
pnpm add -g prompthistory

# Using bunx (no install needed)
bunx prompthistory
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

**Example:**

```bash
prompthistory list --limit 5
prompthistory show 3
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
pnpm install

# Build
pnpm build

# Test locally
pnpm dev search "test"
```

## Tech Stack

- **CLI Framework**: [Commander.js](https://github.com/tj/commander.js)
- **Fuzzy Search**: [Fuse.js](https://fusejs.io)
- **Output Formatting**: [chalk](https://github.com/chalk/chalk), [cli-table3](https://github.com/cli-table/cli-table3)
- **Date Handling**: [date-fns](https://date-fns.org)
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
