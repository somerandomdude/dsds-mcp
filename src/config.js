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

  // LINT_SOURCE_DIR is the root of the project being linted (where the agent's
  // files live). When set, `dsds_lint_code({ path })` resolves paths against it
  // and ESLint runs with it as cwd, so files written there are "inside base
  // path". Plugins are still resolved from LINT_RESOLVE_DIR. Defaults to the
  // resolve dir (current behavior) when unset.
  const rawLintSourceDir = process.env['LINT_SOURCE_DIR'];
  const lintSourceDir = rawLintSourceDir ? expandHome(rawLintSourceDir.trim()) : null;

  // DSDS_INTRO_PATHS accepts comma-separated paths; DSDS_INTRO_PATH is the legacy single-path alias.
  const rawIntros = process.env['DSDS_INTRO_PATHS'] ?? process.env['DSDS_INTRO_PATH'];
  const introPaths = rawIntros
    ? rawIntros.split(',').map(p => expandHome(p.trim())).filter(Boolean)
    : [];
  const rawFeedbackDir = process.env['DSDS_FEEDBACK_DIR'];
  const rawLogsDir = process.env['DSDS_LOGS_DIR'];

  // Feedback is on by default; set DSDS_ENABLE_FEEDBACK to a falsy string
  // (false/0/no/off) to remove the dsds_feedback tool and its instruction entirely.
  const rawEnableFeedback = process.env['DSDS_ENABLE_FEEDBACK'];
  const enableFeedback = rawEnableFeedback == null
    ? true
    : !/^(false|0|no|off)$/i.test(rawEnableFeedback.trim());

  // Intro entities are injected into every system prompt. Inline (default) renders
  // them in full (~thousands of tokens). Set DSDS_INTRO_INLINE to a falsy string to
  // inject only a compact index (title + one-line each) instead — much smaller per
  // prompt; agents can pull full content with dsds_get_entity when needed.
  const rawIntroInline = process.env['DSDS_INTRO_INLINE'];
  const introInline = rawIntroInline == null
    ? true
    : !/^(false|0|no|off)$/i.test(rawIntroInline.trim());

  // PACKAGE_EXPORT_PATHS: comma-separated "packageName=packagePath" pairs.
  // Example: @your-org/ui=/path/to/your-ui/packages/ui,@your-org/icons=/path/to/your-icons
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

  // ICON_PACKAGE: the package name whose exports the integrity guard treats as the
  // icon set (e.g. "@acme/icons"). When set, chunk code that imports from this
  // package is checked against its real exports. Unset (default) → no icon check.
  const rawIconPackage = process.env['ICON_PACKAGE'];
  const iconPackage = rawIconPackage ? rawIconPackage.trim() : null;

  return {
    paths,
    lintPaths,
    lintPlugins,
    lintResolveDir,
    lintSourceDir,
    introPaths,
    packageExportPaths,
    iconPackage,
    enableFeedback,
    introInline,
    feedbackDir: rawFeedbackDir ? expandHome(rawFeedbackDir.trim()) : resolve(__dirname, '../feedback'),
    logsDir: rawLogsDir ? expandHome(rawLogsDir.trim()) : resolve(__dirname, '../logs'),
    schemaVersion: process.env['DSDS_SCHEMA_VERSION'] ?? '0.12.0',
  };
}
