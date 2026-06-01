---
name: improve
description: >
  Improve an existing doc in the savvy MCP corpus — staleness, over-budget body,
  broken related links, outdated status. Dispatches the mcp agent in improve mode.
disable-model-invocation: true
argument-hint: "[doc-id-or-path] [--pr]"
---

# Improve a corpus doc

The user invoked `/docs:improve` with arguments: `$ARGUMENTS`

## What to do

Dispatch the `mcp` agent in **improve** mode. Hand off the arguments verbatim and
report the agent's result back. Use the `Agent` tool with `subagent_type: mcp`
and a prompt that includes:

1. **Mode**: `improve`
2. **Arguments received from the user**: `$ARGUMENTS`
3. **Reminder**: resolve the checkout first; if no doc id was given, use
   silk_docs_search to suggest candidates and ask the user; refresh stale
   related[] against silk://catalog; verify with build:catalog before finishing;
   commit with DCO sign-off (or open a PR if `--pr` was passed).

If `$ARGUMENTS` names no doc, the agent will search and ask which to improve.

## When the agent finishes

Surface the agent's report verbatim: what changed and the build:catalog result.
Do not editorialize.
