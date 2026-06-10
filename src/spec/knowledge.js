// Static spec knowledge derived from the DSDS 0.7 schema.
// Used by spec tools to describe entities and document blocks without parsing the full schema at runtime.

export const ENTITY_KINDS = ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'];

export const ENTITY_DESCRIPTIONS = {
  component: {
    summary: 'Reusable UI element (e.g. Button, Modal, Input).',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['description', 'metadata', 'documentBlocks', 'agentDocumentBlocks', '$extensions'],
    notes: 'The workhorse entity. Use documentBlocks to document anatomy, API, variants, states, accessibility, etc. Use agentDocumentBlocks for agent-only guidance (same block kinds, never rendered for humans).',
  },
  guide: {
    summary: 'Long-form, reading-oriented documentation: getting-started guides, tutorials, conceptual overviews, migration guides, and contribution docs.',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['description', 'metadata', 'documentBlocks', 'agentDocumentBlocks', '$extensions'],
    notes: 'Use sections and steps blocks for narrative and procedural content. Guide category values: getting-started, tutorial, concept, migration, contribution.',
  },
  pattern: {
    summary: 'A multi-component solution for a recurring user need (e.g. Error Messaging, Empty State).',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['description', 'metadata', 'documentBlocks', 'agentDocumentBlocks', '$extensions'],
    notes: 'Patterns describe composition and interaction flows across components, not individual component behavior.',
  },
  foundation: {
    summary: 'A macro-level visual domain such as color, typography, spacing, or motion.',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['description', 'metadata', 'documentBlocks', 'agentDocumentBlocks', '$extensions'],
    notes: 'Use scale and principles blocks to document the rules and values that govern the foundation domain. Use sections blocks for free-form narrative prose — overviews, rationale, FAQs — that structured block kinds do not capture.',
  },
  theme: {
    summary: 'A named set of token overrides for a specific context (e.g. dark mode, high-contrast, brand variant).',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['description', 'source', 'overrides', 'metadata', 'documentBlocks', 'agentDocumentBlocks', '$extensions'],
    notes: 'Themes layer on top of base tokens. Use overrides to map token identifiers to new values.',
  },
  token: {
    summary: 'An individual design value — color, spacing, typography, etc.',
    required: ['kind', 'identifier', 'tokenType'],
    optionalTop: ['description', 'source', 'metadata', 'documentBlocks', 'agentDocumentBlocks', '$extensions'],
    notes: 'tokenType must be one of: color, dimension, fontFamily, fontWeight, fontStyle, duration, cubicBezier, number, string. DSDS documents the *why* of a token, not the value itself — use the W3C Design Tokens Format for values.',
  },
  'token-group': {
    summary: 'A hierarchical collection of related tokens (e.g. a color palette, a spacing scale).',
    required: ['kind', 'identifier'],
    optionalTop: ['description', 'tokenType', 'source', 'children', 'metadata', 'documentBlocks', 'agentDocumentBlocks', '$extensions'],
    notes: 'children is an array of token or token-group entities. tokenType can be set at the group level and inherited by children.',
  },
};

export const DOCUMENT_BLOCK_DESCRIPTIONS = {
  sections: {
    summary: 'Narrative prose organized into titled, optionally nested sections. Each section has a title, body (markdown), optional examples, and optional nested sections. Use for free-form content the structured block kinds do not capture — overviews, rationale, background, decision history, FAQs.',
    validFor: ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'],
  },
  steps: {
    summary: 'An ordered or unordered procedure. Each step has a title, optional instruction, optional expected result, and an optional flag.',
    validFor: ['guide'],
  },
  guidelines: {
    summary: 'Actionable usage rules. Each item has `guidance` (the rule text) and `level` (RFC 2119: MUST, MUST_NOT, SHOULD, SHOULD_NOT). Optional: `rationale`, `evidence` (empirical backing), `category`, `target`, `criteria` (testable success criteria: identifier + verifiable statement), `references` (external standards like WCAG), `tags`, `examples`.',
    validFor: ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'],
  },
  useCases: {
    summary: 'When-to-use and when-not-to-use scenarios. Optional `purpose` is the umbrella statement; each item in `items` has a `stance` ("recommended" or "discouraged") and an optional `alternative: { identifier, rationale }` for discouraged cases.',
    validFor: ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'],
  },
  accessibility: {
    summary: 'WCAG compliance notes, keyboard behavior, ARIA attributes, contrast ratios, and optional testable `criteria`.',
    validFor: ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'],
  },
  content: {
    summary: 'Copywriting rules, localization guidance, and label conventions.',
    validFor: ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'],
  },
  anatomy: {
    summary: 'Named structural parts of the entity and their token mappings, with optional annotated examples.',
    validFor: ['component', 'pattern'],
  },
  api: {
    summary: 'Properties, events, slots, CSS custom properties, CSS parts, and data attributes. At least one of those arrays is required.',
    validFor: ['component'],
  },
  variants: {
    summary: 'Discrete option axes (e.g. emphasis: primary | secondary | ghost; size: sm | md | lg). Each value can carry a `rationale` and `examples`.',
    validFor: ['component', 'pattern'],
  },
  states: {
    summary: 'Interactive states and their visual/behavioral overrides (hover, focus, disabled, loading, etc.). Each state can carry a `rationale` and `examples`.',
    validFor: ['component', 'pattern'],
  },
  'design-specifications': {
    summary: 'Concrete measurements — spacing, sizing, typography — mapped to tokens or raw CSS values.',
    validFor: ['component'],
  },
  imports: {
    summary: 'Package import paths and framework-specific usage snippets.',
    validFor: ['component', 'guide'],
  },
  interactions: {
    summary: 'Step-by-step interaction flows describing how a user moves through the pattern.',
    validFor: ['pattern'],
  },
  principles: {
    summary: 'High-level rationale and rules governing the foundation domain.',
    validFor: ['foundation'],
  },
  scale: {
    summary: 'The discrete steps in a scale system (spacing scale, type scale, etc.).',
    validFor: ['foundation'],
  },
  motion: {
    summary: 'Duration and easing curves that govern animation within this foundation domain.',
    validFor: ['foundation'],
  },
};

// Which block types are valid per entity kind (documentBlocks AND agentDocumentBlocks)
export const VALID_BLOCKS_BY_KIND = {
  component: ['imports', 'anatomy', 'api', 'variants', 'states', 'design-specifications', 'guidelines', 'useCases', 'accessibility', 'content', 'sections'],
  guide: ['sections', 'steps', 'imports', 'guidelines', 'useCases', 'accessibility', 'content'],
  pattern: ['interactions', 'anatomy', 'variants', 'states', 'guidelines', 'useCases', 'accessibility', 'content', 'sections'],
  foundation: ['principles', 'scale', 'motion', 'guidelines', 'useCases', 'accessibility', 'content', 'sections'],
  theme: ['guidelines', 'useCases', 'accessibility', 'content', 'sections'],
  token: ['guidelines', 'useCases', 'accessibility', 'content', 'sections'],
  'token-group': ['guidelines', 'useCases', 'accessibility', 'content', 'sections'],
};

export const METADATA_FIELDS = {
  summary: 'One-sentence plain-text summary shown in listings and search results.',
  status: '"draft" | "experimental" | "stable" | "deprecated" (string shorthand). Object form for detail: { overall, platforms: { react: { status, since }, ... }, deprecationNotice }.',
  tags: 'Array of strings for categorization and search filtering.',
  category: 'Grouping category within the design system (lowercase kebab-case).',
  since: 'Version string when this entity was introduced.',
  lastUpdated: 'ISO date string shorthand, or { date, note } for a change note.',
  aliases: 'Alternative names or identifiers for this entity.',
  preview: 'Visual or interactive preview: a presentation object (image, video, code snippet, or URL).',
  thumbnail: '{ url, alt } — thumbnail image with required alt text.',
  extends: 'Inheritance declaration from a base entity in a parent system: { identifier, system?, modifications? }.',
  links: 'Typed links to external resources or internal artifacts: { kind, url?, identifier?, label?, role?, required? }. External kinds: source, design, storybook, documentation, package, repository. Relationship kinds: alternative, parent, child, related. Artifact kinds: component, token, token-group, foundation, pattern, theme.',
};

// NOTE: `description` is NOT metadata in v0.7 — it is a top-level entity
// property beside `identifier` and `name`.

// Minimal scaffolds per entity kind
const SCHEMA_URL = 'https://designsystemdocspec.org/v0.7/dsds.bundled.schema.json';

export const SCAFFOLDS = {
  component: {
    $schema: SCHEMA_URL,
    dsdsVersion: '0.7',
    entity: {
      kind: 'component',
      identifier: 'my-component',
      name: 'My Component',
      description: 'Describe what this component does and when to use it.',
      metadata: { status: 'stable', tags: [] },
      documentBlocks: [],
    },
  },
  guide: {
    $schema: SCHEMA_URL,
    dsdsVersion: '0.7',
    entity: {
      kind: 'guide',
      identifier: 'my-guide',
      name: 'My Guide',
      description: 'Describe what this guide covers.',
      metadata: { category: 'concept', status: 'stable' },
      documentBlocks: [],
    },
  },
  pattern: {
    $schema: SCHEMA_URL,
    dsdsVersion: '0.7',
    entity: {
      kind: 'pattern',
      identifier: 'my-pattern',
      name: 'My Pattern',
      description: 'Describe the user need this pattern addresses.',
      metadata: { status: 'stable', tags: [] },
      documentBlocks: [],
    },
  },
  foundation: {
    $schema: SCHEMA_URL,
    dsdsVersion: '0.7',
    entity: {
      kind: 'foundation',
      identifier: 'my-foundation',
      name: 'My Foundation',
      description: 'Describe the visual domain this foundation governs.',
      metadata: { status: 'stable' },
      documentBlocks: [],
    },
  },
  theme: {
    $schema: SCHEMA_URL,
    dsdsVersion: '0.7',
    entity: {
      kind: 'theme',
      identifier: 'my-theme',
      name: 'My Theme',
      description: 'Describe the context or mode this theme is used for.',
      metadata: { status: 'stable' },
      overrides: [],
      documentBlocks: [],
    },
  },
  token: {
    $schema: SCHEMA_URL,
    dsdsVersion: '0.7',
    entity: {
      kind: 'token',
      identifier: 'color-text-primary',
      tokenType: 'color',
      description: 'Describe what this token represents and when to use it.',
      metadata: { status: 'stable' },
      documentBlocks: [],
    },
  },
  'token-group': {
    $schema: SCHEMA_URL,
    dsdsVersion: '0.7',
    entity: {
      kind: 'token-group',
      identifier: 'color-text',
      description: 'Describe the collection of tokens in this group.',
      metadata: { status: 'stable' },
      children: [],
      documentBlocks: [],
    },
  },
  system: {
    $schema: SCHEMA_URL,
    dsdsVersion: '0.7',
    systemInfo: {
      systemName: 'My Design System',
      systemVersion: '1.0.0',
      organization: 'My Organization',
    },
    entityGroups: [
      {
        name: 'My Design System',
        entities: [],
      },
    ],
  },
};
