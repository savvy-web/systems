# additionalScopes

`packages[name].additionalScopes` is a `string[]` of repo-relative globs naming files **outside** a package's workspace directory that still belong to its release surface. It exists for **change attribution / classification** — deciding which package "owns" a changed path when reconciling changesets — and plays no part in version rewriting; that is `versionFiles`' job.

Globs must be repo-relative: absolute paths and parent traversal (`../`) are rejected. Negation patterns (`!path/**`) are allowed, so a scope can claim a directory while carving out an exclusion.

## Classification order and conflict rules

When a changed path is classified against a package, the check runs in this order, stopping at the first match:

1. **Workspace match** — the path is inside the package's own workspace directory.
2. **`additionalScopes` match** — the path is matched by one of the package's `additionalScopes` globs.
3. **`versionFiles` match** — the path is one of the package's `versionFiles` targets.

Cross-package conflicts are rejected at config-load time:

- `additionalScopes` must not overlap between two different packages — a given file may be claimed by at most one package's `additionalScopes`.
- `additionalScopes` must not shadow another package's workspace directory — a package cannot claim files that live inside a different package's own workspace dir.
- No two `versionFiles` entries — within or across packages — may resolve to the same `(file, JSONPath)` tuple.

## Worked example

```jsonc
"packages": {
  "@scope/docs": {
    "additionalScopes": ["website/content/docs/**", "!website/content/docs/drafts/**"]
  }
}
```

Changes under `website/content/docs/**` are attributed to `@scope/docs` when reconciling changesets, except for anything under `website/content/docs/drafts/**`, which the negation pattern excludes.
