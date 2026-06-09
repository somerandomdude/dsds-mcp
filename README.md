# dsds-mcp

An MCP server for the [Design System Documentation Spec (DSDS)](https://designsystemdocspec.org). Exposes DSDS tooling to any MCP-compatible client (Claude Desktop, Cursor, etc.).

Two use cases:
- **Authoring** — help a team document their design system in DSDS format
- **Consumption** — let agents query an existing DSDS document to build with the design system

The DSDS spec is bundled at the version listed below. The server checks for updates on startup and surfaces a notice in tool responses when a newer version is available.

**Bundled spec version:** 0.5.1

---

## Requirements

- Node.js 18 or later
- An MCP-compatible client

---

## Setup

### Option 1: npx (no install required)

```json
{
  "mcpServers": {
    "dsds": {
      "command": "npx",
      "args": ["dsds-mcp"]
    }
  }
}
```

### Option 2: Clone and run locally

```bash
git clone https://github.com/somerandomdude/dsds-mcp.git
cd dsds-mcp
npm install
```

Then point your MCP client at the local path:

```json
{
  "mcpServers": {
    "dsds": {
      "command": "node",
      "args": ["/absolute/path/to/dsds-mcp/src/index.js"]
    }
  }
}
```

---

## Configuration

Configuration is done via environment variables passed through your MCP client config.

| Variable | Required | Description |
|----------|----------|-------------|
| `DSDS_PATHS` | No | Comma-separated paths to your DSDS file(s). Required for design system access tools. |
| `DSDS_INTRO_PATH` | No | Path to a single DSDS file loaded as the design system introduction. Its content is prepended to the server instructions and exposed as a `dsds-intro` prompt. |
| `DSDS_SCHEMA_VERSION` | No | Override the spec version string. Defaults to `0.5.1`. |

### Pointing at your design system

```json
{
  "mcpServers": {
    "dsds": {
      "command": "npx",
      "args": ["dsds-mcp"],
      "env": {
        "DSDS_PATHS": "/path/to/my-design-system.dsds.json"
      }
    }
  }
}
```

Multiple files:

```json
"DSDS_PATHS": "/path/to/components.dsds.json,/path/to/tokens.dsds.json"
```

### Loading an intro file on startup

`DSDS_INTRO_PATH` loads a single DSDS file when the server starts. The entity's content is injected into the MCP server instructions so agents see it before any tool call. It also registers a `dsds-intro` prompt that clients can retrieve on demand.

Use this for a top-level system overview, a getting-started guide, or any entity you want agents to have as immediate context.

```json
{
  "mcpServers": {
    "dsds": {
      "command": "npx",
      "args": ["dsds-mcp"],
      "env": {
        "DSDS_PATHS": "/path/to/my-design-system.dsds.json",
        "DSDS_INTRO_PATH": "/path/to/my-design-system.dsds.json"
      }
    }
  }
}
```

`DSDS_INTRO_PATH` can point to any file already listed in `DSDS_PATHS`, or to a separate overview document not included in the main file set.

### Where to put this config

- **Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- **Cursor** — `.cursor/mcp.json` in your project root, or `~/.cursor/mcp.json` globally

---

## Tools

### Spec tools — always available, no configuration needed

These help a team author DSDS-compliant documentation.

| Tool | Description |
|------|-------------|
| `dsds_context_brief` | **Start here.** A structured briefing for the current use case — `"author"` (documenting a design system) or `"build"` (implementing UI with it). Call this before any other tool. |
| `dsds_spec_overview` | Overview of DSDS: entity types, structure, and authoring workflow |
| `dsds_spec_entity_schema` | Full field definitions for a given entity kind (`component`, `token`, `theme`, etc.) |
| `dsds_spec_document_blocks` | Document block types valid for an entity kind, with descriptions |
| `dsds_spec_scaffold` | Minimal valid DSDS JSON template for an entity kind. Use `kind="system"` for a multi-entity document |
| `dsds_validate` | Validate a DSDS JSON string against the bundled schema |

**Authoring workflow:**
```
dsds_context_brief(useCase="author") → dsds_spec_entity_schema → dsds_spec_scaffold → dsds_spec_document_blocks → dsds_validate
```

### Design system tools — require `DSDS_PATHS`

These let agents query an existing DSDS document.

| Tool | Description |
|------|-------------|
| `dsds_context_brief` | **Start here.** Use `useCase="build"` to get a briefing that includes what entities are loaded and how to query them. |
| `dsds_list_entities` | List all entities with identifier, kind, status, and summary |
| `dsds_search_entities` | Filter entities by kind, status, tags, or a text query |
| `dsds_get_entity` | Full documentation for an entity by identifier or name |
| `dsds_get_document_block` | One specific block (e.g. `api`, `accessibility`) from an entity — faster than fetching the full entity |
| `dsds_get_agent_context` | Machine-readable constraints, disambiguation, anti-patterns, and keywords for an entity. The most LLM-optimized content in a DSDS document. |

**Query workflow:**
```
dsds_context_brief(useCase="build") → dsds_list_entities → dsds_search_entities → dsds_get_agent_context or dsds_get_entity
```

---

## DSDS file format

DSDS files are JSON documents. Every file needs `dsdsVersion` and either an `entity` (single entity) or `documentation` array (multiple entities).

**Single entity:**
```json
{
  "$schema": "https://designsystemdocspec.org/v0.5.1/dsds.bundled.schema.json",
  "dsdsVersion": "0.5.1",
  "entity": {
    "kind": "component",
    "identifier": "button",
    "name": "Button",
    "metadata": [
      { "kind": "description", "value": "Triggers an action or event when activated." },
      { "kind": "status", "status": "stable" }
    ],
    "documentBlocks": []
  }
}
```

**Multi-entity:**
```json
{
  "$schema": "https://designsystemdocspec.org/v0.5.1/dsds.bundled.schema.json",
  "dsdsVersion": "0.5.1",
  "systemInfo": { "systemName": "My Design System" },
  "documentation": [
    {
      "name": "Components",
      "components": []
    }
  ]
}
```

Use `dsds_spec_scaffold` to generate ready-to-fill templates, and `dsds_validate` to check them. Full spec: [designsystemdocspec.org](https://designsystemdocspec.org).

---

## Development

```bash
npm install
npm test             # run tests once
npm run test:watch   # watch mode
npm run dev          # run the server directly (reads env vars from shell)
npm run update-schema  # fetch the latest published DSDS schema from designsystemdocspec.org
```

The spec schema is bundled at `src/spec/dsds.bundled.schema.json`. Run `npm run update-schema` to pull the latest published version automatically. It fetches the schema from `https://designsystemdocspec.org/v{version}/dsds.bundled.schema.json` and updates `BUNDLED_VERSION` in `src/spec/version.js`. The MCP server loads the schema once at startup via `require()`, so restart the server after updating.
