import { getUpdateNotice } from '../spec/version.js';

export const getAgentContextDef = {
  name: 'dsds_get_agent_context',
  description:
    'Get the agent-facing context for an entity — its agent-only document blocks (agentDocumentBlocks) plus the hard constraints from its human-facing guidelines. ' +
    'This is the most LLM-optimized content in a DSDS document. Use it to understand the rules and edge cases for an entity before building with it.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'The entity identifier or name.',
      },
    },
    required: ['identifier'],
  },
};

const asText = v => (typeof v === 'string' ? v : (v?.value ?? ''));

function renderGuidelines(block, lines) {
  for (const item of block.items ?? []) {
    const level = item.level ? `**${item.level}** — ` : '';
    lines.push(`- ${level}${asText(item.guidance)}`);
    if (item.rationale) lines.push(`  - Why: ${asText(item.rationale)}`);
    if (item.evidence) lines.push(`  - Evidence: ${item.evidence}`);
    for (const c of item.criteria ?? []) {
      lines.push(`  - Criterion \`${c.identifier}\`: ${asText(c.statement)}`);
    }
  }
  lines.push('');
}

function renderUseCases(block, lines) {
  if (block.purpose) lines.push(asText(block.purpose), '');
  for (const uc of block.items ?? []) {
    const stance = uc.stance === 'discouraged' ? 'Avoid when' : 'Use when';
    let line = `- **${stance}:** ${asText(uc.description)}`;
    if (uc.alternative?.identifier) {
      line += ` → use \`${uc.alternative.identifier}\` instead`;
      if (uc.alternative.rationale) line += ` (${asText(uc.alternative.rationale)})`;
    }
    lines.push(line);
  }
  lines.push('');
}

function renderSections(block, lines) {
  for (const section of block.items ?? []) {
    if (section.title) lines.push(`**${section.title}**`, '');
    if (section.body) lines.push(asText(section.body), '');
    for (const ex of section.examples ?? []) {
      if (ex.description) lines.push(ex.description, '');
      if (ex.presentation?.kind === 'code') {
        lines.push('```' + (ex.presentation.language ?? ''), ex.presentation.code, '```', '');
      }
    }
  }
}

function renderBlock(block, lines) {
  switch (block.kind) {
    case 'guidelines': lines.push('## Rules', ''); renderGuidelines(block, lines); break;
    case 'useCases': lines.push('## When to use', ''); renderUseCases(block, lines); break;
    case 'sections': renderSections(block, lines); break;
    default:
      lines.push(`## ${block.kind}`, '', '```json', JSON.stringify(block, null, 2), '```', '');
  }
}

export async function getAgentContextHandler({ identifier }, getSystems) {
  const systems = getSystems();
  if (systems.length === 0) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'No DSDS files configured. Set the `DSDS_PATHS` environment variable.' }],
    };
  }

  const needle = identifier.toLowerCase();
  let found = null;

  for (const system of systems) {
    const entity = system.entities.find(
      e => e.identifier?.toLowerCase() === needle || e.name?.toLowerCase() === needle
    );
    if (entity) { found = entity; break; }
  }

  if (!found) {
    return {
      isError: true,
      content: [{ type: 'text', text: `Entity "${identifier}" not found. Use dsds_list_entities to see available identifiers.` }],
    };
  }

  const agentBlocks = found.agentDocumentBlocks ?? [];

  // Hard constraints from the human-facing guidelines — agents must obey
  // these too; they are already machine-readable (RFC 2119 levels).
  const hardRules = (found.documentBlocks ?? [])
    .filter(b => b.kind === 'guidelines')
    .flatMap(b => b.items ?? [])
    .filter(item => item.level === 'MUST' || item.level === 'MUST_NOT');

  if (agentBlocks.length === 0 && hardRules.length === 0) {
    const lines = [
      `# ${found.name ?? found.identifier} — no agent context defined`,
      '',
      'This entity has no `agentDocumentBlocks` and no MUST/MUST_NOT guidelines.',
      '',
      'Add an `agentDocumentBlocks` array — it accepts the same document block kinds as `documentBlocks` but is intended for agent (AI/LLM) consumption only and is never rendered for humans. Typical content:',
      '- A `guidelines` block with generation constraints (`level`: MUST/MUST_NOT, optional `evidence`)',
      '- A `useCases` block disambiguating this entity from confusable ones (discouraged items with `alternative`)',
      '- A `sections` block with ready-to-use code examples',
    ];
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  const lines = [
    `# ${found.name ?? found.identifier} — Agent Context`,
    '',
  ];

  if (found.description) {
    lines.push(asText(found.description), '');
  }

  if (agentBlocks.length > 0) {
    lines.push('# Agent-only documentation', '');
    for (const block of agentBlocks) renderBlock(block, lines);
  }

  if (hardRules.length > 0) {
    lines.push('# Hard constraints from the human-facing guidelines', '');
    renderGuidelines({ items: hardRules }, lines);
  }

  const notice = getUpdateNotice();
  if (notice) lines.push(notice);

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
