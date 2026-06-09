import { getUpdateNotice } from '../spec/version.js';

export const getEntityDef = {
  name: 'dsds_get_entity',
  description:
    'Get the full documentation for a specific entity by its identifier or name. Returns all metadata and documentBlocks. Use dsds_get_document_block if you only need one section.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'The entity identifier (e.g. "button") or name (e.g. "Button"). Case-insensitive.',
      },
    },
    required: ['identifier'],
  },
};

export async function getEntityHandler({ identifier }, getSystems, getSummaries) {
  const systems = getSystems();
  if (systems.length === 0) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'No DSDS files configured. Set the `DSDS_PATHS` environment variable.' }],
    };
  }

  const needle = identifier.toLowerCase();
  let found = null;
  let foundFilePath = null;

  for (const system of systems) {
    const entity = system.entities.find(
      e => e.identifier?.toLowerCase() === needle || e.name?.toLowerCase() === needle
    );
    if (entity) { found = entity; foundFilePath = system.filePath; break; }
  }

  if (!found) {
    const available = getSummaries().map(s => `\`${s.identifier}\``).join(', ');
    return {
      isError: true,
      content: [{ type: 'text', text: `Entity "${identifier}" not found.\n\nAvailable identifiers: ${available}` }],
    };
  }

  const lines = [
    `# ${found.name ?? found.identifier} (\`${found.kind}\`)`,
    '',
    `**Identifier:** \`${found.identifier}\``,
    `**File:** ${foundFilePath}`,
    '',
  ];

  if (found.metadata) {
    const m = found.metadata;
    if (m.description) lines.push(`## Description\n\n${resolveText(m.description)}\n`);
    if (m.summary) lines.push(`**Summary:** ${m.summary}\n`);
    if (m.status) lines.push(`**Status:** ${resolveStatus(m.status)}\n`);
    if (m.tags?.length) lines.push(`**Tags:** ${m.tags.join(', ')}\n`);
    if (m.since) lines.push(`**Since:** ${m.since}\n`);
    if (m.aliases?.length) lines.push(`**Aliases:** ${m.aliases.join(', ')}\n`);
  }

  if (found.tokenType) lines.push(`**Token type:** ${found.tokenType}\n`);

  if (found.documentBlocks?.length) {
    lines.push(`## Documentation (${found.documentBlocks.length} block${found.documentBlocks.length !== 1 ? 's' : ''})`, '');
    for (const block of found.documentBlocks) {
      lines.push(`### ${block.kind}`, '', '```json', JSON.stringify(block, null, 2), '```', '');
    }
  } else {
    lines.push('*No document blocks defined for this entity.*');
  }

  if (found.agents) {
    lines.push('## Agent Context', '', '```json', JSON.stringify(found.agents, null, 2), '```');
  }

  const notice = getUpdateNotice();
  if (notice) lines.push(notice);

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

function resolveText(value) {
  if (!value) return '';
  return typeof value === 'string' ? value : (value.value ?? '');
}

function resolveStatus(status) {
  if (!status) return '';
  return typeof status === 'string' ? status : (status.value ?? '');
}
