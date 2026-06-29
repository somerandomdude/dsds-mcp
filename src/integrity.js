/**
 * Integrity checks — pure functions, no I/O. The guard (scripts/check-integrity.js)
 * supplies the data; these decide pass/fail. Each returns an array of error strings
 * (empty = pass).
 *
 * Covers the three reference classes from the integrity PRD:
 *   1. every import from the configured icon package (ICON_PACKAGE) resolves to a real export
 *   2. no brief directs agents to an entity kind that returns nothing
 *   3. one spec version across every source
 */

/** Build the `import { … } from '<pkg>'` matcher for a given package name. */
function iconImportBlock(iconPackage) {
  const escaped = iconPackage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escaped}['"]`, 'g');
}

/** Extract the imported names from every `import { … } from '<iconPackage>'`. */
export function extractIconImports(code, iconPackage) {
  const names = new Set();
  if (!iconPackage) return [];
  const re = iconImportBlock(iconPackage);
  let m;
  while ((m = re.exec(code ?? '')) !== null) {
    for (const part of m[1].split(',')) {
      // Strip comments, whitespace, and `as` aliases → the source export name.
      const name = part.replace(/\/\/.*$/gm, '').trim().split(/\s+as\s+/)[0].trim();
      if (/^[A-Za-z][A-Za-z0-9]*$/.test(name)) names.add(name);
    }
  }
  return [...names];
}

/** Parse exported icon names from the icon package's `dist/index.d.ts` string. */
export function parseIconExports(dts) {
  const set = new Set();
  const re = /(?:export\s+)?declare const\s+([A-Z][A-Za-z0-9]*Icon)\b/g;
  let m;
  while ((m = re.exec(dts ?? '')) !== null) set.add(m[1]);
  return set;
}

/** Flag any icon import in chunk code that is not a real export of the icon package. */
export function checkIconImports(chunks, iconExports, iconPackage) {
  const errors = [];
  for (const { identifier, code } of chunks) {
    for (const name of extractIconImports(code, iconPackage)) {
      if (!iconExports.has(name)) {
        errors.push(`Chunk "${identifier}" imports "${name}" from ${iconPackage}, which is not an export.`);
      }
    }
  }
  return errors;
}

/**
 * Flag directive references (`kind=X`, `kind: "X"`) to an entity kind that has no
 * loaded entities — i.e. an agent told to query a layer that returns nothing.
 * `kindsWithEntities` is a Set of kinds present in the loaded DSDS.
 */
export function checkKindReferences(text, kindsWithEntities) {
  const errors = [];
  const re = /kind\s*[=:]\s*['"`]?([a-z][a-z-]*)['"`]?/gi;
  const seen = new Set();
  let m;
  while ((m = re.exec(text ?? '')) !== null) {
    const kind = m[1].toLowerCase();
    if (seen.has(kind)) continue;
    seen.add(kind);
    if (!kindsWithEntities.has(kind)) {
      errors.push(`A brief directs agents to "kind=${kind}", but no loaded entity has that kind — the query returns nothing.`);
    }
  }
  return errors;
}

/** Flag any version source that does not match the bundled spec version. */
export function checkVersions(bundled, sources) {
  const errors = [];
  for (const { label, version } of sources) {
    if (version !== bundled) {
      errors.push(`Version drift: ${label} is "${version}", expected "${bundled}".`);
    }
  }
  return errors;
}

/** Extract spec-version strings from the README (for the version check). */
export function readmeVersions(readme) {
  const out = [];
  const push = (re, label) => { const m = (readme ?? '').match(re); if (m) out.push({ label, version: m[1] }); };
  push(/Bundled spec version:\*\*\s*([0-9][0-9.]*)/, 'README "Bundled spec version"');
  push(/Defaults to `([0-9][0-9.]*)`/, 'README "DSDS_SCHEMA_VERSION default"');
  for (const m of (readme ?? '').matchAll(/designsystemdocspec\.org\/v([0-9][0-9.]*)\//g)) out.push({ label: 'README schema URL', version: m[1] });
  for (const m of (readme ?? '').matchAll(/"dsdsVersion":\s*"([0-9][0-9.]*)"/g)) out.push({ label: 'README dsdsVersion example', version: m[1] });
  return out;
}
