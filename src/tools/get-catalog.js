import { generateCatalog, renderCatalogSummary, buildSpecSchema, renderZodCatalogSource } from '../catalog.js';

export const getCatalogDef = {
  name: 'dsds_get_catalog',
  description:
    'Generate a generative-UI catalog from the loaded design system (PROTOTYPE). Returns the components a model may emit and the props allowed on each, derived from DSDS — draft components and React-typed/excluded props (e.g. Card `padding`) are omitted, so brand and accessibility constraints hold by construction. Spacing and radius props are constrained to the documented token scales. Pair with dsds_validate_ui to check a generated { root, elements } spec. Formats: "summary" (default), "json-schema" (the UI-spec JSON Schema for validation), "zod" (a defineCatalog source to paste into a json-render client).',
  inputSchema: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['summary', 'json-schema', 'zod'], description: 'Output format. Defaults to "summary".' },
      includeBeta: { type: 'boolean', description: 'Include beta components, not just stable. Defaults to true.' },
    },
  },
};

export function getCatalogHandler(args, getSystems) {
  const systems = getSystems();
  if (systems.length === 0) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'No DSDS files configured. Set `DSDS_PATHS` in your MCP client config to generate a catalog.' }],
    };
  }

  const entities = systems.flatMap(s => s.entities);
  const catalog = generateCatalog(entities, { includeBeta: args.includeBeta !== false });

  if (catalog.meta.componentCount === 0) {
    return { content: [{ type: 'text', text: 'No stable/beta components found in the loaded DSDS files.' }] };
  }

  const format = args.format ?? 'summary';
  let text;
  if (format === 'json-schema') {
    text = ['# UI-spec JSON Schema', '', 'Validate a generated `{ root, elements }` spec against this (dsds_validate_ui does it for you).', '', '```json', JSON.stringify(buildSpecSchema(catalog), null, 2), '```'].join('\n');
  } else if (format === 'zod') {
    text = ['# defineCatalog source', '', 'Paste into a json-render client. Review before shipping — this is generated.', '', '```ts', renderZodCatalogSource(catalog), '```'].join('\n');
  } else {
    text = renderCatalogSummary(catalog);
  }

  return { content: [{ type: 'text', text }] };
}
