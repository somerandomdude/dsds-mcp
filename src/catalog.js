import Ajv2020 from 'ajv/dist/2020.js';

/**
 * Generative-UI catalog generator (prototype).
 *
 * Projects loaded DSDS entities into a json-render-style catalog:
 *   - component set: stable + beta components only (draft/deprecated excluded)
 *   - per-component prop schemas: derived from each component's `api` block by
 *     parsing the TypeScript type strings into JSON Schema
 *   - spacing/radius props: tightened to the scales documented in the `space`
 *     and `radius` token-groups
 *   - React-typed props (ReactNode/ElementType/handlers) are dropped — a model
 *     cannot emit them as JSON; a `children` prop becomes a `default` slot
 *
 * This lives in the MCP as a prototype. Rendering (the React registry) stays in
 * a client; this module owns the half that is testable headlessly: generate the
 * catalog and validate a generated UI spec against it.
 */

const INCLUDED_STATUSES = new Set(['stable', 'beta']);

// Identifiers whose PascalCase export name is not just split-on-hyphen.
const NAME_OVERRIDES = {
  textinput: 'TextInput',
  textarea: 'TextArea',
  avatarstack: 'AvatarStack',
};

// Components that render no children — they get no `default` slot. Everything
// else accepts children (DSDS `api` blocks rarely list `children` explicitly).
const LEAF_COMPONENTS = new Set([
  'divider', 'spinner', 'icon', 'indicator', 'icon-button',
  'checkbox', 'radio', 'switch', 'image', 'kbd',
]);

// Components whose visible content is text. The DSDS `api` block models that as
// React children (dropped, since a model can't emit a React node as JSON), so we
// add a synthetic `text` string prop the renderer maps back to children — without
// it, a generated Heading/Text would render empty.
const TEXT_CONTENT = new Set(['heading', 'text', 'label', 'code']);

// Components whose icon is a React component in the DSDS api (dropped, since a
// model can't emit a React node as JSON). A synthetic `icon` string prop carries
// the @sanity/icons name; the renderer resolves it to the real component.
const ICON_COMPONENTS = new Set(['icon']);

// Props that carry the spacing scale (tightened to the `space` token-group).
const SPACING_PROPS = new Set([
  'padding', 'paddingX', 'paddingY', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'margin', 'marginX', 'marginY', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
  'gap', 'columnGap', 'rowGap',
]);

// Starter action set. Actions are not modelled in DSDS yet, so these are seeded
// here for the prototype; wire real handlers in the client registry.
const DEFAULT_ACTIONS = {
  submit: { params: { type: 'object', properties: { formId: { type: 'string' } } }, description: 'Submit a form.' },
  navigate: { params: { type: 'object', properties: { to: { type: 'string' } }, required: ['to'] }, description: 'Navigate to a route.' },
  setState: { params: { type: 'object', properties: { path: { type: 'string' }, value: {} }, required: ['path'] }, description: 'Set a value in component state.' },
};

export function toComponentName(identifier) {
  if (NAME_OVERRIDES[identifier]) return NAME_OVERRIDES[identifier];
  return identifier
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function statusOf(entity) {
  const s = entity?.metadata?.status;
  if (!s) return undefined;
  return typeof s === 'string' ? s : s.overall ?? s.value;
}

// ── Type-string parser ───────────────────────────────────────────────────────

// Split a union on top-level `|`, ignoring `|` inside <...> or (...).
function splitUnion(s) {
  const parts = [];
  let depth = 0, current = '';
  for (const ch of s) {
    if (ch === '<' || ch === '(') depth++;
    else if (ch === '>' || ch === ')') depth--;
    if (ch === '|' && depth === 0) { parts.push(current.trim()); current = ''; }
    else current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

const STRING_LIT = /^'([^']*)'$|^"([^"]*)"$/;
const NUMBER_LIT = /^-?\d+(\.\d+)?$/;
const REACTISH = /(React\.|ReactNode|ReactElement|ElementType|JSX\.|CSSProperties|=>|\bFC\b|Ref<|HTMLAttributes|SVGProps)/;

/**
 * Parse a TS type string into a JSON Schema fragment.
 * Returns null when the type is not safely JSON-emittable (React nodes, handlers,
 * unknown shapes) — the caller drops the prop.
 */
export function parseType(raw) {
  const t = (raw ?? '').trim();
  if (!t || REACTISH.test(t)) return null;

  const responsive = t.match(/^Responsive<(.+)>$/);
  if (responsive) {
    const inner = parseType(responsive[1]);
    if (!inner) return null;
    return { oneOf: [inner, { type: 'array', items: { anyOf: [inner, { type: 'null' }] } }] };
  }

  const parts = splitUnion(t);

  if (parts.length === 1) {
    const p = parts[0];
    if (p === 'number') return { type: 'number' };
    if (p === 'string') return { type: 'string' };
    if (p === 'boolean') return { type: 'boolean' };
    if (p === 'true' || p === 'false') return { type: 'boolean' };
    const sm = p.match(STRING_LIT);
    if (sm) return { type: 'string', enum: [sm[1] ?? sm[2]] };
    if (NUMBER_LIT.test(p)) return { type: 'number', enum: [Number(p)] };
    return null; // unknown single token — drop
  }

  // Union of literals.
  const strings = [], numbers = [];
  let allString = true, allNumber = true, allBool = true;
  for (const p of parts) {
    const sm = p.match(STRING_LIT);
    if (sm) { strings.push(sm[1] ?? sm[2]); allNumber = false; allBool = false; continue; }
    if (NUMBER_LIT.test(p)) { numbers.push(Number(p)); allString = false; allBool = false; continue; }
    if (p === 'true' || p === 'false') { allString = false; allNumber = false; continue; }
    return null; // a non-literal in the union — too loose to constrain, drop
  }
  if (allString) return { type: 'string', enum: strings };
  if (allNumber) return { type: 'number', enum: numbers };
  if (allBool) return { type: 'boolean' };
  return null;
}

// ── Token-derived scales ───────────────────────────────────────────────────

function scaleFromTokenGroup(entities, identifier, { keepRoundLiteral = false } = {}) {
  const group = entities.find(e => e.kind === 'token-group' && e.identifier === identifier);
  if (!group?.children?.length) return null;
  const values = [];
  for (const child of group.children) {
    const m = (child.identifier ?? '').match(/-(\d+)$/);
    if (m) values.push(Number(m[1]));
    else if (keepRoundLiteral && /round$/.test(child.identifier ?? '')) values.push('round');
  }
  return values.length ? values : null;
}

function responsiveScaleSchema(values) {
  const allNumbers = values.every(v => typeof v === 'number');
  const inner = allNumbers ? { type: 'integer', enum: values } : { enum: values };
  return { oneOf: [inner, { type: 'array', items: { anyOf: [inner, { type: 'null' }] } }] };
}

// ── Catalog generation ───────────────────────────────────────────────────────

export function generateCatalog(entities, { includeBeta = true } = {}) {
  const allowed = new Set(['stable', ...(includeBeta ? ['beta'] : [])]);
  const spaceScale = scaleFromTokenGroup(entities, 'space') ?? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const radiusScale = scaleFromTokenGroup(entities, 'radius', { keepRoundLiteral: true }) ?? [0, 1, 2, 3, 4, 5, 6, 'round'];

  const components = {};
  const textComponents = [];
  const skipped = [];

  for (const entity of entities) {
    if (entity.kind !== 'component') continue;
    const status = statusOf(entity);
    if (!allowed.has(status)) { skipped.push({ id: entity.identifier, status }); continue; }

    const apiBlock = (entity.documentBlocks ?? []).find(b => b.kind === 'api');
    const properties = apiBlock?.properties ?? [];

    const props = {};
    let hasChildren = false;
    const required = [];

    for (const prop of properties) {
      const id = prop.identifier;
      if (id === 'children') { hasChildren = true; continue; }

      let schema;
      if (SPACING_PROPS.has(id)) schema = responsiveScaleSchema(spaceScale);
      else if (id === 'radius') schema = responsiveScaleSchema(radiusScale);
      else schema = parseType(prop.type);

      if (!schema) continue; // dropped (React-typed / unknown)
      if (prop.description) schema.description = prop.description.split('\n')[0];
      props[id] = schema;
      if (prop.required) required.push(id);
    }

    if (TEXT_CONTENT.has(entity.identifier) && !props.text) {
      props.text = { type: 'string', description: 'Text content rendered inside the component.' };
    }
    if (ICON_COMPONENTS.has(entity.identifier)) {
      props.icon = { type: 'string', description: 'Name of a @sanity/icons export (PascalCase, "Icon" suffix), e.g. "SearchIcon", "AddIcon".' };
    }

    const name = toComponentName(entity.identifier);
    if (TEXT_CONTENT.has(entity.identifier)) textComponents.push(name);
    const acceptsChildren = hasChildren || !LEAF_COMPONENTS.has(entity.identifier);
    components[name] = {
      props: { type: 'object', properties: props, required, additionalProperties: false },
      ...(acceptsChildren ? { slots: ['default'] } : {}),
      description: (entity.description ?? '').split('\n')[0],
      _identifier: entity.identifier,
      _status: status,
    };
  }

  return {
    components,
    actions: DEFAULT_ACTIONS,
    meta: {
      generatedFrom: 'DSDS',
      includedStatuses: [...allowed],
      componentCount: Object.keys(components).length,
      skippedCount: skipped.length,
      textComponents,
      tokenScales: { space: spaceScale, radius: radiusScale },
    },
  };
}

// ── UI-spec validation (json-render { root, elements } shape) ─────────────────

export function buildSpecSchema(catalog) {
  const names = Object.keys(catalog.components);
  const branches = names.map(name => ({
    if: { properties: { type: { const: name } }, required: ['type'] },
    then: { properties: { props: catalog.components[name].props } },
  }));

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: ['root', 'elements'],
    properties: {
      root: { type: 'string' },
      elements: {
        type: 'object',
        minProperties: 1,
        additionalProperties: {
          type: 'object',
          required: ['type'],
          properties: {
            type: { type: 'string', enum: names },
            props: { type: 'object' },
            children: { type: 'array', items: { type: 'string' } },
            on: { type: 'object' },
          },
          allOf: branches,
        },
      },
    },
  };
}

/**
 * Validate a generated UI spec ({ root, elements }) against the catalog.
 * Returns { valid, errors: string[] } — errors are written as recovery hints.
 */
export function validateUiSpec(catalog, specInput) {
  let spec = specInput;
  if (typeof spec === 'string') {
    try { spec = JSON.parse(spec); }
    catch (err) { return { valid: false, errors: [`Spec is not valid JSON: ${err.message}`] }; }
  }
  if (!spec || typeof spec !== 'object') return { valid: false, errors: ['Spec must be an object with `root` and `elements`.'] };

  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(buildSpecSchema(catalog));
  const ok = validate(spec);

  const errors = [];
  const names = Object.keys(catalog.components);

  for (const e of validate.errors ?? []) {
    if (e.keyword === 'if') continue; // umbrella "must match then" — the specific error is also present
    errors.push(describeError(e, spec, catalog));
  }

  // Referential checks the schema can't express.
  const elements = spec.elements ?? {};
  if (spec.root && !elements[spec.root]) {
    errors.push(`Root "${spec.root}" is not present in elements.`);
  }
  for (const [id, el] of Object.entries(elements)) {
    for (const childId of el?.children ?? []) {
      if (!elements[childId]) errors.push(`Element "${id}" references child "${childId}", which does not exist in elements.`);
    }
  }

  const valid = ok && errors.length === 0;
  if (valid) errors.push(`Valid. ${Object.keys(elements).length} element(s), all types and props within the catalog (${names.length} components).`);
  return { valid, errors: dedupe(errors) };
}

function describeError(e, spec, catalog) {
  const path = e.instancePath || '';
  const m = path.match(/^\/elements\/([^/]+)(?:\/(.*))?$/);
  const id = m?.[1];
  const el = id ? spec.elements?.[id] : null;
  const type = el?.type;
  const where = id ? `Element "${id}"${type ? ` (${type})` : ''}` : 'Spec';

  if (e.keyword === 'additionalProperties') {
    const prop = e.params?.additionalProperty;
    const allowed = type && catalog.components[type]
      ? Object.keys(catalog.components[type].props.properties).join(', ') || '(none)'
      : null;
    return `${where}: prop "${prop}" is not allowed.${allowed ? ` Allowed props: ${allowed}.` : ''}`;
  }
  if (e.keyword === 'enum' && path.endsWith('/type')) {
    return `${where}: component type "${type}" is not in the catalog. It may be draft or not exist. Use dsds_get_catalog to see available types.`;
  }
  if (e.keyword === 'enum') {
    return `${where}: ${path.split('/').pop()} = invalid value. Allowed: ${(e.params?.allowedValues ?? []).map(v => JSON.stringify(v)).join(', ')}.`;
  }
  if (e.keyword === 'required') {
    return `${where}: missing required ${e.params?.missingProperty ? `"${e.params.missingProperty}"` : 'field'}.`;
  }
  return `${where || '(root)'} ${path}: ${e.message}.`;
}

function dedupe(arr) {
  return [...new Set(arr)];
}

// ── Rendering ────────────────────────────────────────────────────────────────

export function renderCatalogSummary(catalog) {
  const { meta } = catalog;
  // Tone vocabulary, read from whichever component exposes a `tone` enum.
  const toneVals = (() => {
    for (const def of Object.values(catalog.components)) {
      const t = def.props.properties.tone;
      if (t?.enum) return t.enum;
    }
    return ['neutral', 'positive', 'suggest', 'caution', 'critical'];
  })();
  const lines = [
    '# Generative-UI catalog (prototype, generated from DSDS)',
    '',
    `Components: **${meta.componentCount}** (statuses: ${meta.includedStatuses.join(', ')}; ${meta.skippedCount} excluded as draft/deprecated).`,
    `Spacing scale: \`${meta.tokenScales.space.join(', ')}\` · Radius scale: \`${meta.tokenScales.radius.join(', ')}\``,
    '',
    'Each component lists the props a model may emit. Props are derived from the DSDS `api` block; React-typed props (children, handlers) are dropped — `children` becomes a `default` slot. Excluded props (e.g. Card `padding`) are simply absent, so they cannot be generated.',
    '',
    '## Conventions for emitted values',
    '',
    '- **Scale props are integer literals, not strings.** `size`, `gap`, `padding`, `margin` (and `paddingX/Y`, `columnGap`, `rowGap`) take a number: `"size": 2`, never `"size": "2"` or `"size": "large"`.',
    `- **\`tone\` is one of:** ${toneVals.map((v) => `\`${v}\``).join(', ')}. No other value (no \`default\`, \`info\`, or hex).`,
    '- **Enum props are named strings, not integers** — e.g. `density` is `"compact"`/`"regular"`/`"loose"`, `level` is `"tertiary"`/`"secondary"`/`"primary"`. Never `"density": 1`.',
    '- **`radius`** takes an integer step or the literal `"round"`.',
    '- **`Icon`** takes an `icon` string — a @sanity/icons export name (PascalCase, "Icon" suffix), e.g. `"SearchIcon"`, `"AddIcon"`, `"CloseIcon"`, `"CogIcon"`.',
    '- **Responsive props** accept either a single integer or an array of integers; use `null` to skip a breakpoint — `"padding": 3` or `"padding": [2, null, 4]`.',
    '- **Only the props listed below are allowed.** Anything not listed for a component is rejected.',
    '',
    '| Component | Slots | Props (model may emit) |',
    '|-----------|-------|------------------------|',
  ];
  for (const [name, def] of Object.entries(catalog.components)) {
    const props = Object.keys(def.props.properties);
    const list = props.length ? props.map(p => (def.props.required.includes(p) ? `**${p}**` : p)).join(', ') : '—';
    lines.push(`| \`${name}\` | ${def.slots ? def.slots.join(', ') : '—'} | ${list} |`);
  }
  lines.push('', `Actions: ${Object.keys(catalog.actions).join(', ')}.`, '');
  lines.push('Formats: `dsds_get_catalog(format:"json-schema")` for the UI-spec JSON Schema; `format:"zod"` for a `defineCatalog` source you can paste into a json-render client. Validate generated specs with `dsds_validate_ui`.');
  return lines.join('\n');
}

export function renderZodCatalogSource(catalog) {
  const lines = [
    "import { defineCatalog } from '@json-render/core'",
    "import { schema } from '@json-render/react/schema'",
    "import { z } from 'zod'",
    '',
    '// Generated from DSDS by the dsds-mcp catalog prototype. Review before shipping.',
    'export const catalog = defineCatalog(schema, {',
    '  components: {',
  ];
  for (const [name, def] of Object.entries(catalog.components)) {
    const propsSrc = Object.entries(def.props.properties)
      .map(([p, s]) => `      ${JSON.stringify(p)}: ${zodFor(s)}${def.props.required.includes(p) ? '' : '.optional()'},`)
      .join('\n');
    lines.push(`    ${name}: {`);
    lines.push(`      props: z.object({${propsSrc ? `\n${propsSrc}\n      ` : ''}}),`);
    if (def.slots) lines.push(`      slots: ${JSON.stringify(def.slots)},`);
    if (def.description) lines.push(`      description: ${JSON.stringify(def.description)},`);
    lines.push('    },');
  }
  lines.push('  },');
  lines.push('  actions: {');
  for (const [name, def] of Object.entries(catalog.actions)) {
    lines.push(`    ${name}: { description: ${JSON.stringify(def.description)} },`);
  }
  lines.push('  },');
  lines.push('})');
  return lines.join('\n');
}

// ── Renderer generation (JSON spec → runnable Sanity-UI app) ──────────────────

const RENDERER_TSX = (names, textComponents) => `import * as UI from '@sanity-labs/ui-poc'
import * as Icons from '@sanity/icons'
import { Component, type ReactNode } from 'react'

/**
 * Generic renderer: walks a json-render { root, elements } spec and renders each
 * element with the matching @sanity-labs/ui-poc component. Generated by the
 * dsds-mcp catalog prototype — the registry covers exactly the catalog's
 * stable/beta components.
 */
type El = { type: string; props?: Record<string, unknown>; children?: string[] }
type Spec = { root: string; elements: Record<string, El> }

const NAMES: string[] = ${JSON.stringify(names)}
const TEXT_AS_CHILDREN = new Set<string>(${JSON.stringify(textComponents)})

const REGISTRY: Record<string, any> = Object.fromEntries(
  NAMES.map((n) => [n, (UI as any)[n]]).filter(([, c]) => c),
)
// List ships subcomponents as dotted members, not top-level exports.
const L = (UI as any).List
if (L) {
  REGISTRY.ListItem = L.Item
  REGISTRY.ListItemText = L.ItemText
  REGISTRY.ListItemImage = L.ItemImage
}

// JSON has null; Sanity responsive arrays expect undefined to skip a breakpoint.
const adapt = (v: unknown) => (Array.isArray(v) ? v.map((x) => (x === null ? undefined : x)) : v)

// Isolate render errors per element: a component that throws (e.g. an Icon
// missing its symbol prop) renders as nothing instead of blanking the tree.
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? null : this.props.children }
}

function renderEl(id: string, spec: Spec): ReactNode {
  const el = spec.elements[id]
  if (!el) return null
  const Comp = REGISTRY[el.type]
  const props: Record<string, unknown> = {}
  let text: unknown
  for (const [k, v] of Object.entries(el.props ?? {})) {
    if (k === 'text' && (TEXT_AS_CHILDREN.has(el.type) || !Comp)) { text = v; continue }
    // Resolve an icon name (e.g. "SearchIcon") to the @sanity/icons component.
    if (k === 'icon' && typeof v === 'string') { props.icon = (Icons as any)[v]; continue }
    props[k] = adapt(v)
  }
  const kids = (el.children ?? []).map((cid) => renderEl(cid, spec)).filter(Boolean)
  const children = kids.length ? kids : text != null ? String(text) : undefined
  // Unknown component → render children in a div so the subtree survives.
  const node = Comp ? <Comp {...props}>{children}</Comp> : <div data-genui-unknown={el.type}>{children}</div>
  return <Boundary key={id}>{node}</Boundary>
}

export function GenUIRenderer({ spec }: { spec: Spec }) {
  return <>{renderEl(spec.root, spec)}</>
}
`;

const MAIN_TSX = `import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, studioTheme } from '@sanity/ui'
import '@sanity-labs/ui-poc/styles.css'
import { GenUIRenderer } from './GenUIRenderer'
import spec from './genui-spec.json'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={studioTheme}>
      <GenUIRenderer spec={spec as any} />
    </ThemeProvider>
  </React.StrictMode>,
)
`;

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>GenUI render</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({ plugins: [react()] })
`;

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: 'ES2020', useDefineForClassFields: true, lib: ['ES2020', 'DOM', 'DOM.Iterable'],
    module: 'ESNext', skipLibCheck: true, moduleResolution: 'bundler', resolveJsonModule: true,
    isolatedModules: true, noEmit: true, jsx: 'react-jsx', strict: false,
  },
  include: ['src'],
}, null, 2);

const PACKAGE_JSON = JSON.stringify({
  name: 'genui-render', private: true, version: '0.0.1', type: 'module',
  scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
  dependencies: {
    react: '^19.2', 'react-dom': '^19.2',
    '@sanity/ui': '^2.11.2', '@sanity/icons': '^3.3.0', '@sanity-labs/ui-poc': '0.0.1-alpha.17',
  },
  devDependencies: {
    '@types/react': '^19.2.0', '@types/react-dom': '^19.2.0',
    '@vitejs/plugin-react': '^4.3.0', typescript: '^5.4.5', vite: '^5.2.0',
  },
  // The @sanity/ui ↔ @sanity-labs/ui-poc react-refractor conflict, per the system docs.
  overrides: { 'react-refractor': '^2.2.0' },
}, null, 2);

const README = `# GenUI render (generated)

A runnable app that renders a validated json-render spec with real \`@sanity-labs/ui-poc\` components.

\`\`\`sh
npm install
npm run dev   # then open the printed localhost URL
\`\`\`

- \`src/genui-spec.json\` — the validated UI spec.
- \`src/GenUIRenderer.tsx\` — the registry + recursive renderer (catalog type → real component).
- \`src/main.tsx\` — bootstraps ThemeProvider and renders the spec.

Generated by the dsds-mcp \`dsds_render_ui\` prototype. Not for production.
`;

/**
 * Generate a complete, runnable Vite app that renders a validated spec with real
 * Sanity UI components. Returns [{ path, content }, …].
 */
export function generateRenderer(catalog, spec) {
  const names = Object.keys(catalog.components);
  const textComponents = catalog.meta?.textComponents ?? [];
  return [
    { path: 'package.json', content: PACKAGE_JSON + '\n' },
    { path: 'index.html', content: INDEX_HTML },
    { path: 'vite.config.ts', content: VITE_CONFIG },
    { path: 'tsconfig.json', content: TSCONFIG + '\n' },
    { path: 'src/main.tsx', content: MAIN_TSX },
    { path: 'src/GenUIRenderer.tsx', content: RENDERER_TSX(names, textComponents) },
    { path: 'src/genui-spec.json', content: JSON.stringify(spec, null, 2) + '\n' },
    { path: 'README-genui.md', content: README },
  ];
}

function zodFor(s) {
  if (!s) return 'z.any()';
  if (s.oneOf) return `z.union([${s.oneOf.map(zodFor).join(', ')}])`;
  if (s.anyOf) return `z.union([${s.anyOf.map(zodFor).join(', ')}])`;
  if (s.enum) {
    if (s.type === 'string') return `z.enum([${s.enum.map(v => JSON.stringify(v)).join(', ')}])`;
    return `z.union([${s.enum.map(v => `z.literal(${JSON.stringify(v)})`).join(', ')}])`;
  }
  if (s.type === 'array') return `z.array(${zodFor(s.items)})`;
  if (s.type === 'integer') return 'z.number().int()';
  if (s.type === 'number') return 'z.number()';
  if (s.type === 'boolean') return 'z.boolean()';
  if (s.type === 'string') return 'z.string()';
  if (s.type === 'null') return 'z.null()';
  if (s.type === 'object') return 'z.object({})';
  return 'z.any()';
}
