import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractSanityIconImports, parseIconExports, checkIconImports,
  checkKindReferences, checkVersions, readmeVersions,
} from '../src/integrity.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

describe('extractSanityIconImports', () => {
  it('parses single, multi-line, and aliased imports; ignores other packages', () => {
    const code = "import { AddIcon, CloseIcon } from '@sanity/icons'\nimport {\n  SortIcon as S,\n} from '@sanity/icons'\nimport { Box } from '@sanity-labs/ui-poc'";
    expect(extractSanityIconImports(code).sort()).toEqual(['AddIcon', 'CloseIcon', 'SortIcon']);
  });
});

describe('parseIconExports', () => {
  it('extracts XIcon declarations from a d.ts', () => {
    const dts = 'declare const AddIcon: any;\nexport declare const SearchIcon: any;\ndeclare const helper: any;';
    const s = parseIconExports(dts);
    expect(s.has('AddIcon')).toBe(true);
    expect(s.has('SearchIcon')).toBe(true);
    expect(s.has('helper')).toBe(false);
  });
});

describe('checkIconImports', () => {
  const exports = new Set(['AddIcon', 'SortIcon']);
  it('passes when every import resolves', () => {
    expect(checkIconImports([{ identifier: 'c', code: "import { AddIcon } from '@sanity/icons'" }], exports)).toEqual([]);
  });
  it('flags an unresolved (hallucinated) icon, naming the chunk', () => {
    const errs = checkIconImports([{ identifier: 'toolbar', code: "import { FakeIcon } from '@sanity/icons'" }], exports);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('FakeIcon');
    expect(errs[0]).toContain('toolbar');
  });
});

describe('checkKindReferences', () => {
  const present = new Set(['chunk', 'token-group', 'pattern']);
  it('passes for populated kinds', () => {
    expect(checkKindReferences('query kind=chunk then kind=token-group', present)).toEqual([]);
  });
  it('flags a directive to an empty kind', () => {
    const errs = checkKindReferences('Call dsds_search_entities with kind=token', present);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('kind=token');
  });
  it('does not flag glossary backticks (non-directive)', () => {
    expect(checkKindReferences('| `token` | an individual design value |', present)).toEqual([]);
  });
});

describe('checkVersions', () => {
  it('passes when all match the bundled version', () => {
    expect(checkVersions('0.12.0', [{ label: 'a', version: '0.12.0' }, { label: 'b', version: '0.12.0' }])).toEqual([]);
  });
  it('flags drift', () => {
    const errs = checkVersions('0.12.0', [{ label: 'README', version: '0.10.2' }]);
    expect(errs).toHaveLength(1);
    expect(errs[0]).toContain('0.10.2');
  });
});

describe('readmeVersions', () => {
  it('pulls spec versions from the README patterns', () => {
    const rm = '**Bundled spec version:** 0.12.0\nDefaults to `0.12.0`.\nhttps://designsystemdocspec.org/v0.12.0/dsds.bundled.schema.json\n"dsdsVersion": "0.12.0"';
    const vs = readmeVersions(rm);
    expect(vs.length).toBeGreaterThanOrEqual(4);
    expect(vs.every((v) => v.version === '0.12.0')).toBe(true);
  });
});

// Full guard against the configured DSDS — runs only when env is set (e.g. CI).
describe('integration: check-integrity script', () => {
  it.runIf(process.env.DSDS_PATHS)('passes on the configured design system', () => {
    execFileSync('node', ['scripts/check-integrity.js'], { cwd: ROOT, stdio: 'pipe' }); // throws on exit 1
  });
});
