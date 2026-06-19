import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { writeLog } from '../logger.js';

// Session-level lint result cache. An agent can pass { cacheKey, filename } instead of
// { code, filename } on subsequent calls to avoid re-sending unchanged file content.
// Cache key = first 12 hex chars of SHA-256(source). LRU eviction at MAX_CACHE entries.
const MAX_CACHE = 200;
const lintCache = new Map();

function computeCacheKey(code) {
  return createHash('sha256').update(code).digest('hex').slice(0, 12);
}

function storeCacheEntry(key, result) {
  if (lintCache.has(key)) lintCache.delete(key); // refresh insertion order
  if (lintCache.size >= MAX_CACHE) lintCache.delete(lintCache.keys().next().value);
  lintCache.set(key, result);
}

function pluginPrefix(packageName) {
  const scoped = packageName.match(/^(@[^/]+)\/eslint-plugin(?:-(.+))?$/);
  if (scoped) return scoped[2] ? `${scoped[1]}/${scoped[2]}` : scoped[1];
  const bare = packageName.match(/^eslint-plugin-(.+)$/);
  if (bare) return bare[1];
  return packageName;
}

async function requirePlugin(packageName, resolveDir) {
  const req = createRequire(resolve(resolveDir, 'package.json'));
  try {
    const mod = req(packageName);
    return mod.default ?? mod;
  } catch (err) {
    if (err.code === 'ERR_REQUIRE_ESM') {
      const resolved = req.resolve(packageName);
      const mod = await import(pathToFileURL(resolved).href);
      return mod.default ?? mod;
    }
    throw err;
  }
}

function rulesFromPlugin(prefix, plugin) {
  const recommended = plugin.configs?.recommended;
  if (Array.isArray(recommended)) {
    const rules = {};
    for (const entry of recommended) {
      if (entry.rules) Object.assign(rules, entry.rules);
    }
    if (Object.keys(rules).length > 0) return rules;
  }
  if (recommended?.rules) return recommended.rules;
  // Fall back: enable all rules at warn
  const rules = {};
  for (const ruleName of Object.keys(plugin.rules ?? {})) {
    rules[`${prefix}/${ruleName}`] = 'warn';
  }
  return rules;
}

// Returns filenames that look like stubs: JSX/TSX files with no JSX elements in the body.
// Design-system rules only fire on actual JSX, so linting stubs produces no useful signal.
function detectStubFiles(filesToLint) {
  const stubs = [];
  for (const file of filesToLint) {
    if (!file.code) continue; // cache-only entries were already linted — skip
    const filename = file.filename ?? 'Component.tsx';
    if (!/\.[jt]sx$/.test(filename)) continue;
    // Strip import lines, then check for any JSX element syntax
    const withoutImports = (file.code ?? '').replace(
      /^\s*import\s[\s\S]*?from\s['"][^'"]+['"]\s*;?\s*$/gm,
      '',
    );
    if (!/<[A-Za-z]/.test(withoutImports)) {
      stubs.push(filename);
    }
  }
  return stubs;
}

function inferLanguage(filename) {
  if (filename.endsWith('.tsx')) return 'tsx';
  if (filename.endsWith('.ts')) return 'ts';
  if (filename.endsWith('.jsx')) return 'jsx';
  return 'js';
}

export const lintCodeDef = {
  name: 'dsds_lint_code',
  description:
    'Lint code against the configured ESLint plugins. ' +
    'Auto-applies all fixable violations and returns the corrected code — copy the corrected code directly into your files. ' +
    'Returns remaining violations that require manual edits alongside the corrected code. ' +
    'Use the `files` array to lint ALL generated files in one call — this is the preferred usage. ' +
    'TOKEN-SAVING — read carefully: ' +
    '(1) ONE PASS. A clean or auto-fixed result is FINAL — after applying the corrected code, do NOT call this tool ' +
    'again just to confirm. Re-linting unchanged code only re-sends tokens you already have. ' +
    '(2) CHANGED FILES ONLY. On any later call, send only the files you actually changed since the last call; for ' +
    'files that have not changed, pass `cacheKey` (from a previous result) or `path` instead of re-sending `code`. ' +
    '(3) LINT BY PATH. If a file is already written to disk, pass `path` (relative to the lint project root) instead ' +
    'of `code` so you do not have to re-emit its contents at all. ' +
    'Code produced by dsds_build_component is already design-system-valid — do not lint it. ' +
    'IMPORTANT: Only lint complete implementations. Design-system rules fire on JSX elements — ' +
    'stub files that return null or contain no JSX will produce no design-system violations, ' +
    'giving a false all-clear. Always call this tool after writing your final component code.',
  inputSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        description:
          'Batch mode: lint multiple files at once. Pass every file you generated. ' +
          'Each entry needs either `code` (full source) or `cacheKey` (from a previous call). ' +
          'Pass `cacheKey` instead of `code` for files that have not changed since the last lint call.',
        items: {
          type: 'object',
          properties: {
            code:     { type: 'string', description: 'Source code to lint. Required unless `cacheKey` or `path` is provided.' },
            filename: { type: 'string', description: "Filename for parser inference (e.g. 'App.tsx')." },
            cacheKey: { type: 'string', description: 'Cache key from a previous dsds_lint_code call. Pass this instead of `code` to skip re-sending unchanged file content.' },
            path:     { type: 'string', description: 'Path to a file already written to disk, relative to the lint project root. Pass this instead of `code` to lint without re-sending the file contents.' },
          },
        },
      },
      code: {
        type: 'string',
        description: 'Single-file mode: source code to lint. Use `files` instead when you have multiple files.',
      },
      filename: {
        type: 'string',
        description: "Single-file mode: filename for parser inference (e.g. 'Component.tsx'). Defaults to Component.tsx.",
      },
      cacheKey: {
        type: 'string',
        description: 'Single-file mode: cache key from a previous call. Pass this instead of `code` to skip re-sending unchanged file content.',
      },
      path: {
        type: 'string',
        description: 'Single-file mode: path to a file already on disk (relative to the lint project root). Pass this instead of `code` to avoid re-sending its contents.',
      },
    },
  },
};

async function writeLintLog(logsDir, fileResults) {
  const relevant = fileResults.filter(f => f.messages?.length > 0 || f.fixed);
  if (relevant.length === 0) return;

  await writeLog(logsDir, {
    type: 'lint',
    filesLinted: fileResults.length,
    filesFixed: fileResults.filter(f => f.fixed).length,
    totalRemainingViolations: fileResults.reduce((n, f) => n + (f.messages?.length ?? 0), 0),
    files: relevant.map(f => ({
      filename: f.filename,
      fixed: f.fixed ?? false,
      violations: (f.messages ?? []).map(m => ({
        ruleId: m.ruleId ?? null,
        severity: m.severity,
        line: m.line,
        col: m.column,
        fixable: m.fix,
      })),
    })),
  });
}

export async function lintCodeHandler(args, getLintConfig, logsDir = null) {
  // Normalise input: batch `files` array takes priority over single code/cacheKey.
  const filesToLint = args.files?.length
    ? args.files
    : args.code != null || args.cacheKey != null || args.path != null
      ? [{ code: args.code, filename: args.filename, cacheKey: args.cacheKey, path: args.path }]
      : null;

  if (!filesToLint) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Provide either `files` (array), `code` (string), `path` (file on disk), or `cacheKey` (from a previous call).' }],
    };
  }

  const { plugins: pluginNames, resolveDir, sourceDir } = getLintConfig();
  // Files (and ESLint's cwd) live in the project being linted, when configured;
  // plugins are still resolved from resolveDir (where they're installed).
  const lintDir = sourceDir || resolveDir;

  if (pluginNames.length === 0) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: [
          '## No ESLint plugins configured',
          '',
          'Set `LINT_PLUGINS` in your MCP client config `env` block:',
          '',
          '```json',
          '"env": {',
          '  "LINT_PLUGINS": "eslint-plugin-sanity-ui",',
          '  "LINT_RESOLVE_DIR": "/absolute/path/to/your/project"',
          '}',
          '```',
          '',
          '`LINT_RESOLVE_DIR` should be the root of the project where your ESLint plugins are installed.',
          'Multiple plugins: `"LINT_PLUGINS": "eslint-plugin-sanity-ui,eslint-plugin-react"`',
        ].join('\n'),
      }],
    };
  }

  let ESLint;
  try {
    ({ ESLint } = await import('eslint'));
  } catch {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: '`eslint` is not installed. Run `npm install eslint` in your dsds-mcp directory or add it as a devDependency.',
      }],
    };
  }

  const loadedPlugins = {};
  const loadErrors = [];

  await Promise.all(pluginNames.map(async name => {
    try {
      loadedPlugins[name] = await requirePlugin(name, resolveDir);
    } catch (err) {
      loadErrors.push(`\`${name}\`: ${err.message}`);
    }
  }));

  if (Object.keys(loadedPlugins).length === 0) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: [
          '## Failed to load ESLint plugins',
          '',
          ...loadErrors,
          '',
          `Make sure the plugins are installed in LINT_RESOLVE_DIR (${resolveDir}).`,
        ].join('\n'),
      }],
    };
  }

  // Build overrideConfig from each plugin.
  const overrideConfig = [];
  for (const [name, plugin] of Object.entries(loadedPlugins)) {
    if (Array.isArray(plugin.configs?.recommended)) {
      overrideConfig.push(...plugin.configs.recommended);
    } else {
      const prefix = pluginPrefix(name);
      const rules = rulesFromPlugin(prefix, plugin);
      overrideConfig.push({ plugins: { [prefix]: plugin }, rules });
    }
  }

  // fix: true — auto-apply all fixable violations; result.output holds the corrected code.
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig,
    cwd: lintDir,
    fix: true,
  });

  // Warn the agent if it submitted stub files (no JSX → design-system rules won't fire)
  const stubFiles = detectStubFiles(filesToLint);

  // Lint all files
  const fileResults = [];
  for (const file of filesToLint) {
    // Lint-by-path: the file is already on disk, so read it here instead of
    // making the agent re-emit its full contents as a tool argument.
    if (file.path && file.code == null && file.cacheKey == null) {
      try {
        file.code = await readFile(resolve(lintDir, file.path), 'utf-8');
        file.filename = file.filename ?? file.path;
      } catch (err) {
        fileResults.push({
          filename: file.filename ?? file.path, messages: [], fixedCode: null, fixed: false, cacheKey: null,
          error: `Could not read "${file.path}" (relative to ${lintDir}): ${err.message}`,
        });
        continue;
      }
    }

    const filename = file.filename ?? 'Component.tsx';

    // Cache hit: agent passed a key from a previous call — return stored result.
    if (file.cacheKey && !file.code) {
      const cached = lintCache.get(file.cacheKey);
      if (!cached) {
        fileResults.push({
          filename, messages: [], fixedCode: null, fixed: false, cacheKey: null,
          error: `Cache miss for key "${file.cacheKey}". Re-send this file with full \`code\`.`,
        });
      } else {
        fileResults.push({ ...cached, filename });
      }
      continue;
    }

    if (!file.code) {
      fileResults.push({
        filename, messages: [], fixedCode: null, fixed: false, cacheKey: null,
        error: 'Provide either `code` (source) or `cacheKey` (from a previous dsds_lint_code call).',
      });
      continue;
    }

    const filePath = resolve(lintDir, filename);
    try {
      const results = await eslint.lintText(file.code, { filePath });
      const r = results[0];
      // output is only set when at least one fix was applied
      const fixedCode = r?.output ?? null;
      const fixed = fixedCode !== null;
      const messages = (r?.messages ?? []).map(m => ({
        ruleId: m.ruleId,
        severity: m.severity,
        message: m.message,
        line: m.line,
        column: m.column,
        fix: !!m.fix,
      }));
      const cacheKey = computeCacheKey(file.code);
      const result = { filename, messages, fixedCode, fixed, cacheKey };
      storeCacheEntry(cacheKey, result);
      fileResults.push(result);
    } catch (err) {
      fileResults.push({ filename, error: err.message, messages: [], fixedCode: null, fixed: false, cacheKey: null });
    }
  }

  // Write log entry (best-effort, non-blocking)
  if (logsDir) writeLintLog(logsDir, fileResults);

  // Render output
  const lines = [];
  const isBatch = filesToLint.length > 1;

  const totalRemaining = fileResults.reduce((n, f) => n + (f.messages?.length ?? 0), 0);
  const filesFixed = fileResults.filter(f => f.fixed).length;
  const filesWithErrors = fileResults.filter(f => f.error).length;
  const filesClean = fileResults.filter(f => !f.error && !f.fixed && f.messages?.length === 0).length;
  const filesAutoFixedClean = fileResults.filter(f => f.fixed && f.messages?.length === 0).length;
  const filesWithRemaining = fileResults.filter(f => f.messages?.length > 0).length;

  if (isBatch) {
    const allClean = totalRemaining === 0 && !fileResults.some(f => f.error);
    if (allClean && filesFixed === 0) {
      lines.push(`All ${fileResults.length} files lint clean.`);
    } else if (allClean && filesFixed > 0) {
      lines.push(
        `All ${fileResults.length} files lint clean after auto-fix. ` +
        `Apply the corrected code for ${filesFixed} file${filesFixed === 1 ? '' : 's'} below.`,
        '',
      );
    } else {
      const parts = [];
      if (filesFixed > 0) parts.push(`${filesFixed} auto-fixed`);
      if (filesClean > 0) parts.push(`${filesClean} clean`);
      if (filesWithRemaining > 0) parts.push(`${filesWithRemaining} with remaining violations`);
      if (filesWithErrors > 0) parts.push(`${filesWithErrors} error`);
      lines.push(
        `## Lint results — ${fileResults.length} file${fileResults.length === 1 ? '' : 's'} (${parts.join(', ')}), ` +
        `${totalRemaining} remaining violation${totalRemaining === 1 ? '' : 's'}`,
        '',
      );
    }

    for (const f of fileResults) {
      if (f.error) {
        lines.push(`### \`${f.filename}\` — ESLint error`, '', f.error, '');
        continue;
      }

      const lang = inferLanguage(f.filename);

      if (f.fixed && f.messages.length === 0) {
        lines.push(`### \`${f.filename}\` — all violations auto-fixed`, '');
        lines.push('**Corrected code:**', '');
        lines.push('```' + lang, f.fixedCode, '```', '');
        continue;
      }

      if (f.fixed && f.messages.length > 0) {
        lines.push(`### \`${f.filename}\` — ${f.messages.length} remaining violation${f.messages.length === 1 ? '' : 's'} (auto-fixes applied)`, '');
        lines.push('**Corrected code** (apply this, then address the remaining violations below):', '');
        lines.push('```' + lang, f.fixedCode, '```', '');
        lines.push('**Remaining violations:**', '');
        for (const m of f.messages) {
          const sev = m.severity === 2 ? 'error' : 'warn';
          lines.push(`#### \`${m.ruleId ?? 'unknown'}\` [${sev}] — line ${m.line}, col ${m.column}`, '');
          lines.push(m.message, '');
        }
        continue;
      }

      if (f.messages.length === 0) {
        lines.push(`### \`${f.filename}\` — clean`, '');
        continue;
      }

      lines.push(`### \`${f.filename}\` — ${f.messages.length} violation${f.messages.length === 1 ? '' : 's'}`, '');
      for (const m of f.messages) {
        const sev = m.severity === 2 ? 'error' : 'warn';
        lines.push(`#### \`${m.ruleId ?? 'unknown'}\` [${sev}] — line ${m.line}, col ${m.column}`, '');
        lines.push(m.message, '');
      }
    }
  } else {
    // Single-file output
    const { filename, messages, fixedCode, fixed, error } = fileResults[0];
    const lang = inferLanguage(filename);

    if (error) {
      lines.push(`ESLint error: ${error}`);
    } else if (fixed && messages.length === 0) {
      lines.push('All violations were auto-fixed.', '');
      lines.push('**Corrected code:**', '');
      lines.push('```' + lang, fixedCode, '```');
    } else if (fixed && messages.length > 0) {
      lines.push(`## Lint results — ${messages.length} remaining violation${messages.length === 1 ? '' : 's'} (auto-fixes applied)`, '');
      lines.push('**Corrected code** (apply this, then address the remaining violations below):', '');
      lines.push('```' + lang, fixedCode, '```', '');
      lines.push('**Remaining violations:**', '');
      for (const m of messages) {
        const sev = m.severity === 2 ? 'error' : 'warn';
        lines.push(`### \`${m.ruleId ?? 'unknown'}\` [${sev}] — line ${m.line}, col ${m.column}`, '');
        lines.push(m.message, '');
      }
    } else if (messages.length === 0) {
      lines.push('No lint issues found.');
    } else {
      lines.push(`## Lint results — ${messages.length} violation${messages.length === 1 ? '' : 's'}`, '');
      for (const m of messages) {
        const sev = m.severity === 2 ? 'error' : 'warn';
        lines.push(`### \`${m.ruleId ?? 'unknown'}\` [${sev}] — line ${m.line}, col ${m.column}`, '');
        lines.push(m.message, '');
      }
    }
  }

  if (stubFiles.length > 0) {
    lines.push(
      '---',
      '',
      `> ⚠️ **${stubFiles.length} stub file${stubFiles.length === 1 ? '' : 's'} detected** — no JSX elements found in: ${stubFiles.map(f => `\`${f}\``).join(', ')}`,
      '>',
      '> Design-system ESLint rules only fire on actual JSX. These files produced no design-system violations because they contain no rendered components.',
      '> **Call `dsds_lint_code` again after completing your implementation.**',
      '',
    );
  }

  if (loadErrors.length > 0) {
    lines.push('---', '', `> ${loadErrors.length} plugin(s) failed to load: ${loadErrors.join(', ')}`);
  }

  // One-pass directive: when nothing is left to fix, tell the agent to stop here
  // rather than re-linting to "confirm" (which just re-sends the same code).
  if (totalRemaining === 0 && filesWithErrors === 0) {
    lines.push(
      '',
      '> ✓ One pass complete — apply the corrected code above and move on. Do NOT call dsds_lint_code again to confirm. ' +
      'Lint again only if you change a file, and then send only that file (or its `path`/`cacheKey`).',
    );
  }

  // Cache key hints — only for entries that were freshly linted (have a cacheKey)
  const freshResults = fileResults.filter(f => f.cacheKey);
  if (freshResults.length === 1) {
    lines.push('', `**Cache key:** \`${freshResults[0].cacheKey}\` — pass \`{ cacheKey: "${freshResults[0].cacheKey}", filename: "${freshResults[0].filename}" }\` instead of \`code\` on subsequent calls **only if this file has not changed**. If you modify the file, always pass the updated \`code\` — the cache key is tied to the exact source content linted above.`);
  } else if (freshResults.length > 1) {
    lines.push('', '---', '', '**Cache keys** — only valid while these files remain unchanged. If you modify a file, re-send its full `code` instead of the cache key:', '');
    for (const f of freshResults) {
      lines.push(`- \`${f.filename}\` → \`${f.cacheKey}\``);
    }
    lines.push('');
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
