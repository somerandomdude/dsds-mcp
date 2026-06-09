#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { loadSystems, summarizeEntities, loadIntroEntity } from './loader.js';
import { createServer } from './server.js';
import { startUpdateCheck } from './spec/version.js';
import { startWatching } from './watcher.js';

async function main() {
  const config = loadConfig();

  const [{ systems, errors }, introEntity] = await Promise.all([
    loadSystems(config.paths),
    loadIntroEntity(config.introPath),
  ]);

  // Startup diagnostics — always written to stderr so client logs show the state
  if (config.paths.length === 0) {
    process.stderr.write('[dsds-mcp] DSDS_PATHS not set — design system tools unavailable\n');
  } else {
    for (const system of systems) {
      process.stderr.write(`[dsds-mcp] Loaded ${system.entities.length} entities from ${system.filePath}\n`);
    }
    for (const { path, error } of errors) {
      process.stderr.write(`[dsds-mcp] Failed to load ${path}: ${error}\n`);
    }
    if (systems.length === 0) {
      process.stderr.write('[dsds-mcp] All paths failed to load — check paths and file permissions\n');
    }
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
    introEntity,
  );

  startWatching(config.paths, state);

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  process.stderr.write(`[dsds-mcp] Fatal error: ${err.message}\n`);
  process.exit(1);
});
