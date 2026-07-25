---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

### Dependency table cells are no longer markdown-escaped

Dependency table cells are now written to markdown verbatim instead of being escaped. Version specifiers and package names survive serialization intact, so a generated changeset reads `~0.2.1` and `some_pkg` rather than `\~0.2.1` and `some\_pkg`.

The escaping came from `remark-stringify`, which backslashes any character that could open a markdown construct — with GFM enabled `~` is the strikethrough delimiter and `_` opens emphasis. It affected every table cell, not just tilde ranges, and compounded each time a table was re-serialized through consolidation or PR-body reconstruction.

* Cells are marked literal and escape only `|` and `\`, the two characters that would otherwise break the table grid
* Fixes both write paths — the markdown-string serializer and the mdast table node the dependency-table aggregation plugin inserts into a changeset AST
* Prose elsewhere in a changeset keeps normal markdown escaping

### Hook-injected catalogs now produce dependency rows

A dependency declared against a catalog that is injected at install time by a pnpmfile hook — rather than written into `pnpm-workspace.yaml` or recorded in the lockfile's `catalogs:` block — resolved to nothing on both sides of a diff. The two raw specifiers compared equal and no row was emitted, so a real version movement produced no changeset at all.

The dependency diff now resolves specifiers per lockfile importer, which answers from the importer's own recorded versions when the catalog set cannot.

* Requires `@effected/workspaces` 0.7.0, which adds the importer-scoped resolution the fix reads through
* Scoped to the declaring importer rather than the workspace as a whole, so a repo whose packages hold different versions of the same dependency gets a correct answer per package instead of none
* Plain semver ranges are unaffected and still fall through to the declared specifier

### CSH005 now judges the same value under both linters

The markdownlint implementation of CSH005 validated the raw source of a dependency table cell, while the remark implementation validated the parsed value. A cell containing a markdown escape therefore got two different verdicts: a changeset written by the older serializer, carrying `\~0.2.0`, passed `savvy changeset check` and the pre-commit hook while failing `markdownlint`.

The markdownlint rules now resolve CommonMark backslash escapes before validating, so both implementations judge the value a reader actually sees.

Escape resolution lives in the shared token extractors rather than in one rule, so heading-based rules are aligned too — CSH002 previously compared a raw heading against the category list while its remark counterpart compared the parsed one.

* Affects existing changesets written before the escaping fix above; regenerating one clears it either way
* A value that is genuinely invalid once unescaped is still reported
* Only ASCII punctuation is unescaped, per CommonMark, so a backslash before a space stays literal
