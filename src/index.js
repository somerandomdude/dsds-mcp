#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { loadSystems, summarizeEntities } from './loader.js';
import { createServer } from './server.js';
import { startUpdateCheck } from './spec/version.js';
import { startWatching } from './watcher.js';

async function main() {
  const config = loadConfig();

  const { systems, errors } = await loadSystems(config.paths);
  for (const { path, error } of errors) {
    process.stderr.write(`[dsds-mcp] Failed to load ${path}: ${error}\n`);
  }

  startUpdateCheck();

  // Shared mutable state — watcher updates these in place on file change
  const state = {
    systems,
    summaries: summarizeEntities(systems),
  };

  const server = createServer(
    () => state.systems,
    () => state.summaries,
  );

  startWatching(config.paths, state);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  process.stderr.write(`[dsds-mcp] Fatal error: ${err.message}\n`);
  process.exit(1);
});
