---
"@savvy-web/silk-effects": minor
---

## Features

### Front-matter rules in `ChangesetLinter`

`ChangesetLinter` now runs through `@effected/changesets/lint` and, alongside CSH001-CSH005, reports the kit's front-matter rules:

* CF001: a front matter block must be present, valid YAML, and a mapping
* CF002: front-matter keys must be package names
* CF003: release type values must be valid bump types
* CF004: each key must name a workspace package. This rule only runs when the new optional `{ packages }` option is passed to `validateContent`, `validateFile` or `validate`

`ChangesetLinterOptions` is a new exported type for that option.

Files that previously passed can now produce findings. A changeset with no front matter block now fails CF001.

### One definition of the CSH rules

CSH001-CSH005 are now written once, as `@effected/markdown-lint` rules, and the duplicate micromark `markdownlint` implementation is gone. The `Changesets.Markdownlint*Rule` exports and `SilkChangesetsRules` are produced from those definitions through `MarkdownlintAdapter` and are typed `MarkdownlintRule` instead of markdownlint's `Rule`. Run through markdownlint, they now report exactly what the programmatic linter reports: indented code blocks are flagged by CSH003 and CSH005 table findings are reported at the table line.

## Bug Fixes

* CSH005 row errors now read as plain messages, for example "Invalid dependency type 'x'. Valid types are: ...", instead of raw Schema errors

## Dependencies

| Dependency | Type | Action | From | To |
| :--------- | :--- | :----- | :--- | :-- |
| markdownlint | devDependency | removed | ^0.41.1 | — |
