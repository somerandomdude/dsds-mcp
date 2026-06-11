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

  const rawIntro = process.env['DSDS_INTRO_PATH'];
  const rawFeedbackDir = process.env['DSDS_FEEDBACK_DIR'];
  const rawLogsDir = process.env['DSDS_LOGS_DIR'];
  return {
    paths,
    lintPaths,
    lintPlugins,
    lintResolveDir,
    introPath: rawIntro ? expandHome(rawIntro.trim()) : null,
    feedbackDir: rawFeedbackDir ? expandHome(rawFeedbackDir.trim()) : resolve(__dirname, '../feedback'),
    logsDir: rawLogsDir ? expandHome(rawLogsDir.trim()) : resolve(__dirname, '../logs'),
    schemaVersion: process.env['DSDS_SCHEMA_VERSION'] ?? '0.10.0',
  };
}
