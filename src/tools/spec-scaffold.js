import { ENTITY_KINDS, SCAFFOLDS } from '../spec/knowledge.js';
import { getUpdateNotice } from '../spec/version.js';

const SCAFFOLD_KINDS = [...ENTITY_KINDS, 'system'];

export const specScaffoldDef = {
  name: 'dsds_spec_scaffold',
  description:
    'Generate a minimal valid DSDS JSON template for a given entity kind. Use "system" to get a multi-entity document starter. Fill in the placeholders and add documentBlocks incrementally, then validate with dsds_validate.',
  inputSchema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: SCAFFOLD_KINDS,
        description: 'Entity kind to scaffold. Use "system" for a multi-entity document.',
      },
    },
    required: ['kind'],
  },
};

export async function specScaffoldHandler({ kind }) {
  const scaffold = SCAFFOLDS[kind];
  if (!scaffold) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown kind "${kind}". Valid kinds: ${SCAFFOLD_KINDS.join(', ')}` }],
    };
  }

  const lines = [
    `# DSDS Scaffold: \`${kind}\``,
    '',
    'Replace the placeholder values with your actual content. Add `documentBlocks` to document guidelines, anatomy, API, etc.',
    '',
    '```json',
    JSON.stringify(scaffold, null, 2),
    '```',
    '',
    'Next steps:',
    '- Use `dsds_spec_document_blocks` to see which block types are available for this kind',
    '- Use `dsds_validate` to validate the document as you fill it in',
  ];

  if (kind !== 'system') {
    lines.push('- Use `dsds_spec_entity_schema` to see all available fields for this entity');
  }

  const notice = getUpdateNotice();
  if (notice) lines.push(notice);

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
