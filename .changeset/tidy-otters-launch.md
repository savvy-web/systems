---
"@savvy-web/mcp": minor
---

## Features

Adopts the `@effected` front-end kit for the server's process and error handling.

### Carrier-aware version

`ServerLayer(cwd, options?)` and `main(options?)` take a `distribution` option. When `savvy-mcp` is launched through a carrier such as `@savvy-web/silk`, `serverInfo.version` reports it:

```ts
await main({ distribution: { name: "@savvy-web/silk", version: "4.2.8" } });
// serverInfo.version -> "3.2.4 via @savvy-web/silk 4.2.8"
```

Launched directly, the version is unchanged.

### Project directory resolution

The project directory is now resolved with `@effected/engine`'s `LaunchContext.projectDir`: the first positional argument, then `SAVVY_MCP_PROJECT_DIR`, then `CLAUDE_PROJECT_DIR`, then the working directory — an empty value or an unsubstituted `${VAR}` placeholder is skipped rather than accepted as-is.

## Bug Fixes

Serving now goes through `@effected/mcp`'s `McpStdio`: a non-JSON stdin line is answered with a JSON-RPC `-32700` parse error and the server keeps serving, and a launch failure is reported on stderr only, never onto the JSON-RPC wire.

## Breaking Changes

Tool results no longer carry a markdown transcript. A successful call returns the typed result in `structuredContent`, and `content[0].text` is that same object as JSON — the framework's own rendering. Claude Code forwards only `structuredContent` to the model, so the transcript reached no model there; a client that shows `content` (Cursor, Copilot, MCP Apps hosts) now sees JSON instead of markdown. The `SilkMarkdown` annotation is removed from the barrel, and a declared tool failure is answered on the wire without an error log line on stderr.

The `Remediation` type, `composeRemediatedMessage`, and `truncateEchoed` are no longer exported from the package barrel — they are replaced by `@effected/engine`'s `Remediation` and `@effected/mcp`'s `ToolFailure`, which every error in `errors.ts` now builds on. Anything importing these directly from `@savvy-web/mcp` should switch to the equivalent kit exports.

## Dependencies

| Dependency       | Type       | Action | From | To    |
| :--------------- | :--------- | :----- | :--- | :---- |
| @effected/engine | dependency | added  | —    | 0.1.0 |
| @effected/mcp    | dependency | added  | —    | 0.1.1 |
