import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const orig = { ...process.env };

  afterEach(() => {
    for (const key of ['DSDS_PATHS', 'DSDS_SCHEMA_VERSION']) {
      if (orig[key] === undefined) delete process.env[key];
      else process.env[key] = orig[key];
    }
  });

  it('returns empty paths when DSDS_PATHS is not set', () => {
    delete process.env['DSDS_PATHS'];
    const config = loadConfig();
    expect(config.paths).toEqual([]);
  });

  it('splits DSDS_PATHS by comma', () => {
    process.env['DSDS_PATHS'] = '/a/b.json,/c/d.json';
    const config = loadConfig();
    expect(config.paths).toEqual(['/a/b.json', '/c/d.json']);
  });

  it('trims whitespace from paths', () => {
    process.env['DSDS_PATHS'] = '  /a/b.json , /c/d.json  ';
    const config = loadConfig();
    expect(config.paths).toEqual(['/a/b.json', '/c/d.json']);
  });

  it('filters empty strings from paths', () => {
    process.env['DSDS_PATHS'] = '/a/b.json,,/c/d.json';
    const config = loadConfig();
    expect(config.paths).toEqual(['/a/b.json', '/c/d.json']);
  });

  it('defaults schemaVersion to 0.2.1', () => {
    delete process.env['DSDS_SCHEMA_VERSION'];
    const config = loadConfig();
    expect(config.schemaVersion).toBe('0.2.1');
  });

  it('uses DSDS_SCHEMA_VERSION when set', () => {
    process.env['DSDS_SCHEMA_VERSION'] = '0.3.0';
    const config = loadConfig();
    expect(config.schemaVersion).toBe('0.3.0');
  });
});
