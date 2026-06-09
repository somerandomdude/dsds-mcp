// Static spec knowledge derived from the DSDS 0.5.1 schema.
// Used by spec tools to describe entities and document blocks without parsing the full schema at runtime.

export const ENTITY_KINDS = ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'];

export const ENTITY_DESCRIPTIONS = {
  component: {
    summary: 'Reusable UI element (e.g. Button, Modal, Input).',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['metadata', 'documentBlocks', 'agents', '$extensions'],
    notes: 'The workhorse entity. Use documentBlocks to document anatomy, API, variants, states, accessibility, etc.',
  },
  guide: {
    summary: 'Long-form, reading-oriented documentation: getting-started guides, tutorials, conceptual overviews, migration guides, and contribution docs.',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['metadata', 'documentBlocks', 'agents', '$extensions'],
    notes: 'Use section and steps blocks for narrative and procedural content. Guide category values: getting-started, tutorial, concept, migration, contribution.',
  },
  pattern: {
    summary: 'A multi-component solution for a recurring user need (e.g. Error Messaging, Empty State).',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['metadata', 'documentBlocks', 'agents', '$extensions'],
    notes: 'Patterns describe composition and interaction flows across components, not individual component behavior.',
  },
  foundation: {
    summary: 'A macro-level visual domain such as color, typography, spacing, or motion.',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['metadata', 'documentBlocks', 'agents', '$extensions'],
    notes: 'Use scale and principles blocks to document the rules and values that govern the foundation domain. Use section blocks for free-form narrative prose — overviews, rationale, FAQs — that structured block kinds do not capture.',
  },
  theme: {
    summary: 'A named set of token overrides for a specific context (e.g. dark mode, high-contrast, brand variant).',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['source', 'overrides', 'metadata', 'documentBlocks', 'agents', '$extensions'],
    notes: 'Themes layer on top of base tokens. Use overrides to map token identifiers to new values.',
  },
  token: {
    summary: 'An individual design value — color, spacing, typography, etc.',
    required: ['kind', 'identifier', 'tokenType'],
    optionalTop: ['source', 'metadata', 'documentBlocks', 'agents', '$extensions'],
    notes: 'tokenType must be one of: color, dimension, fontFamily, fontWeight, fontStyle, duration, cubicBezier, number, string. DSDS documents the *why* of a token, not the value itself — use the W3C Design Tokens Format for values.',
  },
  'token-group': {
    summary: 'A hierarchical collection of related tokens (e.g. a color palette, a spacing scale).',
    required: ['kind', 'identifier'],
    optionalTop: ['tokenType', 'source', 'children', 'metadata', 'documentBlocks', 'agents', '$extensions'],
    notes: 'children is an array of token or token-group entities. tokenType can be set at the group level and inherited by children.',
  },
};

export const DOCUMENT_BLOCK_DESCRIPTIONS = {
  section: {
    summary: 'Narrative prose organized into titled, optionally nested sections. Each section has a title, body (markdown), optional examples, and optional nested sections. Use for free-form content the structured block kinds do not capture — overviews, rationale, background, decision history, FAQs.',
    validFor: ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'],
  },
  steps: {
    summary: 'An ordered or unordered procedure. Each step has a title, optional instruction, optional expected result, and an optional flag.',
    validFor: ['guide'],
  },
  guideline: {
    summary: 'Actionable usage rules. Each item has `guidance` (the rule text) and `level` (RFC 2119: MUST, MUST_NOT, SHOULD, SHOULD_NOT). Optional: `rationale`, `category`, `target`, `criteria`, `tags`, `examples`.',
    validFor: ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'],
  },
  purpose: {
    summary: 'When-to-use and when-not-to-use scenarios. Each useCase has a `stance` ("recommended" or "discouraged") and an optional `alternative: { identifier, rationale }` for discouraged cases.',
    validFor: ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'],
  },
  accessibility: {
    summary: 'WCAG compliance notes, keyboard behavior, ARIA attributes, and contrast ratios.',
    validFor: ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'],
  },
  content: {
    summary: 'Copywriting rules, localization guidance, and label conventions.',
    validFor: ['component', 'guide', 'pattern', 'foundation', 'theme', 'token', 'token-group'],
  },
  anatomy: {
    summary: 'Named structural parts of the entity and their token mappings.',
    validFor: ['component', 'pattern'],
  },
  api: {
    summary: 'Properties, events, slots, CSS custom properties, CSS parts, and data attributes.',
    validFor: ['component'],
  },
  events: {
    summary: 'DOM or custom events the entity emits, with payload shapes.',
    validFor: ['component', 'pattern'],
  },
  variants: {
    summary: 'Discrete option axes (e.g. emphasis: primary | secondary | ghost; size: sm | md | lg).',
    validFor: ['component', 'pattern'],
  },
  states: {
    summary: 'Interactive states and their visual/behavioral overrides (hover, focus, disabled, loading, etc.).',
    validFor: ['component', 'pattern'],
  },
  'design-specifications': {
    summary: 'Concrete measurements — spacing, sizing, typography — mapped to tokens or raw CSS values.',
    validFor: ['component'],
  },
  import: {
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

// Which block types are valid per entity kind
export const VALID_BLOCKS_BY_KIND = {
  component: ['import', 'anatomy', 'api', 'events', 'variants', 'states', 'design-specifications', 'guideline', 'purpose', 'accessibility', 'content'],
  guide: ['section', 'steps', 'import', 'guideline', 'purpose', 'accessibility', 'content'],
  pattern: ['interactions', 'anatomy', 'variants', 'states', 'events', 'guideline', 'purpose', 'accessibility', 'content', 'section'],
  foundation: ['principles', 'scale', 'motion', 'guideline', 'purpose', 'accessibility', 'content', 'section'],
  theme: ['guideline', 'purpose', 'accessibility', 'content'],
  token: ['guideline', 'purpose', 'accessibility', 'content'],
  'token-group': ['guideline', 'purpose', 'accessibility', 'content'],
};

export const METADATA_FIELDS = {
  description: 'Full description of the entity. Accepts a string (markdown) or { value, format } object.',
  summary: 'One-sentence summary shown in listings and search results.',
  status: '"draft" | "experimental" | "stable" | "deprecated". Can also be an object: { overall, platforms: { react: { status, since }, ... } }.',
  tags: 'Array of strings for categorization and search filtering.',
  category: 'Grouping category within the design system.',
  since: 'Version string when this entity was introduced.',
  'last-updated': 'Modification timestamp with optional change notes.',
  aliases: 'Alternative names or identifiers for this entity.',
  preview: 'Visual or interactive preview: image, video, code snippet, or URL.',
  thumbnail: 'URL or path to a thumbnail image.',
  extends: 'Inheritance declaration from a base entity in a parent system: { identifier, system?, modifications? }.',
  links: 'Typed links to external resources or internal artifacts: { kind, url?, identifier?, label?, role?, required? }. External kinds: source, design, storybook, documentation, package, repository. Relationship kinds: alternative, parent, child, related. Artifact kinds: component, token, token-group, foundation, pattern, theme.',
};

// Minimal scaffolds per entity kind
export const SCAFFOLDS = {
  component: {
    $schema: 'https://designsystemdocspec.org/v0.5.1/dsds.bundled.schema.json',
    dsdsVersion: '0.5.1',
    entity: {
      kind: 'component',
      identifier: 'my-component',
      name: 'My Component',
      metadata: [
        { kind: 'description', value: 'Describe what this component does and when to use it.' },
        { kind: 'status', status: 'stable' },
        { kind: 'tags', items: [] },
      ],
      documentBlocks: [],
    },
  },
  guide: {
    $schema: 'https://designsystemdocspec.org/v0.5.1/dsds.bundled.schema.json',
    dsdsVersion: '0.5.1',
    entity: {
      kind: 'guide',
      identifier: 'my-guide',
      name: 'My Guide',
      metadata: [
        { kind: 'description', value: 'Describe what this guide covers.' },
        { kind: 'category', value: 'concept' },
        { kind: 'status', status: 'stable' },
      ],
      documentBlocks: [],
    },
  },
  pattern: {
    $schema: 'https://designsystemdocspec.org/v0.5.1/dsds.bundled.schema.json',
    dsdsVersion: '0.5.1',
    entity: {
      kind: 'pattern',
      identifier: 'my-pattern',
      name: 'My Pattern',
      metadata: [
        { kind: 'description', value: 'Describe the user need this pattern addresses.' },
        { kind: 'status', status: 'stable' },
        { kind: 'tags', items: [] },
      ],
      documentBlocks: [],
    },
  },
  foundation: {
    $schema: 'https://designsystemdocspec.org/v0.5.1/dsds.bundled.schema.json',
    dsdsVersion: '0.5.1',
    entity: {
      kind: 'foundation',
      identifier: 'my-foundation',
      name: 'My Foundation',
      metadata: [
        { kind: 'description', value: 'Describe the visual domain this foundation governs.' },
        { kind: 'status', status: 'stable' },
      ],
      documentBlocks: [],
    },
  },
  theme: {
    $schema: 'https://designsystemdocspec.org/v0.5.1/dsds.bundled.schema.json',
    dsdsVersion: '0.5.1',
    entity: {
      kind: 'theme',
      identifier: 'my-theme',
      name: 'My Theme',
      metadata: [
        { kind: 'description', value: 'Describe the context or mode this theme is used for.' },
        { kind: 'status', status: 'stable' },
      ],
      overrides: [],
      documentBlocks: [],
    },
  },
  token: {
    $schema: 'https://designsystemdocspec.org/v0.5.1/dsds.bundled.schema.json',
    dsdsVersion: '0.5.1',
    entity: {
      kind: 'token',
      identifier: 'color-text-primary',
      tokenType: 'color',
      metadata: [
        { kind: 'description', value: 'Describe what this token represents and when to use it.' },
        { kind: 'status', status: 'stable' },
      ],
      documentBlocks: [],
    },
  },
  'token-group': {
    $schema: 'https://designsystemdocspec.org/v0.5.1/dsds.bundled.schema.json',
    dsdsVersion: '0.5.1',
    entity: {
      kind: 'token-group',
      identifier: 'color-text',
      metadata: [
        { kind: 'description', value: 'Describe the collection of tokens in this group.' },
        { kind: 'status', status: 'stable' },
      ],
      children: [],
      documentBlocks: [],
    },
  },
  system: {
    $schema: 'https://designsystemdocspec.org/v0.5.1/dsds.bundled.schema.json',
    dsdsVersion: '0.5.1',
    systemInfo: {
      systemName: 'My Design System',
      systemVersion: '1.0.0',
      organization: 'My Organization',
    },
    documentation: [
      {
        name: 'Components',
        components: [],
      },
      {
        name: 'Foundations',
        foundations: [],
      },
      {
        name: 'Guides',
        guides: [],
      },
    ],
  },
};
