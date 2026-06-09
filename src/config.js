import { homedir } from 'node:os';

function expandHome(p) {
  if (p === '~' || p.startsWith('~/')) return homedir() + p.slice(1);
  return p;
}

export function loadConfig() {
  const rawPaths = process.env['DSDS_PATHS'];
  const paths = rawPaths
    ? rawPaths.split(',').map(p => expandHome(p.trim())).filter(Boolean)
    : [];

  const rawIntro = process.env['DSDS_INTRO_PATH'];
  return {
    paths,
    introPath: rawIntro ? expandHome(rawIntro.trim()) : null,
    schemaVersion: process.env['DSDS_SCHEMA_VERSION'] ?? '0.5.1',
  };
}
