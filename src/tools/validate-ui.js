import { generateCatalog, validateUiSpec } from '../catalog.js';

export const validateUiDef = {
  name: 'dsds_validate_ui',
  description:
    'Validate a generated UI spec (json-render `{ root, elements }` shape) against the design-system catalog (PROTOTYPE). Confirms every element uses a real catalog component and only its allowed props, and that all child references and the root resolve. Returns pass/fail with recovery hints (e.g. "Card: prop padding is not allowed. Allowed props: density, tone."). Call dsds_get_catalog first to see the allowed components and props.',
  inputSchema: {
    type: 'object',
    properties: {
      spec: { description: 'The UI spec to validate — a { root, elements } object or a JSON string of one.' },
      includeBeta: { type: 'boolean', description: 'Validate against beta components too. Defaults to true.' },
    },
    required: ['spec'],
  },
};

export function validateUiHandler(args, getSystems) {
  const systems = getSystems();
  if (systems.length === 0) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'No DSDS files configured. Set `DSDS_PATHS` to validate against a catalog.' }],
    };
  }

  const entities = systems.flatMap(s => s.entities);
  const catalog = generateCatalog(entities, { includeBeta: args.includeBeta !== false });
  const result = validateUiSpec(catalog, args.spec);

  const header = result.valid ? '## UI spec is valid' : `## UI spec failed validation — ${result.errors.length} issue(s)`;
  const body = result.errors.map(e => `- ${e}`).join('\n');

  return { content: [{ type: 'text', text: `${header}\n\n${body}` }] };
}
