---
name: changeset-config
description: >
  The .changeset/config.json for Silk repos — the changelog tuple, the
  standard changesets fields, and the Silk-custom versionFiles and
  additionalScopes per-package options. Auto-loads when editing
  .changeset/config.json; user-invokable as /silk:changeset-config.
when_to_use: >
  "what goes in .changeset/config.json", "versionFiles", "additionalScopes",
  "bump plugin.json with the package", "sync a manifest version", "which
  files belong to a package's release", "changelog config", "the changelog
  tuple", "updateInternalDependencies", "privatePackages", "is this a
  standard changesets field or a Silk one"
paths:
  - "**/.changeset/config.json"
---

# .changeset/config.json

This is the reference for `.changeset/config.json` in a Silk repo. The file is standard `@changesets/config`, plumbed through a Silk-custom changelog formatter that adds two per-package fields: `versionFiles` and `additionalScopes`.

## The changelog tuple

The `changelog` field is a two-element array: `[id, options]`.

- Element 0 is the resolvable module id — `"@savvy-web/changelog"`, the installable identity of the Silk changelog formatter.
- Element 1 is the Silk-custom options object. Every field inside it is opaque to the stock `@changesets/config` schema; only Silk tooling validates it.

A representative config:

```jsonc
{
  "$schema": "https://unpkg.com/@changesets/config@4.0.0-next.6/schema.json",
  "changelog": [
    "@savvy-web/changelog",
    {
      "repo": "owner/repo",
      "packages": {
        "@scope/pkg": {
          "versionFiles": [{ "glob": "plugins/*/.claude-plugin/plugin.json", "paths": ["$.version"] }]
        }
      }
    }
  ],
  "commit": false,
  "access": "restricted",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [],
  "privatePackages": { "tag": true, "version": true }
}
```

## Standard fields

These top-level fields are standard `@changesets/config` fields, validated by `@changesets/config` itself.

| Field | What it does |
| --- | --- |
| `commit` | Whether `changeset version`/`changeset add` auto-commit their changes. |
| `access` | Default publish access — `"restricted"` or `"public"`. |
| `baseBranch` | The branch changesets diffs against to detect changes. |
| `updateInternalDependencies` | Bump strategy (`"patch"` or `"minor"`) for internal workspace dependents when a dependency releases. |
| `ignore` | Package names excluded from versioning entirely. |
| `privatePackages` | `{ tag, version }` — whether private packages are still tagged and/or versioned on release. |

`fixed`, `linked`, and `snapshot` are also standard `@changesets/config` fields; they are simply unused in this config.

## Standard vs. custom fields

Plainly:

- **Standard** (validated by `@changesets/config`): `$schema`, `changelog` (the wrapper array itself), `commit`, `access`, `baseBranch`, `updateInternalDependencies`, `ignore`, `privatePackages`.
- **Silk-custom** (validated only by Silk tooling, live entirely inside `changelog[1]`): `repo`, the link toggles (`commitLinks`, `prLinks`, `issueLinks`, `issuePrefixes`), `packages`, and the deprecated top-level `versionFiles`.

The two most important custom fields — the per-package `versionFiles` and `additionalScopes` — each have their own reference:

- `references/version-files.md` — bumping version fields in files outside `package.json`.
- `references/additional-scopes.md` — attributing non-workspace paths to a package's release surface.
