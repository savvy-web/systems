---
name: changeset-style
description: >
  The complete @savvy-web/changesets style and format specification — YAML
  frontmatter, the 13 valid section headings, structural rules CSH001–CSH005,
  content depth tiers, and worked examples. Auto-loads when reading any
  .changeset/*.md file and is user-invokable on demand via /silk:changeset-style.
when_to_use: >
  "what's the changeset format", "how do I write a changeset", "valid section
  headings", "changeset rules", "what categories can I use", "CSH001", "CSH002",
  "CSH003", "CSH004", "CSH005", "show me the changeset style guide", "what
  does a good changeset look like"
paths:
  - ".changeset/*.md"
  - "**/.changeset/*.md"
---

# Changeset Style Guide

This is the authoritative style and format specification for `@savvy-web/changesets`. Changeset files are release documentation: they describe what users upgrading the package need to know, organized under category headings.

## YAML Frontmatter

Every changeset file begins with YAML frontmatter declaring which packages are affected and the bump level:

```yaml
---
"@savvy-web/package-name": patch | minor | major
---
```

Multiple packages are listed as separate lines when a change affects several:

```yaml
---
"@savvy-web/package-a": minor
"@savvy-web/package-b": patch
---
```

## Bump Type Guidelines

| Bump | Use for |
| :--- | :--- |
| `patch` | Bug fixes, docs, internal refactoring, tests, CI/build changes |
| `minor` | New features, new exports, non-breaking additions |
| `major` | Removed exports, changed signatures, breaking behavior changes |

When in doubt between `patch` and `minor`, prefer `minor`. When in doubt between `minor` and `major`, prefer `major`.

## Valid Section Headings

All `##` headings in a changeset must exactly match one of these 13 categories, listed in render priority order:

| Priority | Heading | Commit Types | Use For |
| :--- | :--- | :--- | :--- |
| 1 | Breaking Changes | any `!` suffix | Backward-incompatible changes |
| 2 | Features | `feat` | New functionality |
| 3 | Bug Fixes | `fix` | Bug corrections |
| 4 | Performance | `perf` | Performance improvements |
| 5 | Documentation | `docs` | Documentation changes |
| 6 | Refactoring | `refactor` | Code restructuring |
| 7 | Tests | `test` | Test additions or modifications |
| 8 | Build System | `build` | Build configuration changes |
| 9 | CI | `ci` | Continuous integration changes |
| 10 | Dependencies | `deps` | Dependency updates |
| 11 | Maintenance | `chore`, `style` | General maintenance |
| 12 | Reverts | `revert` | Reverted changes |
| 13 | Other | unrecognized | Uncategorized changes |

Matching is **case-sensitive and exact**. Use `### Sub-heading` under a `## Category` to give a distinct feature or named change its own heading.

## Structural Rules

These rules are enforced by the remark-lint pre-validation layer. Violating them will cause the changeset to fail CI.

| Rule | Description |
| :--- | :--- |
| **CSH001** | No `#` (h1) headings anywhere in the body. No heading depth skips (e.g., jumping from `##` directly to `####`). |
| **CSH002** | All `##` headings must exactly match one of the 13 valid categories. |
| **CSH003** | No empty sections. Code fences must include a language identifier. No empty list items. |
| **CSH004** | No content before the first `##` heading (the YAML frontmatter is not "content"). |
| **CSH005** | A `## Dependencies` section **must** contain a Markdown table in the 5-column schema below — prose or a bullet list is invalid, not an alternative form. |

### CSH005 dependency table schema

```markdown
| Dependency | Type           | Action  | From   | To     |
| :--------- | :------------- | :------ | :----- | :----- |
| effect     | dependency     | updated | 3.18.0 | 3.19.1 |
```

- **Dependency** — package name (non-empty)
- **Type** — one of: `dependency`, `devDependency`, `peerDependency`, `optionalDependency`, `workspace`, `config`
- **Action** — one of: `added`, `updated`, `removed`
- **From** — previous version, or `—` (em dash) for additions
- **To** — new version, or `—` (em dash) for removals

A `## Dependencies` section written as prose or a bullet list — instead of
this table — is a CSH005 violation, not a stylistic alternative. This is
enforced uniformly across every path a changeset passes through:
`savvy changeset check`, the `changeset_validate` MCP tool, and the
pre-commit hook.

## Content Depth Tiers

Choose a tier based on the significance of the change.

| Tier | When | Content |
| :--- | :--- | :--- |
| **Simple** | Small fixes, internal tweaks | `## Category` + bullet points. No prose. |
| **Structured** | Multi-faceted changes | Multiple `## Category` sections; `### Sub-heading` for distinct sub-features. |
| **Rich** | Significant features, breaking changes | Narrative paragraphs, `### Named Sub-features`, code blocks with usage examples, migration guides. |

Breaking changes always use the Rich tier and must include migration guidance.

For `patch` bumps, keep it Simple — `## Category` with bullet points. For `minor` and `major` bumps that cover multiple distinct capabilities, use `### Named Feature` sub-headings under `## Category` sections so each distinct feature has its own scannable heading.

## Key Principle

Write for the person reading GitHub release notes, not the engineer who made the change. Focus on what someone upgrading the package needs to know. Omit internal implementation details that have no bearing on how the package is used.

**Good** (user-facing, actionable):

> Added `suppressWarnings` option to `ApiModelOptions` for granular API Extractor warning suppression. Rules match by `messageId`, text `pattern`, or both.

**Bad** (implementation detail, not useful for release notes):

> Refactored the warning system to use a new options pattern with a factory class and builder interface.

**Good** (concise patch note):

> - Fixed flaky timeout in integration test suite

**Bad** (over-explained internal change):

> Multi-paragraph description of a test infrastructure refactor that no consumer of the package will ever need to know about.

## Examples

### Simple Tier

```markdown
---
"@savvy-web/changelog": patch
---

## Bug Fixes

Corrects Markdown link syntax for PR references. Changes `[(#42)](url)` to `[#42](url)` so PR numbers display as clickable links without extra bracket characters.

* Corrects `formatPRAndUserAttribution()` to use proper Markdown link syntax
* Exports `formatPRAndUserAttribution` to make it testable and reusable
```

### Structured Tier

```markdown
---
"@savvy-web/rslib-builder": minor
---

## Features

* `RSPressPluginBuilder.create()` — zero-config builder for RSPress plugins with plugin + optional runtime bundles
* Runtime auto-detection from `src/runtime/index.tsx`
* `tsconfigPreset` option on DtsPlugin for custom tsconfig preset selection

## Bug Fixes

* BannerPlugin CSS injection scoped to JS files via `include: /index\.js$/`
* Runtime DTS no longer cross-contaminates with plugin DTS in dual-lib builds
```

### Rich Tier

```markdown
---
"@savvy-web/shared": minor
---

## Features

### Hybrid Transformation Pipeline

Replaces custom dependency resolution with `@pnpm/exportable-manifest` while maintaining RSLib-specific transformations.

**Architecture:**

* Stage 1: Apply pnpm transformations (resolve catalog: and workspace: references)
* Stage 2: Apply RSLib transformations (path updates, field cleanup, type generation)
* Development mode: Preserves catalog: and workspace: references for local development
* Production mode: Complete transformation for npm/jsr publishing

## Breaking Changes

* Removed unused `transformer` option from `PackageJsonTransformPlugin`
* Plugin API remains backward compatible for existing usage
```
