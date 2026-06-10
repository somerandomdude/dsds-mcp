import { describe, it, expect } from 'vitest';
import { lintCodeHandler } from '../../src/tools/lint-code.js';

const noPlugins = () => ({ plugins: [], resolveDir: process.cwd() });

describe('lintCodeHandler', () => {
  it('returns isError when no plugins configured', async () => {
    const result = await lintCodeHandler({ code: 'const x = 1;' }, noPlugins);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('LINT_PLUGINS');
    expect(result.content[0].text).toContain('LINT_RESOLVE_DIR');
  });

  it('returns isError when plugins are configured but cannot run', async () => {
    const getLintConfig = () => ({
      plugins: ['eslint-plugin-does-not-exist-xyz'],
      resolveDir: process.cwd(),
    });
    const result = await lintCodeHandler({ code: 'const x = 1;' }, getLintConfig);
    expect(result.isError).toBe(true);
  });
});
