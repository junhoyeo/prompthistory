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

[2026-01-13 19:19] - Publish to npm and Create Release Tag (Phase 6.4 Final)

### DISCOVERED ISSUES
- npm registry rejected package name "prompthistory" due to similarity with existing "prompt-history" package
- Error: "Package name too similar to existing package prompt-history; try renaming your package to '@junhoyeo/prompthistory'"
- npm registry propagation takes 3-5 minutes after successful publish

### IMPLEMENTATION DECISIONS
- Renamed package from "prompthistory" to "@junhoyeo/prompthistory" (scoped package)
- Used `npm publish --access=public` for public scoped package
- Created annotated tag with descriptive message listing all features
- Updated README.md to reflect scoped package name in installation instructions

### PROBLEMS FOR NEXT TASKS
- None - package is published and fully functional

### VERIFICATION RESULTS
- All 54 tests passed before publishing
- Git tag v0.1.0 created and pushed to GitHub
- npm publish succeeded: `+ @junhoyeo/prompthistory@0.1.0`
- npm info shows: version 0.1.0, 8 dependencies, MIT license
- `bunx @junhoyeo/prompthistory@latest --version` returns "0.1.0"
- Package available at: https://registry.npmjs.org/@junhoyeo/prompthistory

### LEARNINGS
- npm has name collision protection - packages with similar names are rejected
- Scoped packages (@scope/name) bypass name collision restrictions
- npm registry propagation can take 3-5 minutes after successful publish
- The success indicator `+ @package@version` in publish output confirms success even if info commands fail initially
- Always use `--access=public` for public scoped packages

Time taken: ~6 minutes

[2026-01-13 19:27] - Fix Oracle Verification Issues

### DISCOVERED ISSUES
- Performance test was passing (87.61ms < 100ms) - no fix needed
- JSON export was leaking internal fields (_lineNumber, _truncatedDisplay, _isSlashCommand)
- Default `prompthistory` command showed help instead of launching interactive mode
- Zod v4 deprecation: .passthrough() should be replaced with .catchall()
- Missing relative date shortcuts (--last-7d, --today) for filtering

### IMPLEMENTATION DECISIONS
- Added `stripInternalFields()` function to remove _* fields before JSON export
- Added default `.action()` to root program to launch interactive mode when no command specified
- Created src/utils/date.ts with `parseRelativeDate()` using date-fns for relative date handling
- Added `resolveDateRange()` helper to handle --today and --last-7d options
- Changed `.passthrough()` to `.catchall(z.unknown())` in schema.ts for Zod v4 compatibility
- Added --today and --last-7d options to search, list, and export commands

### PROBLEMS FOR NEXT TASKS
- None - all Oracle verification issues have been resolved

### VERIFICATION RESULTS
- All 54 tests passed
- npm run build succeeded
- npm run type-check passed
- JSON export verified: no internal fields (_*) in output
- search/list/export --help shows --today and --last-7d options
- Commit created: "fix: resolve Oracle verification issues"

### LEARNINGS
- Zod v4 deprecates .passthrough() in favor of .catchall(z.unknown())
- Commander.js allows default .action() on root program for no-command scenarios
- date-fns provides startOfDay/endOfDay/subDays for precise relative date calculations
- Object destructuring with rest operator is clean way to strip internal fields

Time taken: ~8 minutes

[2026-01-13 19:32] - Update README Documentation for New Date Options

### DISCOVERED ISSUES
- README.md was missing documentation for --today and --last-7d options despite CLI having them
- Test name "should allow unknown fields with passthrough" was inconsistent with actual implementation using .catchall()
- Performance benchmark test is flaky - expects <100ms for real history but user's 802 entries takes ~140-150ms

### IMPLEMENTATION DECISIONS
- Added --today and --last-7d options to search command documentation (after --to option)
- Added --today and --last-7d options to list command documentation (after --project option)
- Added --today and --last-7d options to export command documentation (after --to option)
- Changed test name from "passthrough" to "catchall" to match actual Zod implementation

### PROBLEMS FOR NEXT TASKS
- Performance test in e2e.test.ts:378 is flaky - expectation of <100ms may need adjustment for users with larger history files

### VERIFICATION RESULTS
- All 4 edits applied successfully to README.md and tests/schema.test.ts
- Schema tests: 17/17 passed (including renamed test)
- Full test suite: 53 pass, 1 fail (pre-existing flaky performance test unrelated to changes)

### LEARNINGS
- When documenting CLI options, check --help output to ensure documentation matches actual implementation
- Performance benchmarks with hardcoded thresholds can be flaky based on user's data size
- Test names should accurately reflect what they're testing (catchall vs passthrough)

Time taken: ~3 minutes
