import { describe, it, expect } from 'vitest';
import { generateCatalog, validateUiSpec, parseType, toComponentName } from '../../src/catalog.js';
import { getCatalogHandler } from '../../src/tools/get-catalog.js';
import { validateUiHandler } from '../../src/tools/validate-ui.js';

// Minimal hand-crafted entities exercising the generator's branches.
const ENTITIES = [
  { kind: 'token-group', identifier: 'space', children: [{ identifier: 'space-0' }, { identifier: 'space-1' }, { identifier: 'space-2' }, { identifier: 'space-3' }] },
  { kind: 'token-group', identifier: 'radius', children: [{ identifier: 'radius-0' }, { identifier: 'radius-1' }, { identifier: 'radius-round' }] },
  {
    kind: 'component', identifier: 'card', metadata: { status: 'stable' }, description: 'Surface container.',
    documentBlocks: [{ kind: 'api', platform: 'react', properties: [
      { identifier: 'density', type: "'compact' | 'regular' | 'loose'", required: false },
      { identifier: 'tone', type: "'neutral' | 'positive' | 'caution' | 'critical'", required: false },
      { identifier: 'as', type: 'React.ElementType', required: false },
      { identifier: 'children', type: 'React.ReactNode', required: false },
    ] }],
  },
  {
    kind: 'component', identifier: 'box', metadata: { status: 'stable' }, description: 'Box.',
    documentBlocks: [{ kind: 'api', properties: [
      { identifier: 'padding', type: 'Responsive<number>' },
      { identifier: 'radius', type: 'Responsive<number>' },
    ] }],
  },
  { kind: 'component', identifier: 'divider', metadata: { status: 'stable' }, description: 'Divider.', documentBlocks: [{ kind: 'api', properties: [] }] },
  {
    kind: 'component', identifier: 'dialog', metadata: { status: 'draft' }, description: 'Dialog.',
    documentBlocks: [{ kind: 'api', properties: [{ identifier: 'open', type: 'boolean' }] }],
  },
];

const getSystems = () => [{ entities: ENTITIES }];

describe('parseType', () => {
  it('parses string-literal unions to string enums', () => {
    expect(parseType("'a' | 'b'")).toEqual({ type: 'string', enum: ['a', 'b'] });
  });
  it('parses numeric-literal unions to number enums', () => {
    expect(parseType('0 | 1 | 2')).toEqual({ type: 'number', enum: [0, 1, 2] });
  });
  it('wraps Responsive<T> in a scalar-or-array union', () => {
    const s = parseType('Responsive<boolean>');
    expect(s.oneOf[0]).toEqual({ type: 'boolean' });
    expect(s.oneOf[1].type).toBe('array');
  });
  it('drops React-typed props', () => {
    expect(parseType('React.ElementType')).toBeNull();
    expect(parseType('React.ReactNode')).toBeNull();
  });
});

describe('toComponentName', () => {
  it('PascalCases hyphenated identifiers', () => {
    expect(toComponentName('h-stack')).toBe('HStack');
    expect(toComponentName('icon-button')).toBe('IconButton');
  });
  it('honors overrides', () => {
    expect(toComponentName('textinput')).toBe('TextInput');
  });
});

describe('generateCatalog', () => {
  const cat = generateCatalog(ENTITIES);

  it('includes stable/beta and excludes draft', () => {
    expect(Object.keys(cat.components).sort()).toEqual(['Box', 'Card', 'Divider']);
    expect(cat.components.Dialog).toBeUndefined();
    expect(cat.meta.componentCount).toBe(3);
  });

  it('drops React-typed and children props; children becomes a slot', () => {
    expect(Object.keys(cat.components.Card.props.properties)).toEqual(['density', 'tone']);
    expect(cat.components.Card.slots).toEqual(['default']);
  });

  it('omits a slot for leaf components', () => {
    expect(cat.components.Divider.slots).toBeUndefined();
  });

  it('tightens spacing props to the space token scale', () => {
    const padding = cat.components.Box.props.properties.padding;
    expect(padding.oneOf[0]).toEqual({ type: 'integer', enum: [0, 1, 2, 3] });
  });

  it('tightens radius to the radius token scale incl. round', () => {
    const radius = cat.components.Box.props.properties.radius;
    expect(radius.oneOf[0].enum).toEqual([0, 1, 'round']);
  });

  it('sets additionalProperties:false so unlisted props are rejected', () => {
    expect(cat.components.Card.props.additionalProperties).toBe(false);
  });
});

describe('validateUiSpec', () => {
  const cat = generateCatalog(ENTITIES);

  it('accepts a valid spec', () => {
    const spec = { root: 'c', elements: { c: { type: 'Card', props: { density: 'regular', tone: 'neutral' }, children: ['b'] }, b: { type: 'Box', props: { padding: 2 } } } };
    expect(validateUiSpec(cat, spec).valid).toBe(true);
  });

  it('rejects a disallowed prop with a recovery hint', () => {
    const spec = { root: 'c', elements: { c: { type: 'Card', props: { padding: 3 } } } };
    const r = validateUiSpec(cat, spec);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('padding') && e.includes('not allowed'))).toBe(true);
  });

  it('rejects an unknown (draft) component type', () => {
    const spec = { root: 'x', elements: { x: { type: 'Dialog', props: {} } } };
    const r = validateUiSpec(cat, spec);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.includes('Dialog') && e.includes('not in the catalog'))).toBe(true);
  });

  it('rejects an out-of-scale spacing value', () => {
    const spec = { root: 'b', elements: { b: { type: 'Box', props: { padding: 99 } } } };
    expect(validateUiSpec(cat, spec).valid).toBe(false);
  });

  it('flags dangling child references and a missing root', () => {
    const spec = { root: 'missing', elements: { c: { type: 'Card', props: {}, children: ['ghost'] } } };
    const r = validateUiSpec(cat, spec);
    expect(r.errors.some(e => e.includes('ghost'))).toBe(true);
    expect(r.errors.some(e => e.includes('Root') && e.includes('missing'))).toBe(true);
  });

  it('reports a JSON string spec', () => {
    const spec = JSON.stringify({ root: 'c', elements: { c: { type: 'Card', props: {} } } });
    expect(validateUiSpec(cat, spec).valid).toBe(true);
  });
});

describe('getCatalogHandler', () => {
  it('returns a summary by default', () => {
    const r = getCatalogHandler({}, getSystems);
    expect(r.content[0].text).toContain('Card');
    expect(r.content[0].text).toContain('Components');
  });
  it('returns the UI-spec JSON Schema', () => {
    const r = getCatalogHandler({ format: 'json-schema' }, getSystems);
    expect(r.content[0].text).toContain('"root"');
    expect(r.content[0].text).toContain('elements');
  });
  it('returns a defineCatalog source for zod', () => {
    const r = getCatalogHandler({ format: 'zod' }, getSystems);
    expect(r.content[0].text).toContain('defineCatalog');
    expect(r.content[0].text).toContain('z.enum');
  });
  it('errors when no systems are configured', () => {
    const r = getCatalogHandler({}, () => []);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain('DSDS_PATHS');
  });
});

describe('validateUiHandler', () => {
  it('passes a valid spec', () => {
    const spec = { root: 'c', elements: { c: { type: 'Card', props: { tone: 'neutral' } } } };
    const r = validateUiHandler({ spec }, getSystems);
    expect(r.content[0].text).toContain('valid');
  });
  it('reports failures with hints', () => {
    const spec = { root: 'c', elements: { c: { type: 'Card', props: { padding: 1 } } } };
    const r = validateUiHandler({ spec }, getSystems);
    expect(r.content[0].text).toContain('failed validation');
    expect(r.content[0].text).toContain('padding');
  });
});
