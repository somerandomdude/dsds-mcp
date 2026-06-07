export function loadConfig() {
  const rawPaths = process.env['DSDS_PATHS'];
  const paths = rawPaths
    ? rawPaths.split(',').map(p => p.trim()).filter(Boolean)
    : [];

  return {
    paths,
    schemaVersion: process.env['DSDS_SCHEMA_VERSION'] ?? '0.2.1',
  };
}
