# Security Policy

## Reporting a vulnerability

Please report security issues privately — do **not** open a public issue for an
unpatched vulnerability.

Use GitHub's [private vulnerability reporting](https://github.com/somerandomdude/dsds-mcp/security/advisories/new)
(Security → Report a vulnerability). Include:

- a description of the issue and its impact,
- steps to reproduce, and
- the affected version (`dsds-mcp` version or commit).

You can expect an initial response within a few days. Once a fix is available, a
patched release will be published to npm and the advisory disclosed.

## Scope

`dsds-mcp` is a local stdio MCP server. It reads the DSDS files you point it at
(`DSDS_PATHS`) and, when configured, resolves ESLint plugins from your project
(`LINT_PLUGINS` / `LINT_RESOLVE_DIR`). Treat the files and plugins you configure
as trusted input — only point the server at sources you control.

## Supported versions

Until a `1.0.0` release, only the latest published version receives security fixes.
