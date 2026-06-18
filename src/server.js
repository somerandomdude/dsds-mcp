import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { BUNDLED_VERSION } from './spec/version.js';
import { BUILD_BRIEF, AUTHOR_BRIEF, PROMPT_META } from './briefs.js';
import { listResources, readResource } from './resources.js';

import { specOverviewDef, specOverviewHandler } from './tools/spec-overview.js';
import { specEntitySchemaDef, specEntitySchemaHandler } from './tools/spec-entity-schema.js';
import { specDocumentBlocksDef, specDocumentBlocksHandler } from './tools/spec-document-blocks.js';
import { specScaffoldDef, specScaffoldHandler } from './tools/spec-scaffold.js';
import { validateDef, validateHandler } from './tools/validate.js';
import { contextBriefDef, contextBriefHandler } from './tools/context-brief.js';
import { listEntitiesDef, listEntitiesHandler } from './tools/list-entities.js';
import { getEntityDef, getEntityHandler } from './tools/get-entity.js';
import { searchEntitiesDef, searchEntitiesHandler } from './tools/search-entities.js';
import { getDocumentBlockDef, getDocumentBlockHandler } from './tools/get-document-block.js';
import { getAgentContextDef, getAgentContextHandler } from './tools/get-agent-context.js';
import { lintCodeDef, lintCodeHandler } from './tools/lint-code.js';
import { getChunkDef, getChunkHandler } from './tools/get-chunk.js';
import { feedbackDef, feedbackHandler } from './tools/feedback.js';
import { checkExportsDef, checkExportsHandler } from './tools/check-exports.js';
import { toMarkdownDef, toMarkdownHandler } from './tools/to-markdown.js';

const BASE_INSTRUCTIONS = `
DSDS MCP — Design System Documentation Spec v${BUNDLED_VERSION}

START HERE: Call dsds_context_brief first to get a full briefing before any work begins.
- dsds_context_brief(useCase="build") — before implementing UI with the design system
- dsds_context_brief(useCase="author") — before documenting a design system in DSDS format

SPEC TOOLS — for authoring DSDS-compliant documentation (always available, no configuration needed):
- dsds_spec_overview → dsds_spec_entity_schema → dsds_spec_scaffold → dsds_spec_document_blocks → dsds_validate

DESIGN SYSTEM TOOLS — for querying an existing DSDS document (requires DSDS_PATHS to be configured):
- dsds_list_entities → dsds_search_entities → dsds_get_entity or dsds_get_document_block
- dsds_get_agent_context(identifier) — get LLM-optimized rules and constraints for a specific entity
- dsds_get_chunk(identifier) — get a pre-assembled code chunk for a common use case, along with its guidelines and use cases rendered for agent use

RESOURCES: Each design system entity is also available as a resource at dsds://entity/{identifier}.

Note: If DSDS_PATHS is not set, design system tools will return setup instructions. Spec tools always work.

LINT TOOLS — for linting code against configured ESLint plugins (requires LINT_PLUGINS to be configured):
- dsds_lint_code(files=[{code, filename}]) — lint ALL your generated files in one call (preferred)
- dsds_lint_code(code, filename?) — lint a single file
- IMPORTANT: lint every .tsx/.ts file you generate, not just the main component. Pass them all in the \`files\` array at once.

EXPORT CHECK — before importing a component, confirm it exists in the package (requires PACKAGE_EXPORT_PATHS):
- dsds_check_exports(components=["Box", "TextInput"]) — verify each name is actually exported

FEEDBACK: Before you finish your session, call dsds_feedback to rate the experience (1–5) and note what was helpful or confusing. Call it as your last tool call — before emitting any final output or files. This is required at the end of every session.
`.trim();

/**
 * Renders a DSDS entity to a markdown string suitable for agent instructions.
 * Handles section, steps, guideline, and purpose document blocks.
 */
function renderIntroEntity(entity) {
  if (!entity) return null;

  const lines = [];

  const name = entity.name ?? entity.identifier;
  lines.push(`---`, '', `## ${name}`, '');

  if (Array.isArray(entity.metadata)) {
    const desc = entity.metadata.find(m => m.kind === 'description');
    if (desc?.value) lines.push(desc.value, '');
  }

  if (entity.agents?.intent) {
    lines.push(entity.agents.intent, '');
  }

  for (const block of (entity.documentBlocks ?? [])) {
    if (block.kind === 'section') {
      for (const item of (block.items ?? [])) renderSectionItem(item, 3, lines);
    } else if (block.kind === 'steps') {
      if (block.title) lines.push(`### ${block.title}`, '');
      const ordered = block.ordered !== false;
      (block.items ?? []).forEach((step, i) => {
        lines.push(`${ordered ? `${i + 1}.` : '-'} **${step.title}**`);
        if (step.instruction) lines.push(`   ${step.instruction}`);
      });
      lines.push('');
    } else if (block.kind === 'guideline') {
      lines.push('### Guidelines', '');
      for (const item of (block.items ?? [])) {
        // 0.5+: item.level (MUST/MUST_NOT/SHOULD/SHOULD_NOT); fallback for pre-0.5 item.kind
        const level = item.level ?? (item.kind === 'required' ? 'MUST' : item.kind === 'prohibited' ? 'MUST_NOT' : null);
        const label = level === 'MUST' ? 'Must' : level === 'MUST_NOT' ? 'Must not' : level === 'SHOULD' ? 'Should' : level === 'SHOULD_NOT' ? 'Should not' : 'Note';
        const rationale = item.rationale ? ` — ${item.rationale}` : '';
        lines.push(`- **${label}:** ${item.guidance}${rationale}`);
      }
      lines.push('');
    } else if (block.kind === 'purpose') {
      const positive = (block.useCases ?? []).filter(u => u.stance === 'recommended' || u.kind === 'positive');
      const negative = (block.useCases ?? []).filter(u => u.stance === 'discouraged' || u.kind === 'negative');
      if (positive.length > 0) {
        lines.push('### When to use', '');
        for (const u of positive) lines.push(`- ${u.description}`);
        lines.push('');
      }
      if (negative.length > 0) {
        lines.push('### When not to use', '');
        for (const u of negative) lines.push(`- ${u.description}`);
        lines.push('');
      }
    }
  }

  // Render agentDocumentBlocks — these are the LLM-optimized rules and constraints.
  for (const block of (entity.agentDocumentBlocks ?? [])) {
    if (block.kind === 'guidelines') {
      lines.push('### Rules', '');
      for (const item of (block.items ?? [])) {
        const level = item.level ?? 'note';
        const label = level === 'must' ? 'Must' : level === 'must-not' ? 'Must not' : level === 'should' ? 'Should' : level === 'should-not' ? 'Should not' : 'Note';
        lines.push(`- **${label}:** ${item.guidance}`);
        if (item.rationale) lines.push(`  - ${item.rationale}`);
      }
      lines.push('');
    } else if (block.kind === 'sections') {
      for (const item of (block.items ?? [])) renderSectionItem(item, 3, lines);
    } else if (block.kind === 'useCases') {
      const positive = (block.items ?? []).filter(u => u.stance === 'recommended');
      const negative = (block.items ?? []).filter(u => u.stance === 'discouraged');
      if (positive.length > 0) {
        lines.push('### When to use', '');
        for (const u of positive) lines.push(`- ${u.description}`);
        lines.push('');
      }
      if (negative.length > 0) {
        lines.push('### When not to use', '');
        for (const u of negative) {
          let line = `- ${u.description}`;
          if (u.alternative?.identifier) line += ` → use \`${u.alternative.identifier}\` instead`;
          lines.push(line);
        }
        lines.push('');
      }
    }
  }

  if (Array.isArray(entity.agents?.constraints) && entity.agents.constraints.length > 0) {
    lines.push('### Rules', '');
    for (const c of entity.agents.constraints) {
      lines.push(`- **${c.level.toUpperCase()}:** ${c.rule}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function renderSectionItem(item, depth, lines) {
  lines.push(`${'#'.repeat(depth)} ${item.title}`, '');
  if (item.body) lines.push(item.body, '');
  for (const sub of (item.sections ?? [])) renderSectionItem(sub, depth + 1, lines);
}

function validateArgs(toolDef, args) {
  const { required = [], properties = {} } = toolDef.inputSchema ?? {};

  for (const field of required) {
    if (args[field] === undefined || args[field] === null) {
      return `Missing required argument: "${field}"`;
    }
  }

  for (const [field, value] of Object.entries(args)) {
    const prop = properties[field];
    if (!prop) continue;
    if (prop.type === 'string' && typeof value !== 'string') {
      return `Argument "${field}" must be a string, got ${typeof value}`;
    }
    if (prop.type === 'array' && !Array.isArray(value)) {
      return `Argument "${field}" must be an array, got ${typeof value}`;
    }
    if (prop.enum && !prop.enum.includes(value)) {
      return `Argument "${field}" must be one of: ${prop.enum.join(', ')}`;
    }
  }

  return null;
}

function errorResponse(message) {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

function promptMessage(text) {
  return { role: 'user', content: { type: 'text', text } };
}

export function createServer(getSystems, getSummaries, introEntities = [], getLintConfig = null, getExportPaths = null, feedbackDir = null, logsDir = null) {
  const introTexts = introEntities.map(renderIntroEntity).filter(Boolean);
  const INSTRUCTIONS = introTexts.length > 0
    ? `${BASE_INSTRUCTIONS}\n\n${introTexts.join('\n\n')}`
    : BASE_INSTRUCTIONS;

  const server = new Server(
    { name: 'dsds-mcp', version: '0.1.0' },
    { capabilities: { tools: {}, prompts: {}, resources: {} }, instructions: INSTRUCTIONS }
  );

  // ── Tools ──────────────────────────────────────────────────────────────────

  const toolDefs = [
    contextBriefDef,
    specOverviewDef,
    specEntitySchemaDef,
    specDocumentBlocksDef,
    specScaffoldDef,
    validateDef,
    listEntitiesDef,
    getEntityDef,
    searchEntitiesDef,
    getDocumentBlockDef,
    getAgentContextDef,
    getChunkDef,
    lintCodeDef,
    checkExportsDef,
    toMarkdownDef,
    feedbackDef,
  ];

  const toolMap = new Map(toolDefs.map(t => [t.name, t]));

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefs }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    const toolDef = toolMap.get(name);
    if (!toolDef) return errorResponse(`Unknown tool: "${name}"`);

    const validationError = validateArgs(toolDef, args);
    if (validationError) return errorResponse(validationError);

    try {
      switch (name) {
        case 'dsds_context_brief':        return contextBriefHandler(args, getSystems, getSummaries);
        case 'dsds_spec_overview':        return specOverviewHandler(args);
        case 'dsds_spec_entity_schema':   return specEntitySchemaHandler(args);
        case 'dsds_spec_document_blocks': return specDocumentBlocksHandler(args);
        case 'dsds_spec_scaffold':        return specScaffoldHandler(args);
        case 'dsds_validate':             return validateHandler(args);
        case 'dsds_list_entities':        return listEntitiesHandler(args, getSystems, getSummaries);
        case 'dsds_get_entity':           return getEntityHandler(args, getSystems, getSummaries);
        case 'dsds_search_entities':      return searchEntitiesHandler(args, getSystems, getSummaries);
        case 'dsds_get_document_block':   return getDocumentBlockHandler(args, getSystems);
        case 'dsds_get_agent_context':    return getAgentContextHandler(args, getSystems);
        case 'dsds_get_chunk':            return getChunkHandler(args, getSystems, logsDir);
        case 'dsds_lint_code':            return lintCodeHandler(args, getLintConfig ?? (() => ({ plugins: [], resolveDir: process.cwd() })), logsDir);
        case 'dsds_check_exports':        return checkExportsHandler(args, getExportPaths ?? (() => new Map()));
        case 'dsds_to_markdown':          return toMarkdownHandler(args, getSystems);
        case 'dsds_feedback':             return feedbackHandler(args, feedbackDir);
        default:                          return errorResponse(`Unknown tool: "${name}"`);
      }
    } catch (err) {
      return errorResponse(`Tool error: ${err.message}`);
    }
  });

  // ── Prompts ────────────────────────────────────────────────────────────────

  const prompts = [
    {
      name: PROMPT_META.build.name,
      description: PROMPT_META.build.description,
      arguments: [{ name: 'task', description: PROMPT_META.build.taskArgDescription, required: false }],
    },
    {
      name: PROMPT_META.author.name,
      description: PROMPT_META.author.description,
      arguments: [{ name: 'task', description: PROMPT_META.author.taskArgDescription, required: false }],
    },
  ];

  if (introEntities.length > 0) {
    const introNames = introEntities.map(e => e.name ?? e.identifier).join(', ');
    prompts.push({
      name: 'dsds-intro',
      description: `${introNames} — retrieve the design system introduction${introEntities.length > 1 ? 's' : ''} loaded on server start.`,
      arguments: [],
    });
  }

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const task = args.task ?? null;

    if (name === PROMPT_META.build.name) {
      const lines = [];
      if (task) lines.push(`## Your task: ${task}`, '');
      lines.push(BUILD_BRIEF);
      return { messages: [promptMessage(lines.join('\n'))] };
    }

    if (name === PROMPT_META.author.name) {
      const lines = [];
      if (task) lines.push(`## Your task: ${task}`, '');
      lines.push(AUTHOR_BRIEF);
      return { messages: [promptMessage(lines.join('\n'))] };
    }

    if (name === 'dsds-intro') {
      if (introEntities.length === 0) throw new Error('No intro entities configured. Set the DSDS_INTRO_PATHS environment variable.');
      const text = introEntities.map(renderIntroEntity).filter(Boolean).join('\n\n');
      return { messages: [promptMessage(text)] };
    }

    throw new Error(`Unknown prompt: "${name}"`);
  });

  // ── Resources ──────────────────────────────────────────────────────────────

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listResources(getSummaries),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const content = readResource(uri, getSystems);

    if (!content) {
      throw new Error(`Resource not found: ${uri}`);
    }

    return { contents: [content] };
  });

  return server;
}
