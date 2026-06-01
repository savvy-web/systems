---
id: guides/llm-friendly-json-schemas
title: LLM-friendly JSON Schemas for tool outputs
summary: Load when designing the output schema of an MCP tool or a GitHub Action.
tier: guides
source: hand
tags: [mcp]
priority: 0.5
related: [packages/mcp/resource-taxonomy]
---

A coding agent consumes a tool's structured output by reading it, not by running a
parser against it. The schema you choose is a prompt: it decides how reliably the
model can locate a value, follow a reference, and reason about what it got back.
Read this when designing a new MCP tool's output schema or a GitHub Action's
`outputs`, where the same constraints apply.

## Prefer flat, named fields over deep nesting

A model retrieves a value by following a path it has to hold in working memory.
`result.targets[0].registry` is harder to reference reliably than a flat
`registries: string[]`. Keep the shape shallow. When you must nest, name every
level with a descriptive key rather than relying on positional structure, so the
path reads like prose.

## Avoid recursive and open-ended shapes

A schema that can nest itself arbitrarily (a tree of the same node type) forces the
model to track depth it cannot see. Where the domain is genuinely recursive,
flatten it: emit a list of nodes plus a parent-id field rather than a literal tree.

## Use enums and literals for closed sets

When a field can only take a handful of values, type it as a union of literals, not
an open string. An enum tells the model the complete option set up front, which
both narrows its generation and lets it reason exhaustively ("if not `public`, then
`restricted`"). This mirrors how the Silk schemas type `access` as
`"public" | "restricted"` and `tier` as `standards | packages | guides`.

## Collapse relations to identifier arrays

Do not inline a related entity's full record where a reference will do. Emit an
array of stable identifiers (the `related: string[]` pattern in the resource
corpus) and let the consumer fetch the target if it needs more. This keeps each
payload small and the relationship explicit, and it survives the related record
changing shape.

## Pair the structured payload with a short human-readable summary

A model orients faster on one sentence than on a field-by-field scan. Return both:
the structured object for precise extraction, and a brief natural-language summary
for orientation. The MCP tools in this ecosystem follow this dual-channel
convention — a structured result alongside a lean markdown transcript — so the
agent gets a fast "what is this" read and an exact "what are the values" read from
the same call.

## Putting it together

When you sketch a new output schema, ask: can the model name every value in one
short path; is every closed set an enum; are relations references rather than
inlined records; and is there a one-line summary to orient on? If so, the schema
is doing its job as a prompt. The resource taxonomy
(`silk://packages/mcp/resource-taxonomy`) applies these same rules to the
documentation corpus's own front-matter.
