import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdir, appendFile } from 'node:fs/promises';

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

export const lintCodeDef = {
  name: 'dsds_lint_code',
  description:
    'Lint code against the configured ESLint plugins. ' +
    'Use the `files` array to lint ALL generated files in one call — this is the preferred usage. ' +
    'Returns violations with rule ID, severity, location, and message, grouped by file.',
  inputSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        description:
          'Batch mode: lint multiple files at once. Pass every file you generated. ' +
          'Each entry needs `code` (required) and `filename` (optional, defaults to Component.tsx).',
        items: {
          type: 'object',
          required: ['code'],
          properties: {
            code:     { type: 'string', description: 'Source code to lint.' },
            filename: { type: 'string', description: "Filename for parser inference (e.g. 'App.tsx')." },
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
    },
  },
};

async function writeLintLog(logsDir, fileResults) {
  const violations = fileResults.filter(f => f.messages?.length > 0);
  if (violations.length === 0) return;

  try {
    await mkdir(logsDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const logPath = join(logsDir, `${date}.jsonl`);
    const entry = {
      timestamp: new Date().toISOString(),
      filesLinted: fileResults.length,
      totalViolations: fileResults.reduce((n, f) => n + (f.messages?.length ?? 0), 0),
      files: violations.map(f => ({
        filename: f.filename,
        violations: f.messages.map(m => ({
          ruleId: m.ruleId ?? null,
          severity: m.severity,
          line: m.line,
          col: m.column,
          fixable: m.fix,
        })),
      })),
    };
    await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch {
    // Logging is best-effort — never fail the lint call over a write error
  }
}

export async function lintCodeHandler(args, getLintConfig, logsDir = null) {
  // Normalise input: batch `files` array takes priority over single `code`.
  const filesToLint = args.files?.length
    ? args.files
    : args.code != null
      ? [{ code: args.code, filename: args.filename }]
      : null;

  if (!filesToLint) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Provide either `files` (array) or `code` (string).' }],
    };
  }

  const { plugins: pluginNames, resolveDir } = getLintConfig();

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

  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig,
    cwd: resolveDir,
  });

  // Lint all files
  const fileResults = [];
  for (const file of filesToLint) {
    const filename = file.filename ?? 'Component.tsx';
    const filePath = resolve(resolveDir, filename);
    try {
      const results = await eslint.lintText(file.code, { filePath });
      const messages = results.flatMap(r =>
        r.messages.map(m => ({
          ruleId: m.ruleId,
          severity: m.severity,
          message: m.message,
          line: m.line,
          column: m.column,
          fix: !!m.fix,
        }))
      );
      fileResults.push({ filename, messages });
    } catch (err) {
      fileResults.push({ filename, error: err.message });
    }
  }

  // Write log entry (best-effort, non-blocking)
  if (logsDir) writeLintLog(logsDir, fileResults);

  // Render output
  const lines = [];
  const isBatch = filesToLint.length > 1;

  const totalIssues = fileResults.reduce((n, f) => n + (f.messages?.length ?? 0), 0);
  const filesWithIssues = fileResults.filter(f => f.messages?.length > 0 || f.error).length;
  const filesClean = fileResults.filter(f => !f.error && f.messages?.length === 0).length;

  if (isBatch) {
    if (totalIssues === 0 && !fileResults.some(f => f.error)) {
      lines.push(`All ${fileResults.length} files lint clean.`);
    } else {
      lines.push(
        `## Lint results — ${fileResults.length} file${fileResults.length === 1 ? '' : 's'}, ` +
        `${totalIssues} issue${totalIssues === 1 ? '' : 's'} ` +
        `(${filesClean} clean, ${filesWithIssues} with issues)`,
        '',
      );
      for (const f of fileResults) {
        if (f.error) {
          lines.push(`### \`${f.filename}\` — ESLint error`, '', f.error, '');
          continue;
        }
        if (f.messages.length === 0) {
          lines.push(`### \`${f.filename}\` — clean`, '');
          continue;
        }
        lines.push(`### \`${f.filename}\` — ${f.messages.length} issue${f.messages.length === 1 ? '' : 's'}`, '');
        for (const m of f.messages) {
          const sev = m.severity === 2 ? 'error' : 'warn';
          lines.push(`#### \`${m.ruleId ?? 'unknown'}\` [${sev}] — line ${m.line}, col ${m.column}`);
          lines.push('');
          lines.push(m.message);
          if (m.fix) lines.push('', '**Auto-fixable.**');
          lines.push('');
        }
      }
    }
  } else {
    // Single-file output (same format as before)
    const { filename, messages, error } = fileResults[0];
    if (error) {
      lines.push(`ESLint error: ${error}`);
    } else if (messages.length === 0) {
      lines.push('No lint issues found.');
    } else {
      lines.push(`## Lint results — ${messages.length} issue${messages.length === 1 ? '' : 's'}`, '');
      for (const m of messages) {
        const sev = m.severity === 2 ? 'error' : 'warn';
        lines.push(`### \`${m.ruleId ?? 'unknown'}\` [${sev}] — line ${m.line}, col ${m.column}`, '');
        lines.push(m.message);
        if (m.fix) lines.push('', '**Auto-fixable.**');
        lines.push('');
      }
    }
  }

  if (loadErrors.length > 0) {
    lines.push('---', '', `> ${loadErrors.length} plugin(s) failed to load: ${loadErrors.join(', ')}`);
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
