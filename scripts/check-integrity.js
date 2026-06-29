#!/usr/bin/env node
/**
 * DSDS integrity guard. Fails (exit 1) when a reference DSDS could return to an
 * agent is broken:
 *   - an @sanity/icons import in chunk code that is not a real export
 *   - a brief directing agents to an entity kind that returns nothing
 *   - a spec-version string that has drifted from the bundled version
 *
 * Run it with the same env the MCP uses (DSDS_PATHS, PACKAGE_EXPORT_PATHS):
 *   DSDS_PATHS=/path/to/sanity-ui.dsds.json \
 *   PACKAGE_EXPORT_PATHS=@sanity/icons=/path/to/@sanity/icons \
 *   node scripts/check-integrity.js
 *
 * Checks whose inputs aren't configured are skipped with a warning rather than
 * failing, so the version check still runs in a bare dsds-mcp checkout.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { loadSystems } from '../src/loader.js';
import { BUNDLED_VERSION } from '../src/spec/version.js';
import { BUILD_BRIEF } from '../src/briefs.js';
import {
  checkIconImports, checkKindReferences, checkVersions, parseIconExports, readmeVersions,
} from '../src/integrity.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const cfg = loadConfig();

// ── Load entities (chunks + which kinds are populated) ───────────────────────
let chunks = [];
const kindsWithEntities = new Set();
if (cfg.paths.length) {
  const { systems, errors: loadErrors } = await loadSystems(cfg.paths);
  for (const e of loadErrors ?? []) warnings.push(`Load error: ${e.path} — ${e.error}`);
  const entities = systems.flatMap((s) => s.entities);
  for (const e of entities) if (e.kind) kindsWithEntities.add(e.kind);
  chunks = entities.filter((e) => e.kind === 'chunk' && e.code?.code).map((e) => ({ identifier: e.identifier, code: e.code.code }));
} else {
  warnings.push('DSDS_PATHS not set — skipping icon-import and kind-reference checks.');
}

// ── R1: every icon import resolves to a real @sanity/icons export ────────────
const iconsPath = cfg.packageExportPaths.get('@sanity/icons');
if (chunks.length) {
  if (iconsPath) {
    try {
      const exports = parseIconExports(readFileSync(join(iconsPath, 'dist/index.d.ts'), 'utf8'));
      if (exports.size) errors.push(...checkIconImports(chunks, exports));
      else warnings.push(`No icon exports parsed from ${iconsPath} — skipping icon check.`);
    } catch (err) {
      warnings.push(`Could not read @sanity/icons exports (${iconsPath}): ${err.message}`);
    }
  } else {
    warnings.push('PACKAGE_EXPORT_PATHS has no @sanity/icons entry — skipping icon-import check.');
  }
}

// ── R2: no build-brief directive points at an empty kind ─────────────────────
if (cfg.paths.length) {
  errors.push(...checkKindReferences(BUILD_BRIEF, kindsWithEntities));
}

// ── R3: one spec version across version.js, config, README, DSDS files ───────
const versionSources = [{ label: 'config default (DSDS_SCHEMA_VERSION)', version: cfg.schemaVersion }];
try {
  versionSources.push(...readmeVersions(readFileSync(join(ROOT, 'README.md'), 'utf8')));
} catch { /* no README */ }
for (const p of cfg.paths) {
  try {
    const doc = JSON.parse(readFileSync(p, 'utf8'));
    if (doc.dsdsVersion) versionSources.push({ label: `dsdsVersion in ${basename(p)}`, version: doc.dsdsVersion });
  } catch { /* unreadable file is the loader's problem, reported above */ }
}
errors.push(...checkVersions(BUNDLED_VERSION, versionSources));

// ── Report ───────────────────────────────────────────────────────────────────
for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length) {
  console.error(`\n✗ DSDS integrity check failed — ${errors.length} issue(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`✓ DSDS integrity check passed (bundled spec ${BUNDLED_VERSION})${warnings.length ? ` — ${warnings.length} check(s) skipped` : ''}`);
