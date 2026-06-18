export const getBlueprintDef = {
  name: 'dsds_get_blueprint',
  description:
    'Get a blueprint by identifier, rendered for agent use. Returns the code block (ready to copy), ' +
    'guidelines, use cases, and composed-component links. ' +
    'Use this instead of dsds_get_entity when working with blueprint entities.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'Blueprint identifier (case-insensitive, kebab-case).',
      },
    },
    required: ['identifier'],
  },
};

export async function getBlueprintHandler({ identifier }, getSystems) {
  const systems = getSystems();

  if (!systems || systems.length === 0) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: 'No DSDS systems loaded. Set the DSDS_PATHS environment variable to point at your .dsds.json file(s).',
      }],
    };
  }

  const needle = identifier.toLowerCase();
  let blueprint = null;

  for (const system of systems) {
    for (const entity of system.entities) {
      if (entity.kind === 'blueprint' && entity.identifier?.toLowerCase() === needle) {
        blueprint = entity;
        break;
      }
    }
    if (blueprint) break;
  }

  if (!blueprint) {
    // Collect all blueprint identifiers for a helpful error
    const allBlueprints = systems
      .flatMap(s => s.entities)
      .filter(e => e.kind === 'blueprint')
      .map(e => e.identifier);

    const hint = allBlueprints.length > 0
      ? `\n\nAvailable blueprints: ${allBlueprints.map(id => `\`${id}\``).join(', ')}`
      : '\n\nNo blueprints found in the loaded design system.';

    return {
      isError: true,
      content: [{ type: 'text', text: `Blueprint \`${identifier}\` not found.${hint}` }],
    };
  }

  const lines = [
    `# Blueprint: ${blueprint.name}`,
    `\`${blueprint.identifier}\``,
    '',
  ];

  if (blueprint.description) {
    lines.push(blueprint.description, '');
  }

  // Status / metadata summary
  const meta = blueprint.metadata;
  if (meta) {
    const status = resolveStatus(meta);
    if (status) lines.push(`**Status:** ${status}`, '');
  }

  // Code block — the primary payload
  const { code: codeStr, language } = blueprint.code ?? {};
  lines.push(
    '## Code',
    '',
    `\`\`\`${language ?? ''}`,
    codeStr ?? '',
    '```',
    '',
  );

  // Composed components (links with entity kinds)
  const componentLinks = resolveComponentLinks(meta);
  if (componentLinks.length > 0) {
    lines.push('## Composed Components', '');
    for (const link of componentLinks) {
      const req = link.required ? ' *(required)*' : '';
      const role = link.role ? ` — ${link.role}` : '';
      lines.push(`- \`${link.identifier}\`${role}${req}`);
    }
    lines.push('');
  }

  // Use cases
  const useCases = blueprint.useCases ?? [];
  if (useCases.length > 0) {
    const recommended = useCases.filter(u => u.stance === 'recommended');
    const discouraged = useCases.filter(u => u.stance === 'discouraged');

    if (recommended.length > 0) {
      lines.push('## When to use', '');
      for (const u of recommended) lines.push(`- ${u.description}`);
      lines.push('');
    }
    if (discouraged.length > 0) {
      lines.push('## When not to use', '');
      for (const u of discouraged) {
        lines.push(`- ${u.description}`);
        if (u.alternative) {
          lines.push(`  *Alternative: \`${u.alternative.identifier}\` — ${u.alternative.rationale}*`);
        }
      }
      lines.push('');
    }
  }

  // Guidelines
  const guidelines = blueprint.guidelines ?? [];
  if (guidelines.length > 0) {
    lines.push('## Guidelines', '');
    for (const g of guidelines) {
      const level = formatLevel(g.level);
      const rationale = g.rationale ? ` — ${g.rationale}` : '';
      lines.push(`- **${level}:** ${g.guidance}${rationale}`);
    }
    lines.push('');
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

function resolveStatus(metadata) {
  if (!metadata) return undefined;
  if (Array.isArray(metadata)) {
    return metadata.find(m => m.kind === 'status')?.status;
  }
  const s = metadata.status;
  if (!s) return undefined;
  return typeof s === 'string' ? s : s.overall ?? s.value;
}

function resolveComponentLinks(metadata) {
  if (!metadata) return [];
  const links = Array.isArray(metadata) ? [] : (metadata.links ?? []);
  return links.filter(l =>
    l.identifier && ['component', 'pattern', 'foundation', 'token', 'token-group'].includes(l.kind)
  );
}

function formatLevel(level) {
  switch (level) {
    case 'must':       return 'Must';
    case 'must-not':   return 'Must not';
    case 'should':     return 'Should';
    case 'should-not': return 'Should not';
    default:           return level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Note';
  }
}
