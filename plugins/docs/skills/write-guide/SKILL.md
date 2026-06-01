---
name: write-guide
description: >
  Author a new doc in the savvy MCP corpus from a topic, using the current
  repo's local context. Dispatches the mcp agent in write-guide mode.
disable-model-invocation: true
argument-hint: "[topic] [--pr]"
---

# Write a corpus guide

The user invoked `/docs:write-guide` with arguments: `$ARGUMENTS`

## What to do

Dispatch the `mcp` agent in **write-guide** mode. Hand off the arguments verbatim
and report the agent's result back. Use the `Agent` tool with
`subagent_type: mcp` and a prompt that includes:

1. **Mode**: `write-guide`
2. **Arguments received from the user**: `$ARGUMENTS`
3. **Reminder**: resolve the savvy-web/systems checkout first; read silk://catalog
   and check for an overlapping doc before writing; default to the guides tier;
   verify with build:catalog before finishing; commit with DCO sign-off (or open a
   PR if `--pr` was passed).

If `$ARGUMENTS` has no topic, the agent will ask the user what to write for.

## When the agent finishes

Surface the agent's report verbatim: the created file path, the assigned id, tags
added or proposed, and the build:catalog result. Do not editorialize.
