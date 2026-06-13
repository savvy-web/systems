---
name: corpus-authoring
description: >
  Use when writing or registering a doc in the savvy MCP corpus
  (packages/mcp/public/content). Covers the front-matter schema, tier
  assignment, the controlled tag vocabulary with the propose-then-add workflow,
  and related-id rules. Reads the live contract so values never drift.
disable-model-invocation: false
allowed-tools: Bash(bash *)
---

# Authoring a corpus doc

Corpus docs live under `packages/mcp/public/content/{standards,packages,guides}/`
in a resolved savvy-web/systems checkout. You author markdown; you never edit the
schema, compiler, tags source, or the generated `manifest.json`.

## Load the live contract first

The exact schema, tag vocabulary, dead-name list, and body budgets are the live
source of truth. Print the current values before authoring (requires
`SAVVY_SYSTEMS_DIR` set, or run from inside the systems checkout):

```bash
SAVVY_SYSTEMS_DIR="<path-to-systems>" bash "${CLAUDE_PLUGIN_ROOT}/skills/corpus-authoring/scripts/show-contract.sh"
```

Do not rely on a memorized field list or tag set — read the script output.

## Stable invariants (these do not change)

- **Required front-matter:** `id`, `title`, `summary`, `tier`, `source`, `tags`.
  `id` must match the tier-prefixed pattern; hand-written docs always set
  `source: hand`.
- **Tier double-check:** the `tier` field must equal the top-level content
  directory the file lives in, AND `id` must start with `<tier>/`. A trailing
  slash in an id (e.g. `packages/silk-effects/`) denotes a directory-index doc.
- **`related[]`:** every entry must resolve to a live corpus id. Read
  `silk://catalog` to confirm ids before listing them. Never reference a
  generated `packages/*/api/*` id — those carry `related: []` and would dangle.
- **Never** put a forbidden dead name (see the contract output) in a body.

## Tags: propose-then-add

Tags are a controlled vocabulary; unknown tags fail the build. If a doc needs a
concept that is not a canonical tag or alias:

1. Name the closest existing canonical tag.
2. Offer the user three choices: use the existing canonical tag, add the new tag
   to `tags.json` (you may do this in the systems checkout once approved), or
   pick a different term.
3. Never grow the vocabulary silently.

## After authoring

Invoke the `corpus-verify` skill to run `build:catalog`, fix every error, and
report any body-budget warnings before declaring done.
