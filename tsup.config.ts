import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/mcp/server.ts'],
  format: ['esm'],
  target: 'node18',
  shims: true,
  dts: true,
  clean: true,
  minify: false,
  sourcemap: true,
  external: ['bun:sqlite'],
  banner: {
    js: '#!/usr/bin/env node',
  },
});
