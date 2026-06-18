import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

async function writeChunkLog(logsDir, identifier, name) {
  if (!logsDir) return;
  try {
    await mkdir(logsDir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const logPath = join(logsDir, `${date}.jsonl`);
    const entry = { timestamp: new Date().toISOString(), tool: 'dsds_get_chunk', identifier, name };
    await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf-8');
  } catch { /* best-effort */ }
}

export const getChunkDef = {
  name: 'dsds_get_chunk',
  description:
    'Get a chunk by identifier, rendered for agent use. Returns the code block (ready to copy), ' +
    'guidelines, use cases, and composed-component links. ' +
    'Use this instead of dsds_get_entity when working with chunk entities.',
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'Chunk identifier (case-insensitive, kebab-case).',
      },
    },
    required: ['identifier'],
  },
};

export async function getChunkHandler({ identifier }, getSystems, logsDir = null) {
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
  let chunk = null;

  for (const system of systems) {
    for (const entity of system.entities) {
      if ((entity.kind === 'chunk' || entity.kind === 'blueprint') && entity.identifier?.toLowerCase() === needle) {
        chunk = entity;
        break;
      }
    }
    if (chunk) break;
  }

  if (!chunk) {
    const allChunks = systems
      .flatMap(s => s.entities)
      .filter(e => e.kind === 'chunk' || e.kind === 'blueprint')
      .map(e => e.identifier);

    const hint = allChunks.length > 0
      ? `\n\nAvailable chunks: ${allChunks.map(id => `\`${id}\``).join(', ')}`
      : '\n\nNo chunks found in the loaded design system.';

    return {
      isError: true,
      content: [{ type: 'text', text: `Chunk \`${identifier}\` not found.${hint}` }],
    };
  }

  const lines = [
    `# Chunk: ${chunk.name}`,
    `\`${chunk.identifier}\``,
    '',
  ];

  if (chunk.description) {
    lines.push(chunk.description, '');
  }

  const meta = chunk.metadata;
  if (meta) {
    const status = resolveStatus(meta);
    if (status) lines.push(`**Status:** ${status}`, '');
  }

  // Code block — the primary payload
  const { code: codeStr, language } = chunk.code ?? {};
  lines.push(
    '## Code',
    '',
    `\`\`\`${language ?? ''}`,
    codeStr ?? '',
    '```',
    '',
  );

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

  const useCases = chunk.useCases ?? [];
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

  const guidelines = chunk.guidelines ?? [];
  if (guidelines.length > 0) {
    lines.push('## Guidelines', '');
    for (const g of guidelines) {
      const level = formatLevel(g.level);
      const rationale = g.rationale ? ` — ${g.rationale}` : '';
      lines.push(`- **${level}:** ${g.guidance}${rationale}`);
    }
    lines.push('');
  }

  await writeChunkLog(logsDir, chunk.identifier, chunk.name);
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
