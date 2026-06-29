import { describe, it, expect } from 'vitest';
import { generateCatalog, generateRenderer } from '../../src/catalog.js';
import { renderUiHandler } from '../../src/tools/render-ui.js';

const ENTITIES = [
  { kind: 'token-group', identifier: 'space', children: [{ identifier: 'space-0' }, { identifier: 'space-1' }, { identifier: 'space-2' }, { identifier: 'space-3' }] },
  {
    kind: 'component', identifier: 'card', metadata: { status: 'stable' }, description: 'Surface.',
    documentBlocks: [{ kind: 'api', properties: [{ identifier: 'tone', type: "'neutral' | 'positive' | 'caution' | 'critical' | 'suggest'" }] }],
  },
  {
    kind: 'component', identifier: 'heading', metadata: { status: 'stable' }, description: 'Heading.',
    documentBlocks: [{ kind: 'api', properties: [{ identifier: 'size', type: 'Responsive<0 | 1 | 2 | 3>' }, { identifier: 'as', type: "'h1' | 'h2' | 'h3'" }] }],
  },
  {
    kind: 'component', identifier: 'text', metadata: { status: 'stable' }, description: 'Text.',
    documentBlocks: [{ kind: 'api', properties: [{ identifier: 'size', type: 'Responsive<0 | 1 | 2>' }] }],
  },
  {
    kind: 'component', identifier: 'icon', metadata: { status: 'stable' }, description: 'Icon.',
    documentBlocks: [{ kind: 'api', properties: [
      { identifier: 'icon', type: 'React.ComponentType<React.SVGProps<SVGSVGElement>>' },
      { identifier: 'size', type: 'Responsive<0 | 1 | 2 | 3 | 4>' },
    ] }],
  },
];

const getSystems = () => [{ entities: ENTITIES }];
const cat = generateCatalog(ENTITIES);

describe('catalog text affordance', () => {
  it('adds a synthetic text prop to text components and tracks them', () => {
    expect(cat.components.Heading.props.properties.text).toEqual({ type: 'string', description: expect.any(String) });
    expect(cat.components.Text.props.properties.text).toBeTruthy();
    expect(cat.components.Card.props.properties.text).toBeUndefined();
    expect(cat.meta.textComponents.sort()).toEqual(['Heading', 'Text']);
  });
});

describe('catalog icon affordance', () => {
  it('adds a string icon prop and the renderer maps @sanity/icons', () => {
    expect(cat.components.Icon.props.properties.icon).toEqual({ type: 'string', description: expect.any(String) });
    const files = generateRenderer(cat, { root: 'i', elements: { i: { type: 'Icon', props: { icon: 'AddIcon', size: 2 } } } });
    const renderer = files.find((f) => f.path === 'src/GenUIRenderer.tsx').content;
    expect(renderer).toContain("import * as Icons from '@sanity/icons'");
    expect(renderer).toContain("(Icons as any)[v]");
  });
});

describe('generateRenderer', () => {
  const spec = { root: 'h', elements: { h: { type: 'Heading', props: { as: 'h2', size: 2, text: 'Hello' } } } };
  const files = generateRenderer(cat, spec);
  const byPath = Object.fromEntries(files.map((f) => [f.path, f.content]));

  it('emits a complete runnable app', () => {
    for (const p of ['package.json', 'index.html', 'vite.config.ts', 'src/main.tsx', 'src/GenUIRenderer.tsx', 'src/genui-spec.json']) {
      expect(byPath[p]).toBeTruthy();
    }
  });
  it('renderer imports ui-poc and carries the catalog names + text components', () => {
    expect(byPath['src/GenUIRenderer.tsx']).toContain("@sanity-labs/ui-poc");
    expect(byPath['src/GenUIRenderer.tsx']).toContain('"Heading"');
    expect(byPath['src/GenUIRenderer.tsx']).toContain('TEXT_AS_CHILDREN');
  });
  it('embeds the spec verbatim', () => {
    expect(JSON.parse(byPath['src/genui-spec.json'])).toEqual(spec);
  });
  it('package.json pins ui-poc and the react-refractor override', () => {
    const pkg = JSON.parse(byPath['package.json']);
    expect(pkg.dependencies['@sanity-labs/ui-poc']).toBeTruthy();
    expect(pkg.overrides['react-refractor']).toBeTruthy();
  });
});

describe('renderUiHandler', () => {
  it('emits FILE blocks for a valid spec', () => {
    const spec = { root: 'c', elements: { c: { type: 'Card', props: { tone: 'neutral' }, children: ['h'] }, h: { type: 'Heading', props: { as: 'h2', size: 2, text: 'Hi' } } } };
    const r = renderUiHandler({ spec }, getSystems);
    expect(r.content[0].text).toContain('---FILE: src/GenUIRenderer.tsx---');
    expect(r.content[0].text).toContain('---FILE: src/genui-spec.json---');
    expect(r.content[0].text).toContain('---END FILE---'); // required by the harness parser
  });
  it('refuses to render an invalid spec', () => {
    const spec = { root: 'c', elements: { c: { type: 'Card', props: { padding: 3 } } } };
    const r = renderUiHandler({ spec }, getSystems);
    expect(r.content[0].text).toContain('Cannot render');
    expect(r.content[0].text).toContain('padding');
    expect(r.content[0].text).not.toContain('---FILE:');
  });
});
