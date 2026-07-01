---
name: dependencies
description: >
  Manage pure dependency changesets via the changeset_deps_regen (delete-
  and-recreate) and changeset_deps_detect (read-only) MCP tools. The regen
  flow enforces our convention of one-package-per-changeset and one-
  dependency-changeset-per-package.
user-invocable: false
model: sonnet
allowed-tools: mcp__plugin_silk_savvy-mcp__changeset_deps_regen mcp__plugin_silk_savvy-mcp__changeset_deps_detect
---

# Manage Dependency Changesets

This is an agent-internal skill. The changeset-manager agent invokes it
during the reconcile flow whenever a branch's diff includes changes to
any `package.json`'s `dependencies` / `devDependencies` /
`peerDependencies` / `optionalDependencies` fields.

## The single-package convention

**Always write one package per changeset file.** Although
`@changesets/cli` accepts multi-package frontmatter, this project treats
one changeset = one package as the rule. `changeset_deps_regen` enforces
this: it never writes a multi-package dependency changeset, and a
workspace package may have at most **one** changeset file whose only
content is a `## Dependencies` table.

## Primary path: `changeset_deps_regen`

Call the `mcp__plugin_silk_savvy-mcp__changeset_deps_regen` tool.

Args:

| Arg | Effect |
| --- | --- |
| `dryRun` | `true` prints the plan without writing or deleting anything. Prefer running with `dryRun: true` first to preview, then re-invoke without it (or `dryRun: false`) to apply. |
| `package` | Restrict to a single workspace package. Only that package's pure-dep changeset is deleted and re-written. |
| `base` | Override the base branch (defaults to `.changeset/config.json#baseBranch`, typically `main`). |
| `cwd` | Target a workspace other than the current directory. |

What it does:

1. Computes the cumulative dep diff from the merge base with the
   project's base branch to the working tree — committed, staged, unstaged.
2. Finds every "pure dependency changeset" in `.changeset/*.md`. Strict
   detection: single-package frontmatter, exactly one `## Dependencies`
   heading, no other body content.
3. Deletes them all (or, on `dryRun`, reports what it would delete).
4. Writes one fresh `<adjective>-<noun>-<verb>.md` per workspace
   package with current dep changes: single-package frontmatter,
   `patch` bump, one `## Dependencies` section, one CSH005 table
   (Dependency | Type | Action | From | To).

**Table rows carry resolved versions and omit `devDependency` rows.**
`catalog:`/`workspace:` specifiers in the table are resolved to concrete
versions before they land in the changeset, and devDependency changes
are excluded entirely — they don't affect the published package's
contract. Use `changeset_deps_detect` when you need the full diff
including devDependencies.

`structuredContent` shape:

```jsonc
{
  "root": "...",
  "deleted": ["..."],      // changeset files removed (or would be removed, on dryRun)
  "written": ["..."],      // changeset files written (or would be written, on dryRun)
  "skippedMixed": ["..."], // changesets with Dependencies + other sections — never touched
  "dryRun": true
}
```

The tool also returns a formatted markdown transcript in its text
content — present that to the user as-is when a human-readable summary
is wanted.

## Secondary path: `changeset_deps_detect`

Call the `mcp__plugin_silk_savvy-mcp__changeset_deps_detect` tool.

Read-only — no `.changeset/*.md` files are written or deleted. Returns
the same cumulative dependency diff `changeset_deps_regen` would act on,
per workspace package, and **includes devDependency rows** (unlike
regen's output). Useful when you want to *see* what would change before
committing to a regen, or when folding a dep change into a hand-authored
mixed changeset.

Args: `base`, `package`, `cwd` — same semantics as `changeset_deps_regen`.

`structuredContent` shape:

```jsonc
{
  "root": "...",
  "packages": [
    {
      "package": "@scope/foo",
      "relativePath": "packages/foo",
      "rows": [
        { "dependency": "effect", "type": "dependency", "action": "updated", "from": "3.18.0", "to": "3.19.1" }
      ]
    }
  ]
}
```

## When to invoke

- **The diff touches any `package.json`'s dep fields.** Look at the
  `changeset_inspect` (`mode: "branch"`) result: if any of the `files[]`
  entries are a workspace `package.json` and have `status: "modified"`,
  call `changeset_deps_regen`.
- **An existing `.changeset/*.md` has a stale Dependencies table.**
  `changeset_deps_regen` will detect and replace it.
- **Don't run during squash** — squash is for consolidating
  feature/fix changesets. Dependency changesets are regenerated, not
  merged.

## What this skill does not do

- It does not modify mixed changesets (Dependencies + other sections).
  Those were authored by a human and the agent leaves them alone. The
  `skippedMixed` array surfaces them for the user's awareness — if they
  want to clean up they can edit by hand.
- It does not compute lockfile-only movements. Only declared dependency
  changes in `package.json` produce table rows. Lockfile resolution
  drift (e.g., `^3.0.0` resolving to `3.18.0` vs `3.19.0`) is
  intentionally treated as noise.
- It does not promote bumps above `patch`. A peer dependency crossing
  a major boundary is still a `patch` for the workspace package itself
  — the human can hand-edit the bump if consumers need warning.

## Error handling

Both tools propagate typed errors from the MCP server — no stdout
parsing required:

- **Success** — `structuredContent` plus a formatted markdown transcript
  in the text content.
- **`GitError`** — typically a missing base branch or git command
  failure. Report the error message and stop.
- **`WorkspaceRootNotFoundError`** — the `cwd` isn't inside a recognized
  workspace. Report the error message and stop.
