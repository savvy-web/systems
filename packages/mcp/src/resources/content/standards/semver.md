---
id: standards/semver
title: Strict SemVer (no v-prefix)
summary: Strict SemVer 2.0.0 everywhere; git tags carry no leading v.
tier: standards
source: hand
tags: [semver]
priority: 0.5
related: [standards/changeset-discipline]
---

## Rule

Silk uses strict SemVer 2.0.0 for all version numbers. Git tags carry **no
leading `v` prefix**. This applies everywhere — package versions, git tags, and
version ranges authored by hand.

| Context | Correct | Incorrect |
| :--- | :--- | :--- |
| `package.json` `"version"` | `"1.2.3"` | `"v1.2.3"` |
| git tag for a release | `foo@1.2.3` or `1.2.3` | `vfoo@1.2.3` or `v1.2.3` |
| changeset bump result | `1.2.3` | `v1.2.3` |

## Why

The `v` prefix is noise that breaks strict SemVer parsers. Many tools (including
the Node.js SemVer library in strict mode) treat `v1.2.3` as an invalid version.
Consistent, tool-parseable versions across every surface — npm registry, git tags,
changelog entries, and API references — removes an entire class of subtle breakage
where one tool normalizes the prefix and another does not.

## Examples

A release of `@savvy-web/foo` at version `1.2.3` is tagged `foo@1.2.3` (or
`1.2.3` for single-package repos). The `package.json` carries `"version": "1.2.3"`.
The CHANGELOG entry title reads `1.2.3`. No `v` anywhere.

```bash
# correct
git tag foo@1.2.3

# incorrect — never do this
git tag vfoo@1.2.3
git tag v1.2.3
```

## See also

Changesets and bump mechanics are at `silk://standards/changeset-discipline`.
Publishability rules (which determine when a tag triggers a release) are at
`silk://standards/publishability`.
