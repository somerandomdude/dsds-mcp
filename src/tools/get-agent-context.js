import { getUpdateNotice } from '../spec/version.js';

export const getAgentContextDef = {
  name: 'dsds_get_agent_context',
  description:
    'Get the machine-readable agent context for an entity — constraints, disambiguation, anti-patterns, and keywords. ' +
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

  if (!found.agents) {
    const lines = [
      `# ${found.name ?? found.identifier} — no agent context defined`,
      '',
      `This entity has no \`agents\` field. Consider adding one to improve how AI agents use this component.`,
      '',
      'The `agents` field supports:',
      '- **`constraints`** — must/should/must-not rules in structured form',
      '- **`disambiguation`** — how to tell this apart from similar entities',
      '- **`antiPatterns`** — common mistakes with corrections',
      '- **`keywords`** — terms that help agents discover this entity',
      '',
      'Example:',
      '```json',
      JSON.stringify({
        agents: {
          constraints: [
            { level: 'must', rule: 'Always provide a visible label.' },
            { level: 'must-not', rule: 'Do not use for navigation.' },
          ],
          disambiguation: 'Use this for actions, not navigation.',
          antiPatterns: [{ pattern: 'Common mistake.', correction: 'Correct approach.' }],
          keywords: ['keyword-one', 'keyword-two'],
        },
      }, null, 2),
      '```',
    ];
    return { content: [{ type: 'text', text: lines.join('\n') }] };
  }

  const { intent, constraints = [], disambiguation, antiPatterns = [], keywords = [] } = found.agents;

  const lines = [
    `# ${found.name ?? found.identifier} — Agent Context`,
    '',
  ];

  if (intent) {
    lines.push('## Intent', '', intent, '');
  }

  if (disambiguation) {
    lines.push('## Disambiguation', '');
    if (Array.isArray(disambiguation)) {
      for (const d of disambiguation) {
        lines.push(`**vs ${d.entity}:** ${d.distinction}`);
      }
    } else {
      lines.push(disambiguation);
    }
    lines.push('');
  }

  if (constraints.length > 0) {
    lines.push('## Constraints', '');
    const grouped = { must: [], 'must-not': [], should: [], 'should-not': [] };
    for (const c of constraints) {
      (grouped[c.level] ??= []).push(c.rule);
    }
    for (const [level, rules] of Object.entries(grouped)) {
      if (rules.length === 0) continue;
      lines.push(`**${level.toUpperCase()}**`);
      for (const rule of rules) lines.push(`- ${rule}`);
      lines.push('');
    }
  }

  if (antiPatterns.length > 0) {
    lines.push('## Anti-patterns', '');
    for (const ap of antiPatterns) {
      const avoid = ap.description ?? ap.pattern ?? '';
      const instead = ap.instead ?? ap.correction ?? '';
      lines.push(`**Avoid:** ${avoid}`);
      if (instead) lines.push(`**Instead:** ${instead}`);
      lines.push('');
    }
  }

  if (keywords.length > 0) {
    lines.push('## Keywords', '', keywords.join(', '), '');
  }

  const notice = getUpdateNotice();
  if (notice) lines.push(notice);

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
