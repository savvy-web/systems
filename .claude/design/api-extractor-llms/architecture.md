---
status: archived
module: api-extractor-llms
category: architecture
created: 2026-06-01
updated: 2026-09-03
last-synced: 2026-09-03
completeness: 100
archived: 2026-07-01
archival-reason: obsolete
related:
  - ../mcp/architecture.md
dependencies: []
---

# api-extractor-llms (former external dependency)

> **ARCHIVED (2026-07-01) — describes a dependency this repo no longer has.** `api-extractor-llms` was a build-time devDependency of `@savvy-web/mcp`, used only to render the server's API-reference resource tier. That tier was removed with the whole mcp resource subsystem, and with it the dependency, the generator script and the rendered output (see `../mcp/architecture.md`, "Current state"). Nothing in `savvy-web/systems` imports or installs `api-extractor-llms` today. Everything below is preserved for historical reference; do not read it as current behavior, and do not cite the `packages/mcp/lib/scripts/*` or `packages/mcp/public/content/*` paths — none of them resolve.

## Table of contents

- [Overview](#overview)
- [Current state](#current-state)
- [What it did for this repo](#what-it-did-for-this-repo)
- [Rationale](#rationale)

## Overview

`api-extractor-llms` is an unscoped external npm package, published from <https://github.com/spencerbeggs/api-extractor-llms>, that renders Microsoft API Extractor `.api.json` models into LLM-lean markdown. It began life as a workspace package in this monorepo and was extracted to its own repo before mcp dropped it. That repo is the only authority for the library's internals; this doc never was.

## Current state

Removed. No `package.json` in `savvy-web/systems` declares `api-extractor-llms`, no source imports it and the mcp generator script that drove it is deleted. `savvy-mcp` is a tools-only server with no resources, corpus or render pipeline. Per-package `.api.json` models are still emitted during builds by the tsdown-plugins `meta` plugin (`packages/tsdown-plugins/src/meta/api-extractor.ts`) for API-report purposes, but nothing in this repo renders them to markdown.

## What it did for this repo

Historically, mcp's `generate:api-docs` build script loaded each library package's API Extractor model and rendered it to markdown through the library's two injection seams: a silk-specific frontmatter renderer and a `silk://packages/<dir>/api/<kind>/<slug>` route formatter for intra-package crosslinks. The rendered docs landed under mcp's public content directory as gitignored, deterministically regenerated build output and were served as the `silk://packages/<pkg>/api/*` tier of the resource tree. The dependency was a `devDependency` because the published server never imported it at runtime — only the build did.

## Rationale

### Why this doc was a pointer, not a full architecture

Once the package was extracted and published, its internal architecture was documented and versioned in its own repo. Duplicating it here would have created a second source of truth that drifted as the library evolved, so this doc only ever recorded that mcp depended on it at build time and where the real docs lived.

### Why it is retained rather than deleted

The `archived` entry keeps the design tree honest about a dependency that appears in mcp's CHANGELOG history and in older design discussion. A reader who meets the name there can resolve it here in one hop and learn that it is stale, without having to reconstruct the timeline from git.
