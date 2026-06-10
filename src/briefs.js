// =============================================================================
// src/briefs.js
//
// Edit this file to customize the context briefs shown to agents before they
// start work. Markdown is supported throughout. The briefs appear in two
// places: the dsds_context_brief tool and the MCP prompt slash commands.
//
// BUILD_BRIEF   — shown before implementing UI with the design system
// AUTHOR_BRIEF  — shown before documenting a design system in DSDS format
// PROMPT_META   — titles and descriptions shown in MCP client UIs
// =============================================================================


// -----------------------------------------------------------------------------
// BUILD BRIEF
// Shown to agents before they write any code that uses the design system.
// Edit this to reflect what engineers most commonly get wrong, what tokens
// or patterns are easy to miss, and what non-obvious rules must be followed.
// -----------------------------------------------------------------------------

export const BUILD_BRIEF = `
## Before you build: Design System Context Briefing

Do not write implementation code until you have completed every step below.
Each step uses a tool from this MCP server — call them in order.

---

### Step 1 — Inventory what exists

Call \`dsds_list_entities\` to see every documented entity grouped by kind.

Before continuing, note:
- Any entity marked **deprecated** must not be used. Check for alternatives.
- Any entity marked **experimental** or **draft** should be used with caution.

---

### Step 2 — Find what you need

Call \`dsds_search_entities\` to narrow to the entities relevant to your task.
Filter by \`kind\`, \`status\`, \`tags\`, or a keyword \`query\`.

If you are unsure what exists, search broadly first, then narrow.

---

### Step 3 — Read the full spec for every entity you plan to use

For each entity, call \`dsds_get_entity\` and review every document block.
Do not assume — read the actual documentation.

Key blocks to check for components:
- **\`api\`** — all properties, events, slots, CSS custom properties, and data attributes
- **\`variants\`** — option axes (e.g. emphasis: primary | secondary | ghost)
- **\`states\`** — how the component behaves in hover, focus, disabled, loading, etc.
- **\`accessibility\`** — WCAG level, keyboard interactions, required ARIA attributes
- **\`guidelines\`** — enforced rules (look for \`MUST\` and \`MUST_NOT\` entries, and \`criteria\` you can check against)
- **\`imports\`** — exact package paths and framework snippets

If you only need one section, use \`dsds_get_document_block(identifier, blockType)\`
instead of fetching the full entity.

---

### Step 4 — Use tokens, not hardcoded values

Call \`dsds_search_entities\` with \`kind=token\` or \`kind=token-group\` to find
the design tokens that apply to your work.

Never hardcode color values, spacing, or type sizes. Always reference the
token identifier from the design system.

---

### Step 5 — Check for applicable patterns

Call \`dsds_search_entities\` with \`kind=pattern\` to find patterns that may
already define the interaction flow you're about to implement.

Using an existing pattern is always preferable to inventing a new one.

---

### Step 6 — Check for an applicable theme

If the design system has themes (dark mode, high-contrast, brand variants),
call \`dsds_search_entities\` with \`kind=theme\` and verify your implementation
works within those contexts.

---

Only after completing all six steps should you write code.
`.trim();


// -----------------------------------------------------------------------------
// AUTHOR BRIEF
// Shown to agents and teams before they document a design system in DSDS format.
// Edit this to reflect the most common authoring mistakes, which blocks matter
// most, and any org-specific conventions for how you structure DSDS files.
// -----------------------------------------------------------------------------

export const AUTHOR_BRIEF = `
## Before you author: DSDS Documentation Briefing

Do not start writing documentation until you have completed every step below.
Each step uses a tool from this MCP server — call them in order.

---

### Step 1 — Understand the spec

Call \`dsds_spec_overview\` to understand what DSDS is, what entity types it
defines, and how it is structured. Read the full output before continuing.

---

### Step 2 — Choose the right entity type

Identify which entity kind matches what you are documenting:

| Kind | Use when... |
|------|-------------|
| \`component\` | A reusable UI element (Button, Modal, Input, Card) |
| \`guide\` | Long-form documentation: getting-started, tutorials, concepts, contribution docs |
| \`pattern\` | A multi-component solution for a user need (empty state, error messaging) |
| \`foundation\` | A visual domain with rules and a scale (color system, type scale, spacing, motion) |
| \`theme\` | A set of token overrides for a specific context (dark, high-contrast) |
| \`token\` | An individual design value (a color, a spacing step, a duration) |
| \`token-group\` | A named collection of related tokens (color-text, spacing-scale) |

Call \`dsds_spec_entity_schema(kind)\` to see every field available for your
chosen kind, which are required, and what metadata you can provide.

---

### Step 3 — Generate a starter template

Call \`dsds_spec_scaffold(kind)\` to get a minimal valid DSDS JSON template.

If you are documenting a full design system with multiple entities, use
\`dsds_spec_scaffold('system')\` to get a multi-entity document structure.

---

### Step 4 — Plan your document blocks

Call \`dsds_spec_document_blocks(kind)\` to see which block types are valid for
your entity and what each one captures.

Prioritize the blocks that answer the questions engineers ask most:

1. **\`useCases\`** — when should I use this, and when should I not?
2. **\`api\`** — what properties, events, and slots does this expose?
3. **\`guidelines\`** — what rules must I follow when using this?
4. **\`accessibility\`** — what are the WCAG requirements and keyboard behaviors?
5. **\`variants\`** — what option axes exist?
6. **\`imports\`** — how do I import and use this in code?

---

### Step 5 — Validate as you go

After completing each section, call \`dsds_validate\` with your current JSON.
Do not wait until the end — fix errors incrementally.

---

### Step 6 — Add agent-only documentation

Once the core documentation is written, add an \`agentDocumentBlocks\` array to
the entity. It accepts the same document block kinds as \`documentBlocks\`, but
is intended for agent (AI/LLM) consumption only — tools never render it for
humans. Use it for guidance that would be noise for human readers:

- A **\`guidelines\`** block with generation constraints (\`level\`: MUST/MUST_NOT,
  optional \`evidence\` from test runs, \`criteria\` agents can self-check against)
- A **\`useCases\`** block disambiguating this entity from confusable ones
  (discouraged items with an \`alternative\`)
- A **\`sections\`** block with ready-to-use code examples

This step significantly improves agent behavior when building with the system.
`.trim();


// -----------------------------------------------------------------------------
// PROMPT_META
// Controls how prompts appear in MCP client UIs (Claude Desktop, Cursor, etc.)
// Edit the description and taskArgDescription to change what users see.
// Do not change the `name` fields without also updating server.js.
// -----------------------------------------------------------------------------

export const PROMPT_META = {
  build: {
    name: 'build-with-design-system',
    description: 'Get a full context briefing before implementing UI with this design system. Tells you exactly what to check before writing a single line of code.',
    taskArgDescription: 'What are you building? (e.g. "a login form", "a data table with sorting and pagination")',
  },
  author: {
    name: 'author-dsds-docs',
    description: 'Get a step-by-step briefing before documenting a design system in DSDS format. Covers entity types, required fields, and authoring workflow.',
    taskArgDescription: 'What are you documenting? (e.g. "a Button component", "our color token system", "the error messaging pattern")',
  },
};
