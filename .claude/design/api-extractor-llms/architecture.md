---
status: current
module: api-extractor-llms
category: architecture
created: 2026-06-01
updated: 2026-06-12
last-synced: 2026-06-12
completeness: 100
related:
  - ../mcp/architecture.md
dependencies: []
---

# api-extractor-llms (external dependency)

`api-extractor-llms` is an **external npm package** (unscoped, published from `spencerbeggs/api-extractor-llms`) that renders Microsoft API Extractor `.api.json` models into LLM-lean markdown. It was extracted out of this monorepo and no longer lives here. This doc records why this repo depends on it and where its architecture is documented; it is not the source of truth for the library's internals.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [How this repo consumes it](#how-this-repo-consumes-it)
- [Rationale](#rationale)

## Overview

The library turns a package's API Extractor model into plain markdown docs suitable for LLM consumption. Body rendering is identical across consumers; the two things callers customize are the **frontmatter block** prepended to each doc and the **crosslink URL scheme** for intra-package links, both supplied as injected services (a `FrontmatterRenderer` and a `RouteFormatter`). The public surface this repo relies on is `loadApiModel`, `renderPackage` and the `ApiItemRef`/`DocMeta` types.

The full internal architecture — the shared output system, the injection seams, the ported TSDoc/formatter/cross-linker modules and the boundaries — now lives in the standalone repo: <https://github.com/spencerbeggs/api-extractor-llms>. Treat that repo's `.claude/design/` (or README) as authoritative for the library's shape.

## Current State

Extracted and published as `api-extractor-llms@^0.1.0` (unscoped name). It is no longer a workspace package in `savvy-web/systems` — `packages/api-extractor-llms/` has been deleted. `@savvy-web/mcp` now consumes it as an **external** `devDependency` (`"api-extractor-llms": "^0.1.0"`), used only by mcp's `generate:api-docs` script. It is a build-time generator dependency, never a server runtime dependency.

## How this repo consumes it

`packages/mcp/lib/scripts/generate-api-docs.ts` imports `loadApiModel` and `renderPackage` from `"api-extractor-llms"` and drives the mcp API-doc generation pipeline. mcp injects a silk-specific `FrontmatterRenderer` and a `silk://packages/<dir>/api/<kind>/<slug>` `RouteFormatter`, then writes the rendered docs under `packages/mcp/public/content/packages/<dir>/api/`. Both the rendered docs and the upstream `.api.json` models are gitignored, ephemeral build output regenerated deterministically on every build — only the hand-authored corpus and the baseline `manifest.json` are tracked. The full pipeline — targets, turbo orchestration, the gitignored-generated-docs split — is documented in `../mcp/architecture.md` under "The API-doc generation pipeline".

## Rationale

### Why this doc is a pointer, not a full architecture

The package was extracted into its own repo and published to npm, so its detailed internal architecture is documented and versioned there. Duplicating that architecture here would create a second source of truth that drifts as the external library evolves. This repo only needs to record that mcp depends on the external package at build time and where to find the real docs.

### Why it is a build-time devDependency only

The library renders API docs from `.api.json` models during the mcp build; the published server never imports it at runtime. Keeping it a `devDependency` mirrors that: a bare install of the published `@savvy-web/mcp` does not pull it in.
