# dsds-mcp

An MCP server for the [Design System Documentation Spec (DSDS)](https://designsystemdocspec.org). Exposes DSDS tooling to any MCP-compatible client (Claude Desktop, Cursor, etc.).

Two use cases:
- **Authoring** — help a team document their design system in DSDS format
- **Consumption** — let agents query an existing DSDS document to build with the design system

The DSDS spec is bundled at the version listed below. The server checks for updates on startup and surfaces a notice in tool responses when a newer version is available.

**Bundled spec version:** 0.12.0

---

## Integrity guard

`npm run check:integrity` verifies that every reference DSDS can return to an agent resolves:

- every `@sanity/icons` import in chunk code is a real export (catches hallucinated icons),
- no brief directs agents to an entity kind that returns nothing,
- one spec version across `version.js`, the README, and the loaded DSDS files.

Run it with the same env the server uses, so the icon and kind checks have data:

```sh
DSDS_PATHS=/path/to/sanity-ui.dsds.json \
PACKAGE_EXPORT_PATHS=@sanity/icons=/path/to/@sanity/icons \
npm run check:integrity
```

Without `DSDS_PATHS` / `PACKAGE_EXPORT_PATHS` it still runs the version check and skips the rest with a warning. Wire it into CI or a pre-commit hook to block a merge on a broken reference. The pure checks are covered by `tests/integrity.test.js` (run in `npm test`); the full guard also runs there when `DSDS_PATHS` is set.

---

## Requirements

- Node.js 18 or later
- An MCP-compatible client
- ESLint v9 or later (optional — only required if using `dsds_lint_code`)

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
| `PACKAGE_EXPORT_PATHS` | No | Comma-separated `packageName=path` pairs pointing to each package root. Used by `dsds_check_exports` to verify components exist before importing. See below. |
| `DSDS_INTRO_PATHS` | No | Comma-separated paths to DSDS files loaded as design system introductions. Content from each entity is prepended to the server instructions and exposed via the `dsds-intro` prompt. `DSDS_INTRO_PATH` (singular) still works as a single-path alias. |
| `DSDS_SCHEMA_VERSION` | No | Override the spec version string. Defaults to `0.12.0`. |
| `DSDS_FEEDBACK_DIR` | No | Directory where session feedback from `dsds_feedback` is written. Defaults to `feedback/` inside the dsds-mcp directory. |
| `DSDS_LOGS_DIR` | No | Directory where `dsds_lint_code` writes per-session lint logs. Defaults to `logs/` inside the dsds-mcp directory. |
| `LINT_PLUGINS` | No | Comma-separated ESLint plugin package names to use with `dsds_lint_code`. Plugins are resolved from `LINT_RESOLVE_DIR`. |
| `LINT_RESOLVE_DIR` | No | Absolute path to the project where your ESLint plugins are installed. Defaults to the current working directory. |

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

### Loading intro files on startup

`DSDS_INTRO_PATHS` loads one or more DSDS files when the server starts. Each entity's content is injected into the MCP server instructions so agents see it before any tool call. It also registers a `dsds-intro` prompt that clients can retrieve on demand.

Use this for a top-level system overview, a getting-started guide, or any reference you want agents to have as immediate context — without them needing to call a tool first.

```json
{
  "mcpServers": {
    "dsds": {
      "command": "npx",
      "args": ["dsds-mcp"],
      "env": {
        "DSDS_PATHS": "/path/to/my-design-system.dsds.json",
        "DSDS_INTRO_PATHS": "/path/to/overview.dsds.json, /path/to/agent-reference.dsds.json"
      }
    }
  }
}
```

Each path can point to any file already in `DSDS_PATHS`, or to a separate document not included in the main file set.

The server renders content from both `documentBlocks` and `agentDocumentBlocks` when building the instructions text. Entities with `agentDocumentBlocks` will have their agent-optimized guidelines and sections included directly.

`DSDS_INTRO_PATH` (singular) still works as a backward-compatible alias for a single path.

### Linting code with ESLint plugins

`dsds_lint_code` runs ESLint against one or more code files using plugins installed in your project. It auto-applies all fixable violations and returns the corrected code alongside any remaining violations that need manual edits. This lets an agent validate and fix component code against your design system's lint rules before finishing a task.

**Prerequisites:**

1. Install `eslint` (v9 or later) in your project:
   ```bash
   npm install -D eslint
   ```
2. Install the ESLint plugin(s) you want to run:
   ```bash
   npm install -D eslint-plugin-your-design-system
   ```

**Configuration:**

```json
{
  "mcpServers": {
    "dsds": {
      "command": "npx",
      "args": ["dsds-mcp"],
      "env": {
        "DSDS_PATHS": "/path/to/my-design-system.dsds.json",
        "LINT_PLUGINS": "eslint-plugin-your-design-system",
        "LINT_RESOLVE_DIR": "/path/to/your/project"
      }
    }
  }
}
```

Multiple plugins:

```json
"LINT_PLUGINS": "eslint-plugin-your-design-system,eslint-plugin-react"
```

`LINT_RESOLVE_DIR` must point to the directory where the plugins are installed (the one that contains `node_modules/`). It defaults to cwd if not set.

**How the rules are chosen:**

The MCP uses each plugin's `configs.recommended` ruleset if it exports one. If the plugin has no recommended config, all rules are enabled at `warn` level. No `eslint.config.js` from the filesystem is read — the MCP constructs the config purely from what's configured here.

**Usage by an agent:**

Prefer the `files` array to lint all generated files in one call:

```
dsds_lint_code(files=[
  { code: "<component tsx>", filename: "Card.tsx" },
  { code: "<app tsx>", filename: "App.tsx" }
])
```

Single file:

```
dsds_lint_code(code="<jsx string>", filename="Component.tsx")
```

The `filename` parameter drives parser inference (`.tsx` vs `.js`, etc.). It defaults to `Component.tsx`.

When fixes are applied, the tool returns the corrected code directly — copy it back into your files. Remaining violations (those without an autofix) are listed after the corrected code.

### Checking package exports

`dsds_check_exports` verifies that specific components are actually exported from their packages before your agent imports them. This catches the common case where docs describe a component as `draft` (not yet shipped) and the agent tries to import it anyway.

**Configuration:**

```json
{
  "mcpServers": {
    "dsds": {
      "command": "npx",
      "args": ["dsds-mcp"],
      "env": {
        "DSDS_PATHS": "/path/to/my-design-system.dsds.json",
        "PACKAGE_EXPORT_PATHS": "@sanity-labs/ui-poc=/path/to/ui-poc/packages/ui"
      }
    }
  }
}
```

Multiple packages (comma-separated):

```json
"PACKAGE_EXPORT_PATHS": "@sanity-labs/ui-poc=/path/to/ui-poc/packages/ui,@sanity/ui=/path/to/sanity-ui/packages/ui"
```

Each path should point to the package root (the directory containing `package.json`). The tool reads `dist/index.d.ts` if present, or falls back to `src/index.ts`.

**Usage by an agent:**

```
dsds_check_exports(components=["Box", "TextInput", "Badge"])
```

Returns:
```
✓ Box — exported from `@sanity-labs/ui-poc`
✗ TextInput — not found in `@sanity-labs/ui-poc`
✓ Badge — exported from `@sanity/ui`
```

---

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
| `dsds_get_entity` | Full documentation for an entity by identifier or name. Returns all `documentBlocks` and `agentDocumentBlocks`. |
| `dsds_get_document_block` | One specific block (e.g. `api`, `accessibility`) from an entity — faster than fetching the full entity |
| `dsds_get_agent_context` | Agent-optimized view of an entity. Renders content from both `agentDocumentBlocks` and `documentBlocks` (guidelines, use cases, props, sections — minus verbose accessibility and import blocks). The primary tool for understanding how to use a component. |
| `dsds_get_blueprint` | Fetch a blueprint entity by identifier. Returns the full code block (ready to copy), guidelines, use cases, and related component links. Use this instead of `dsds_get_entity` for blueprint entities. |

**Query workflow:**
```
dsds_context_brief(useCase="build") → dsds_list_entities → dsds_search_entities → dsds_get_agent_context or dsds_get_entity
```

For layouts and shells, check blueprints first:
```
dsds_search_entities(kind="blueprint") → dsds_get_blueprint(identifier)
```

### Lint tools — require `LINT_PLUGINS`

| Tool | Description |
|------|-------------|
| `dsds_lint_code` | Lint one or more code files using the configured ESLint plugins. Auto-applies all fixable violations and returns the corrected code. Pass all generated files in a single `files` array call. Remaining violations (no autofix available) are listed after the corrected code. |

### Export check — requires `PACKAGE_EXPORT_PATHS`

| Tool | Description |
|------|-------------|
| `dsds_check_exports` | Verify that specific components are actually exported from their packages. Returns a pass/fail for each name across all configured packages. Use before importing a component to catch `draft`-status components that are not yet shipped. |

### Feedback

| Tool | Description |
|------|-------------|
| `dsds_feedback` | Submit a session rating (1–5) and notes on what worked or was confusing. Call this at the end of any session where you used DSDS tools. Written to `DSDS_FEEDBACK_DIR`. |

---

## DSDS file format

DSDS files are JSON documents. Every file needs `dsdsVersion` and either an `entity` (single entity) or `entityGroups` array (named groups of entities).

**Single entity:**
```json
{
  "$schema": "https://designsystemdocspec.org/v0.12.0/dsds.bundled.schema.json",
  "dsdsVersion": "0.12.0",
  "entity": {
    "kind": "component",
    "identifier": "button",
    "name": "Button",
    "description": "Triggers an action or event when activated.",
    "metadata": { "status": "stable" },
    "documentBlocks": [],
    "agentDocumentBlocks": []
  }
}
```

**Multi-entity:**
```json
{
  "$schema": "https://designsystemdocspec.org/v0.12.0/dsds.bundled.schema.json",
  "dsdsVersion": "0.12.0",
  "systemInfo": { "systemName": "My Design System" },
  "entityGroups": [
    { "$ref": "./components/button.dsds.json#/entity" },
    { "$ref": "./foundations/spacing.dsds.json#/entity" }
  ]
}
```

Use `dsds_spec_scaffold` to generate ready-to-fill templates, and `dsds_validate` to check them. Full spec: [designsystemdocspec.org](https://designsystemdocspec.org).

### `agentDocumentBlocks`

Every entity supports an optional `agentDocumentBlocks` array alongside `documentBlocks`. Both arrays accept the same block kinds. `agentDocumentBlocks` is never rendered for human readers — it exists solely for agent (LLM) consumption.

Use it to add generation constraints, anti-patterns, and disambiguation notes without adding noise to human-facing docs. `dsds_get_agent_context` renders content from both arrays; `dsds_get_entity` returns both arrays in raw JSON.

---

## Development

```bash
npm install
npm test             # run tests once
npm run test:watch   # watch mode
npm run dev          # run the server directly (reads env vars from shell)
npm run update-schema  # fetch the latest published DSDS schema from designsystemdocspec.org
npm run logs         # view usage logs (lint + chunk activity) in a readable format
```

The server records usage to `logs/YYYY-MM-DD.jsonl`:

- **Every tool call** — `{ type: "tool", tool, ok, durationMs }`
- **Chunk access** — `dsds_get_chunk` writes a detailed `{ type: "chunk", identifier, name }` entry
- **Lint runs** — `dsds_lint_code` writes a detailed `{ type: "lint", … }` entry with per-file violations

Read them back with `npm run logs`. Pass options after `--`:

```bash
npm run logs                      # last 7 days: lint + chunk detail, plus a tool-usage summary
npm run logs -- --summary         # totals only, no per-entry detail
npm run logs -- --type tool       # per-call tool log + tool-usage breakdown
npm run logs -- --type lint       # only lint entries (or --type chunk)
npm run logs -- --days 30         # last 30 days
npm run logs -- --date 2026-06-18 # a single day
```

Tool calls always feed the **Tool usage** summary (counts and error totals per tool). They're omitted from the per-entry view in the combined `--type all` mode — where they'd duplicate the chunk/lint detail — but shown per call under `--type tool`.

The spec schema is bundled at `src/spec/dsds.bundled.schema.json`. Run `npm run update-schema` to pull the latest published version automatically. It fetches the schema from `https://designsystemdocspec.org/v{version}/dsds.bundled.schema.json` and updates `BUNDLED_VERSION` in `src/spec/version.js`. The MCP server loads the schema once at startup via `require()`, so restart the server after updating.
