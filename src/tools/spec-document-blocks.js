import { ENTITY_KINDS, DOCUMENT_BLOCK_DESCRIPTIONS, VALID_BLOCKS_BY_KIND } from '../spec/knowledge.js';
import { getUpdateNotice } from '../spec/version.js';

export const specDocumentBlocksDef = {
  name: 'dsds_spec_document_blocks',
  description:
    'List the document block types available for a DSDS entity kind, with descriptions of what each block captures.',
  inputSchema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ENTITY_KINDS,
        description: 'The entity kind to list document blocks for.',
      },
    },
    required: ['kind'],
  },
};

export async function specDocumentBlocksHandler({ kind }) {
  const validBlocks = VALID_BLOCKS_BY_KIND[kind];
  if (!validBlocks) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown entity kind "${kind}". Valid kinds: ${ENTITY_KINDS.join(', ')}` }],
    };
  }

  const lines = [
    `# Document Blocks for \`${kind}\``,
    '',
    `The \`documentBlocks\` array on a \`${kind}\` entity accepts ${validBlocks.length} block type${validBlocks.length !== 1 ? 's' : ''}:`,
    '',
  ];

  for (const blockType of validBlocks) {
    const desc = DOCUMENT_BLOCK_DESCRIPTIONS[blockType];
    lines.push(`### \`${blockType}\``);
    lines.push(desc?.summary ?? 'No description available.');
    lines.push('');
  }

  lines.push(
    '## Block Structure',
    '',
    'Every block in `documentBlocks` requires a `type` field matching one of the names above. Example:',
    '',
    '```json',
    JSON.stringify(exampleBlock(validBlocks[0]), null, 2),
    '```',
  );

  const notice = getUpdateNotice();
  if (notice) lines.push(notice);

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

function exampleBlock(type) {
  const examples = {
    guideline: { type: 'guideline', guidelines: [{ description: 'Rule text here.', enforcement: 'must' }] },
    purpose: { type: 'purpose', useCases: [{ title: 'When to use', description: 'Use this when...' }] },
    accessibility: { type: 'accessibility', wcagLevel: 'AA', notes: 'Keyboard and screen reader notes here.' },
    content: { type: 'content', notes: 'Copywriting and localization rules here.' },
    anatomy: { type: 'anatomy', parts: [{ name: 'container', description: 'The root element.' }] },
    api: { type: 'api', properties: [{ name: 'disabled', type: 'boolean', description: 'Disables interaction.' }] },
    variants: { type: 'variants', variants: [{ name: 'emphasis', values: ['primary', 'secondary', 'ghost'] }] },
    states: { type: 'states', states: [{ name: 'disabled', description: 'Non-interactive state.' }] },
    events: { type: 'events', events: [{ name: 'click', description: 'Fired when activated.' }] },
    'design-specifications': { type: 'design-specifications', specifications: [] },
    import: { type: 'import', imports: [{ platform: 'react', snippet: "import { MyComponent } from '@ds/components';" }] },
    interactions: { type: 'interactions', interactions: [{ title: 'Step 1', description: 'User action.' }] },
    principles: { type: 'principles', principles: [{ title: 'Principle name', description: 'Rationale.' }] },
    scale: { type: 'scale', steps: [{ name: 'sm', value: '4px' }] },
    motion: { type: 'motion', entries: [{ name: 'ease-in', duration: '150ms', easing: 'ease-in' }] },
  };
  return examples[type] ?? { type };
}
