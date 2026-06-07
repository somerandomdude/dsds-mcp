// Static spec knowledge derived from the DSDS 0.2.1 schema.
// Used by spec tools to describe entities and document blocks without parsing the full schema at runtime.

export const ENTITY_KINDS = ['component', 'pattern', 'style', 'theme', 'token', 'token-group'];

export const ENTITY_DESCRIPTIONS = {
  component: {
    summary: 'Reusable UI element (e.g. Button, Modal, Input).',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['metadata', 'documentBlocks', 'agents', '$extensions'],
    notes: 'The workhorse entity. Use documentBlocks to document anatomy, API, variants, states, accessibility, etc.',
  },
  pattern: {
    summary: 'A multi-component solution for a recurring user need (e.g. Error Messaging, Empty State).',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['metadata', 'documentBlocks', 'agents', '$extensions'],
    notes: 'Patterns describe composition and interaction flows across components, not individual component behavior.',
  },
  style: {
    summary: 'A macro-level visual domain such as color, typography, spacing, or motion.',
    required: ['kind', 'identifier', 'name'],
    optionalTop: ['metadata', 'documentBlocks', 'agents', '$extensions'],
    notes: 'Use scale and principles blocks to document the rules and values that govern the style domain.',
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
  guideline: {
    summary: 'Actionable design or usage rules with an enforcement level (must, should, avoid, never).',
    validFor: ['component', 'pattern', 'style', 'theme', 'token', 'token-group'],
  },
  purpose: {
    summary: 'When-to-use and when-not-to-use scenarios for the entity.',
    validFor: ['component', 'pattern', 'style', 'theme', 'token', 'token-group'],
  },
  accessibility: {
    summary: 'WCAG compliance notes, keyboard behavior, ARIA attributes, and contrast ratios.',
    validFor: ['component', 'pattern', 'style', 'theme', 'token', 'token-group'],
  },
  content: {
    summary: 'Copywriting rules, localization guidance, and label conventions.',
    validFor: ['component', 'pattern', 'style', 'theme', 'token', 'token-group'],
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
    validFor: ['component'],
  },
  interactions: {
    summary: 'Step-by-step interaction flows describing how a user moves through the pattern.',
    validFor: ['pattern'],
  },
  principles: {
    summary: 'High-level rationale and rules governing the style domain.',
    validFor: ['style'],
  },
  scale: {
    summary: 'The discrete steps in a scale system (spacing scale, type scale, etc.).',
    validFor: ['style'],
  },
  motion: {
    summary: 'Duration and easing curves that govern animation within this style domain.',
    validFor: ['style'],
  },
};

// Which block types are valid per entity kind
export const VALID_BLOCKS_BY_KIND = {
  component: ['import', 'anatomy', 'api', 'events', 'variants', 'states', 'design-specifications', 'guideline', 'purpose', 'accessibility', 'content'],
  pattern: ['interactions', 'anatomy', 'variants', 'states', 'events', 'guideline', 'purpose', 'accessibility', 'content'],
  style: ['principles', 'scale', 'motion', 'guideline', 'purpose', 'accessibility', 'content'],
  theme: ['guideline', 'purpose', 'accessibility', 'content'],
  token: ['guideline', 'purpose', 'accessibility', 'content'],
  'token-group': ['guideline', 'purpose', 'accessibility', 'content'],
};

export const METADATA_FIELDS = {
  description: 'Full description of the entity. Accepts a string (markdown) or { value, format } object.',
  summary: 'One-sentence summary shown in listings and search results.',
  status: '"draft" | "experimental" | "stable" | "deprecated". Can also be an object with per-platform values.',
  tags: 'Array of strings for categorization and search filtering.',
  category: 'Grouping category within the design system.',
  since: 'Version string when this entity was introduced.',
  aliases: 'Alternative names or identifiers for this entity.',
  preview: 'URL or path to a preview image or live demo.',
  thumbnail: 'URL or path to a thumbnail image.',
  links: 'Array of typed links: { kind, url, label }. Kinds: source, design, documentation, parent, child, related.',
};

// Minimal scaffolds per entity kind
export const SCAFFOLDS = {
  component: {
    $schema: 'https://designsystemdocspec.org/v0.2.1/dsds.bundled.schema.json',
    dsdsVersion: '0.2.1',
    entity: {
      kind: 'component',
      identifier: 'my-component',
      name: 'My Component',
      metadata: {
        description: 'Describe what this component does and when to use it.',
        status: 'stable',
        tags: [],
      },
      documentBlocks: [],
    },
  },
  pattern: {
    $schema: 'https://designsystemdocspec.org/v0.2.1/dsds.bundled.schema.json',
    dsdsVersion: '0.2.1',
    entity: {
      kind: 'pattern',
      identifier: 'my-pattern',
      name: 'My Pattern',
      metadata: {
        description: 'Describe the user need this pattern addresses.',
        status: 'stable',
        tags: [],
      },
      documentBlocks: [],
    },
  },
  style: {
    $schema: 'https://designsystemdocspec.org/v0.2.1/dsds.bundled.schema.json',
    dsdsVersion: '0.2.1',
    entity: {
      kind: 'style',
      identifier: 'my-style',
      name: 'My Style',
      metadata: {
        description: 'Describe the visual domain this style governs.',
        status: 'stable',
      },
      documentBlocks: [],
    },
  },
  theme: {
    $schema: 'https://designsystemdocspec.org/v0.2.1/dsds.bundled.schema.json',
    dsdsVersion: '0.2.1',
    entity: {
      kind: 'theme',
      identifier: 'my-theme',
      name: 'My Theme',
      metadata: {
        description: 'Describe the context or mode this theme is used for.',
        status: 'stable',
      },
      overrides: [],
      documentBlocks: [],
    },
  },
  token: {
    $schema: 'https://designsystemdocspec.org/v0.2.1/dsds.bundled.schema.json',
    dsdsVersion: '0.2.1',
    entity: {
      kind: 'token',
      identifier: 'color-text-primary',
      tokenType: 'color',
      metadata: {
        description: 'Describe what this token represents and when to use it.',
        status: 'stable',
      },
      documentBlocks: [],
    },
  },
  'token-group': {
    $schema: 'https://designsystemdocspec.org/v0.2.1/dsds.bundled.schema.json',
    dsdsVersion: '0.2.1',
    entity: {
      kind: 'token-group',
      identifier: 'color-text',
      metadata: {
        description: 'Describe the collection of tokens in this group.',
        status: 'stable',
      },
      children: [],
      documentBlocks: [],
    },
  },
  system: {
    $schema: 'https://designsystemdocspec.org/v0.2.1/dsds.bundled.schema.json',
    dsdsVersion: '0.2.1',
    systemMetadata: {
      name: 'My Design System',
      version: '1.0.0',
      organization: 'My Organization',
    },
    documentation: [
      {
        name: 'Components',
        components: [],
      },
    ],
  },
};
