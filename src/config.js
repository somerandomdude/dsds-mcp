import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function expandHome(p) {
  if (p === '~' || p.startsWith('~/')) return homedir() + p.slice(1);
  return p;
}

export function loadConfig() {
  const rawPaths = process.env['DSDS_PATHS'];
  const paths = rawPaths
    ? rawPaths.split(',').map(p => expandHome(p.trim())).filter(Boolean)
    : [];

  const rawLintPaths = process.env['LINT_PATHS'];
  const lintPaths = rawLintPaths
    ? rawLintPaths.split(',').map(p => expandHome(p.trim())).filter(Boolean)
    : [];

  const rawLintPlugins = process.env['LINT_PLUGINS'];
  const lintPlugins = rawLintPlugins
    ? rawLintPlugins.split(',').map(p => p.trim()).filter(Boolean)
    : [];

  const rawLintResolveDir = process.env['LINT_RESOLVE_DIR'];
  const lintResolveDir = rawLintResolveDir ? expandHome(rawLintResolveDir.trim()) : process.cwd();

  // DSDS_INTRO_PATHS accepts comma-separated paths; DSDS_INTRO_PATH is the legacy single-path alias.
  const rawIntros = process.env['DSDS_INTRO_PATHS'] ?? process.env['DSDS_INTRO_PATH'];
  const introPaths = rawIntros
    ? rawIntros.split(',').map(p => expandHome(p.trim())).filter(Boolean)
    : [];
  const rawFeedbackDir = process.env['DSDS_FEEDBACK_DIR'];
  const rawLogsDir = process.env['DSDS_LOGS_DIR'];

  // PACKAGE_EXPORT_PATHS: comma-separated "packageName=packagePath" pairs.
  // Example: @sanity-labs/ui-poc=/path/to/ui-poc/packages/ui,@sanity/ui=/path/to/sanity-ui/packages/ui
  const rawExportPaths = process.env['PACKAGE_EXPORT_PATHS'];
  const packageExportPaths = new Map();
  if (rawExportPaths) {
    for (const entry of rawExportPaths.split(',').map(s => s.trim()).filter(Boolean)) {
      const eqIdx = entry.indexOf('=');
      if (eqIdx > 0) {
        const pkgName = entry.slice(0, eqIdx).trim();
        const pkgPath = expandHome(entry.slice(eqIdx + 1).trim());
        if (pkgName && pkgPath) packageExportPaths.set(pkgName, pkgPath);
      }
    }
  }

  return {
    paths,
    lintPaths,
    lintPlugins,
    lintResolveDir,
    introPaths,
    packageExportPaths,
    feedbackDir: rawFeedbackDir ? expandHome(rawFeedbackDir.trim()) : resolve(__dirname, '../feedback'),
    logsDir: rawLogsDir ? expandHome(rawLogsDir.trim()) : resolve(__dirname, '../logs'),
    schemaVersion: process.env['DSDS_SCHEMA_VERSION'] ?? '0.10.0',
  };
}
