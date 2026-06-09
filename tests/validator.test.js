import { describe, it, expect } from 'vitest';
import { validateDocument, validateJsonString } from '../src/validator.js';

const validButton = {
  dsdsVersion: '0.5.1',
  entity: {
    kind: 'component',
    identifier: 'button',
    name: 'Button',
  },
};

describe('validateDocument', () => {
  it('returns valid for a minimal valid document', () => {
    const result = validateDocument(validButton);
    expect(result.valid).toBe(true);
  });

  it('returns errors when dsdsVersion is missing', () => {
    const result = validateDocument({ entity: { kind: 'component', identifier: 'x', name: 'X' } });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns errors when required entity field is missing', () => {
    const result = validateDocument({
      dsdsVersion: '0.5.1',
      entity: { kind: 'component', identifier: 'x' }, // missing name
    });
    expect(result.valid).toBe(false);
  });

  it('returns errors for unknown entity kind', () => {
    const result = validateDocument({
      dsdsVersion: '0.5.1',
      entity: { kind: 'widget', identifier: 'x', name: 'X' },
    });
    expect(result.valid).toBe(false);
  });

  it('validates a multi-entity document', () => {
    const result = validateDocument({
      dsdsVersion: '0.5.1',
      documentation: [
        {
          name: 'Components',
          components: [{ kind: 'component', identifier: 'button', name: 'Button' }],
        },
      ],
    });
    expect(result.valid).toBe(true);
  });
});

describe('validateJsonString', () => {
  it('parses and validates a valid JSON string', () => {
    const result = validateJsonString(JSON.stringify(validButton));
    expect(result.valid).toBe(true);
  });

  it('returns a parse error for invalid JSON', () => {
    const result = validateJsonString('{ not valid json }');
    expect(result.valid).toBe(false);
    expect(result.parseError).toMatch(/invalid json/i);
  });
});
