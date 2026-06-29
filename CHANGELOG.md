# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-06-29

### Changed
- Docs: added a step-by-step "Quick start (no coding required)" guide for non-technical users (install Node.js → copy DSDS file path → edit client config → restart → verify), plus an "I don't have a DSDS file yet" path.
- Docs: clarified that no separate install step is needed — `npx` fetches the server automatically — with optional version-pinning (`dsds-mcp@0.1.1`) and global-install instructions for those who prefer them.

### Fixed
- Mark the `dsds-mcp` bin as executable.

## [0.1.0] - 2026-06-28

Initial public release.

### Added
- MCP server exposing the Design System Documentation Spec (DSDS) to MCP clients.
- Spec authoring tools: `dsds_spec_overview`, `dsds_spec_entity_schema`,
  `dsds_spec_document_blocks`, `dsds_spec_scaffold`, `dsds_validate`.
- Design-system query tools: `dsds_context_brief`, `dsds_list_entities`,
  `dsds_search_entities`, `dsds_get_entity`, `dsds_get_document_block`,
  `dsds_get_agent_context`, `dsds_get_chunk`, `dsds_to_markdown`.
- Relationship graph tools: `dsds_impact`, `dsds_get_dependents`,
  `dsds_get_dependencies`, `dsds_get_alternatives`.
- Interactive wizards: `dsds_build_component`, `dsds_author_component_doc`.
- `dsds_lint_code` (bring-your-own ESLint plugins via `LINT_PLUGINS`) and
  `dsds_check_exports` (via `PACKAGE_EXPORT_PATHS`).
- Optional feedback tool and an opt-in reference-integrity guard
  (`npm run check:integrity`, icon check gated on `ICON_PACKAGE`).
- Bundled DSDS schema (v0.12.0) with a startup update check.

### Notes
- The server is generic and configurable — all design-system–specific behavior
  (icon package, component packages, lint plugins) is driven by configuration.
- `json-render` UI generation (catalog / spec validation / render) is not included
  in this release and is planned to return as a configurable feature.
