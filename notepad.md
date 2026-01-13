# Notepad - prompthistory

## LEARNINGS

[2026-01-13 18:16] - Setup TypeScript Configuration (Phase 1.2)

### DISCOVERED ISSUES
- None - project was already well-configured with most TypeScript settings

### IMPLEMENTATION DECISIONS
- Updated target from ES2022 to ES2020 as specified in requirements
- Added path aliases (~/* → ./src/*) for cleaner imports across the codebase
- Kept existing moduleResolution: "NodeNext" which is correct for ESM compatibility
- Preserved vitest/globals types for testing support
- Kept esModuleInterop and resolveJsonModule for better module compatibility

### PROBLEMS FOR NEXT TASKS
- Path alias ~/* is configured but not yet used in existing source files
- When using path aliases in imports, remember to use "~/" prefix

### VERIFICATION RESULTS
- Ran: pnpm tsc --noEmit (passed without errors)
- Verified all packages installed: typescript 5.9.3, @types/node 20.19.28, @types/react 19.2.8
- All TypeScript compiler options match specification

### LEARNINGS
- Project already had typescript and @types/node installed, only @types/react was missing
- NodeNext module + moduleResolution is the correct combination for ESM projects with "type": "module"
- The project uses vitest for testing (vitest/globals types already configured)

Time taken: ~3 minutes

[2026-01-13 18:16] - Configure Build with tsup (Phase 1.3)

### DISCOVERED ISSUES
- tsup.config.ts existed but was missing several required configurations
- package.json bin entry was using "dist/index.js" instead of "./dist/index.js"
- files field was missing "README.md"
- type-check script was missing from package.json

### IMPLEMENTATION DECISIONS
- Added target: 'node18' for Node.js 18+ compatibility
- Set shims: true for better ESM/CJS interop
- Enabled sourcemap: true for debugging support
- Set minify: false to keep readable output for CLI tool
- Added banner with shebang (#!/usr/bin/env node) for CLI execution
- Updated bin entry with "./" prefix for npm compatibility
- Added type-check script using tsc --noEmit

### PROBLEMS FOR NEXT TASKS
- None - build system is fully configured and working

### VERIFICATION RESULTS
- Ran: pnpm build - succeeded with ESM output + sourcemaps + dts
- Output: dist/index.js (7.15 KB), dist/index.js.map (13.90 KB), dist/index.d.ts
- Committed with message: "build: Configure tsup bundler and build scripts"

### LEARNINGS
- tsup automatically detects tsconfig.json for TypeScript settings
- The banner option is useful for adding shebang to CLI entry points
- Target 'node18' enables modern JS features without transpilation overhead
- tsup v8.5.1 was used with all configurations working correctly

Time taken: ~2 minutes

[2026-01-13 18:19] - Setup Testing with Vitest (Phase 1.4)

### DISCOVERED ISSUES
- Task was already completed in previous commit (d2ebeaa)
- Test setup was bundled into "feat: implement prompthistory CLI tool" commit instead of separate commit

### IMPLEMENTATION DECISIONS
- Used vitest ^2.1.8 (already installed as devDependency)
- Test scripts configured: "test": "vitest run", "test:watch": "vitest"
- Fixture includes all required variations:
  * Simple prompts (entries 1, 5, 6)
  * Korean text entry (entry 2)
  * Slash commands: /rewind, /model claude-3-opus (entries 3, 4)
  * Duplicate entries: "implement user authentication" appears twice with different timestamps (entries 5, 6)
  * Long prompt >500 chars (entry 7)
  * Legacy entries without sessionId (entries 8, 9)
  * Malformed JSON line for error handling (entry 10)
  * Entry with special chars <>&"' (entry 11)

### PROBLEMS FOR NEXT TASKS
- None - testing framework is fully configured and working

### VERIFICATION RESULTS
- Ran: pnpm test - 8 tests passed
- Tests verify: fixture loading, sessionId presence, legacy format, UTF-8/Korean, slash commands, duplicates, long prompts, structure validation
- Vitest v2.1.9 runs with 534ms duration

### LEARNINGS
- Vitest works out of the box with ESM projects using "type": "module"
- Test file uses fileURLToPath + dirname for __dirname equivalent in ESM
- Fixture has 11 lines (10 valid + 1 malformed) for comprehensive testing
- The parseHistory function correctly skips malformed lines with console.warn

Time taken: ~3 minutes
