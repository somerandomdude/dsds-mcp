import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
    'Lint a code snippet using the configured ESLint plugins. Returns violations with rule ID, severity, location, and message.',
  inputSchema: {
    type: 'object',
    required: ['code'],
    properties: {
      code: { type: 'string', description: 'Source code to lint.' },
      filename: {
        type: 'string',
        description: "Filename used for parser inference (e.g. 'Component.tsx'). Defaults to 'Component.tsx'.",
      },
    },
  },
};

export async function lintCodeHandler(args, getLintConfig) {
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

  const pluginsObj = {};
  const rulesObj = {};
  for (const [name, plugin] of Object.entries(loadedPlugins)) {
    const prefix = pluginPrefix(name);
    pluginsObj[prefix] = plugin;
    Object.assign(rulesObj, rulesFromPlugin(prefix, plugin));
  }

  const filename = args.filename ?? 'Component.tsx';
  const filePath = resolve(resolveDir, filename);

  let results;
  try {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: [{ plugins: pluginsObj, rules: rulesObj }],
      cwd: resolveDir,
    });
    results = await eslint.lintText(args.code, { filePath });
  } catch (err) {
    return { isError: true, content: [{ type: 'text', text: `ESLint error: ${err.message}` }] };
  }

  const messages = results.flatMap(r =>
    r.messages.map(m => ({
      ruleId: m.ruleId,
      severity: m.severity,
      message: m.message,
      line: m.line,
      column: m.column,
      fix: m.fix,
    }))
  );

  const lines = [];

  if (messages.length === 0) {
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

  if (loadErrors.length > 0) {
    lines.push('---', '', `> ${loadErrors.length} plugin(s) failed to load: ${loadErrors.join(', ')}`);
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
