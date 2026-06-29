import { generateCatalog, validateUiSpec, generateRenderer } from '../catalog.js';

export const renderUiDef = {
  name: 'dsds_render_ui',
  description:
    'Turn a validated json-render `{ root, elements }` spec into a complete, runnable Vite app that renders it with real @sanity-labs/ui-poc components (PROTOTYPE). The spec is validated against the catalog first; if it fails, the validation issues are returned instead of code. On success, returns the project files (registry + recursive renderer + the spec + app shell) as `---FILE: path---` blocks ready to write, then `npm install && npm run dev`. This is the bridge from a generated spec to a rendered UI — pair with dsds_get_catalog and dsds_validate_ui.',
  inputSchema: {
    type: 'object',
    properties: {
      spec: { description: 'The UI spec to render — a { root, elements } object or a JSON string of one.' },
      includeBeta: { type: 'boolean', description: 'Render against beta components too. Defaults to true.' },
    },
    required: ['spec'],
  },
};

export function renderUiHandler(args, getSystems) {
  const systems = getSystems();
  if (systems.length === 0) {
    return { isError: true, content: [{ type: 'text', text: 'No DSDS files configured. Set `DSDS_PATHS` to render.' }] };
  }

  const entities = systems.flatMap((s) => s.entities);
  const catalog = generateCatalog(entities, { includeBeta: args.includeBeta !== false });

  const result = validateUiSpec(catalog, args.spec);
  if (!result.valid) {
    return {
      content: [{
        type: 'text',
        text: ['## Cannot render — the spec is invalid', '', 'Fix these, then call dsds_render_ui again:', '', ...result.errors.map((e) => `- ${e}`)].join('\n'),
      }],
    };
  }

  let spec = args.spec;
  if (typeof spec === 'string') { try { spec = JSON.parse(spec); } catch { /* validated above */ } }

  const files = generateRenderer(catalog, spec);
  const lines = [
    '## Runnable renderer',
    '',
    `Write these ${files.length} files, then \`npm install && npm run dev\` and open the printed URL. Renders the spec with real @sanity-labs/ui-poc components.`,
    '',
  ];
  for (const f of files) {
    lines.push(`---FILE: ${f.path}---`, f.content.replace(/\s+$/, ''), '---END FILE---', '');
  }
  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
