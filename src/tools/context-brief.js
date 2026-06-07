import { BUILD_BRIEF, AUTHOR_BRIEF } from '../briefs.js';
import { getUpdateNotice } from '../spec/version.js';

export const contextBriefDef = {
  name: 'dsds_context_brief',
  description:
    'Get a structured briefing of everything you need to know before starting work. ' +
    'Use useCase="build" before implementing UI with the design system. ' +
    'Use useCase="author" before documenting a design system in DSDS format. ' +
    'Call this first — before any other tool.',
  inputSchema: {
    type: 'object',
    properties: {
      useCase: {
        type: 'string',
        enum: ['build', 'author'],
        description: '"build" — implementing UI with the design system. "author" — writing DSDS documentation.',
      },
      task: {
        type: 'string',
        description: 'Optional. What specifically are you building or documenting? Adds a task header to the brief.',
      },
    },
    required: ['useCase'],
  },
};

export async function contextBriefHandler({ useCase, task }, getSystems, getSummaries) {
  const brief = useCase === 'build' ? BUILD_BRIEF : AUTHOR_BRIEF;
  const sections = [];

  if (task) {
    sections.push(`## Your task: ${task}`, '');
  }

  sections.push(brief);

  if (useCase === 'build') {
    const systemStatus = buildSystemStatus(getSystems, getSummaries);
    if (systemStatus) {
      sections.push('', '---', '', systemStatus);
    }
  }

  const notice = getUpdateNotice();
  if (notice) sections.push(notice);

  return { content: [{ type: 'text', text: sections.join('\n') }] };
}

function buildSystemStatus(getSystems, getSummaries) {
  const systems = getSystems();
  if (systems.length === 0) {
    return [
      '## Design system status',
      '',
      '> No DSDS files are configured for this server (`DSDS_PATHS` is not set).',
      '> The steps above describe what to do once files are loaded.',
      '> Spec tools (`dsds_spec_overview`, `dsds_spec_scaffold`, `dsds_validate`) are available without configuration.',
    ].join('\n');
  }

  const summaries = getSummaries();
  const deprecated = summaries.filter(e => e.status === 'deprecated');
  const experimental = summaries.filter(e => e.status === 'experimental');
  const draft = summaries.filter(e => e.status === 'draft');

  const byKind = {};
  for (const s of summaries) {
    byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  }

  const lines = [
    '## Design system status',
    '',
    `**${summaries.length} entities loaded** across ${systems.length} file${systems.length !== 1 ? 's' : ''}`,
    '',
    Object.entries(byKind)
      .map(([kind, count]) => `- ${count} ${kind}${count !== 1 ? 's' : ''}`)
      .join('\n'),
  ];

  if (deprecated.length > 0) {
    lines.push(
      '',
      `### ⚠ ${deprecated.length} deprecated — do not use`,
      '',
      deprecated.map(e => `- \`${e.identifier}\`${e.summary ? ` — ${e.summary}` : ''}`).join('\n'),
    );
  }

  if (experimental.length > 0) {
    lines.push(
      '',
      `### Experimental (${experimental.length}) — use with caution`,
      '',
      experimental.map(e => `- \`${e.identifier}\``).join('\n'),
    );
  }

  if (draft.length > 0) {
    lines.push(
      '',
      `### Draft (${draft.length}) — not ready for production`,
      '',
      draft.map(e => `- \`${e.identifier}\``).join('\n'),
    );
  }

  return lines.join('\n');
}
