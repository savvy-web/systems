---
id: standards/changeset-format
title: Changeset file format (CSH001–CSH005)
summary: The YAML frontmatter, 13 valid section headings, and CSH001–CSH005 structural rules for changesets.
tier: standards
source: hand
tags: [changeset]
priority: 0.5
related: [standards/changeset-discipline]
---

## Rule

Every changeset file (`.changeset/*.md`) starts with YAML frontmatter declaring the
affected packages and bump levels, followed by body content organized under one or
more of the 13 valid `##` section headings.

### Frontmatter shape

```yaml
---
"@savvy-web/package-name": patch | minor | major
---
```

Multiple packages list one line each:

```yaml
---
"@savvy-web/package-a": minor
"@savvy-web/package-b": patch
---
```

### Bump type guide

| Bump | Use for |
| :--- | :--- |
| `patch` | Bug fixes, docs, internal refactoring, tests, CI/build changes |
| `minor` | New features, new exports, non-breaking additions |
| `major` | Removed exports, changed signatures, breaking behavior changes |

### 13 valid section headings

All `##` headings must exactly match one of these (case-sensitive):

| Priority | Heading | Use for |
| :--- | :--- | :--- |
| 1 | Breaking Changes | Backward-incompatible changes |
| 2 | Features | New functionality |
| 3 | Bug Fixes | Bug corrections |
| 4 | Performance | Performance improvements |
| 5 | Documentation | Documentation changes |
| 6 | Refactoring | Code restructuring |
| 7 | Tests | Test additions or modifications |
| 8 | Build System | Build configuration changes |
| 9 | CI | Continuous integration changes |
| 10 | Dependencies | Dependency updates |
| 11 | Maintenance | General maintenance |
| 12 | Reverts | Reverted changes |
| 13 | Other | Uncategorized changes |

### Structural rules (CSH001–CSH005)

| Rule | Description |
| :--- | :--- |
| **CSH001** | No `#` (h1) headings anywhere in the body. No heading depth skips (e.g., jumping from `##` directly to `####`). |
| **CSH002** | All `##` headings must exactly match one of the 13 valid categories. |
| **CSH003** | No empty sections. Code fences must include a language identifier. No empty list items. |
| **CSH004** | No content before the first `##` heading (YAML frontmatter is not "content"). |
| **CSH005** | A `## Dependencies` section containing a table must use the 5-column schema (Dependency, Type, Action, From, To). |

**CSH005 dependency table schema:**

```markdown
| Dependency | Type        | Action  | From   | To     |
| :--------- | :---------- | :------ | :----- | :----- |
| effect     | dependency  | updated | 3.18.0 | 3.19.1 |
```

Valid **Type** values: `dependency`, `devDependency`, `peerDependency`,
`optionalDependency`, `workspace`, `config`.

Valid **Action** values: `added`, `updated`, `removed`. Use `—` (em dash) for From
when adding, or for To when removing.

## Why

The section-aware format makes changelogs scannable by category. Structural rules
are enforced by remark-lint pre-validation (and markdownlint in-editor); violations
fail CI. The 13 headings map to conventional commit types so tooling can correlate
commits to changelog entries.

## Examples

**Minimal valid changeset (Simple tier):**

```markdown
---
"@savvy-web/foo": patch
---

## Bug Fixes

- Corrects off-by-one error in pagination helper.
```

**Multi-section with dependency table (Structured tier):**

```markdown
---
"@savvy-web/foo": minor
---

## Features

- Adds `suppressWarnings` option to `ApiModelOptions`.

## Dependencies

| Dependency | Type        | Action  | From   | To     |
| :--------- | :---------- | :------ | :----- | :----- |
| effect     | dependency  | updated | 3.18.0 | 3.19.1 |
```

## See also

The discipline rules governing when a changeset is required are at
`silk://standards/changeset-discipline`. The `changeset-style` Claude Code skill
carries worked examples for all three content-depth tiers. The `changeset-check`
skill validates files against CSH001–CSH005 via `savvy changeset check`.
