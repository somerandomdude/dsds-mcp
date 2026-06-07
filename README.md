# dsds-mcp

An MCP server for the [Design System Documentation Spec (DSDS)](https://designsystemdocspec.org). Exposes DSDS tooling to any MCP-compatible client (Claude Desktop, Cursor, etc.).

Two use cases:
- **Authoring** — help a team document their design system in DSDS format
- **Consumption** — let agents query an existing DSDS document to build with the design system

The DSDS spec is bundled at the version listed below. The server checks for updates on startup and surfaces a notice in tool responses when a newer version is available.

**Bundled spec version:** 0.2.1

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
git clone https://github.com/your-org/dsds-mcp.git
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
| `DSDS_SCHEMA_VERSION` | No | Override the spec version string. Defaults to `0.2.1`. |

### Example: pointing at your design system

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

### Where to put this config

- **Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)
- **Cursor** — `.cursor/mcp.json` in your project root, or `~/.cursor/mcp.json` globally

---

## Tools

### Spec tools — always available, no configuration needed

These help a team author DSDS-compliant documentation.

| Tool | Description |
|------|-------------|
| `dsds_spec_overview` | Overview of DSDS: entity types, structure, and authoring workflow |
| `dsds_spec_entity_schema` | Full field definitions for a given entity kind (`component`, `token`, `theme`, etc.) |
| `dsds_spec_document_blocks` | Document block types valid for an entity kind, with descriptions |
| `dsds_spec_scaffold` | Minimal valid DSDS JSON template for an entity kind. Use `kind="system"` for a multi-entity document |
| `dsds_validate` | Validate a DSDS JSON string against the bundled schema |

**Authoring workflow:**
```
dsds_spec_overview → dsds_spec_entity_schema → dsds_spec_scaffold → dsds_spec_document_blocks → dsds_validate
```

### Design system tools — require `DSDS_PATHS`

These let agents query an existing DSDS document.

| Tool | Description |
|------|-------------|
| `dsds_list_entities` | List all entities with identifier, kind, status, and summary |
| `dsds_search_entities` | Filter entities by kind, status, tags, or a text query |
| `dsds_get_entity` | Full documentation for an entity by identifier or name |
| `dsds_get_document_block` | One specific block (e.g. `api`, `accessibility`) from an entity — faster than fetching the full entity |

**Query workflow:**
```
dsds_list_entities → dsds_search_entities → dsds_get_entity or dsds_get_document_block
```

---

## DSDS file format

DSDS files are JSON documents. Every file needs `dsdsVersion` and either an `entity` (single entity) or `documentation` array (multiple entities).

**Single entity:**
```json
{
  "$schema": "https://designsystemdocspec.org/v0.2.1/dsds.bundled.schema.json",
  "dsdsVersion": "0.2.1",
  "entity": {
    "kind": "component",
    "identifier": "button",
    "name": "Button",
    "metadata": {
      "description": "Triggers an action or event when activated.",
      "status": "stable"
    },
    "documentBlocks": []
  }
}
```

**Multi-entity:**
```json
{
  "$schema": "https://designsystemdocspec.org/v0.2.1/dsds.bundled.schema.json",
  "dsdsVersion": "0.2.1",
  "systemMetadata": { "name": "My Design System" },
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
npm test          # run tests once
npm run test:watch  # watch mode
npm run dev       # run the server directly (reads DSDS_PATHS from env)
```

The spec schema is bundled at `src/spec/dsds.bundled.schema.json`. To update it when a new DSDS version ships, replace that file with the new bundled schema from `https://designsystemdocspec.org/v{version}/dsds.bundled.schema.json` and update `BUNDLED_VERSION` in `src/spec/version.js`.
