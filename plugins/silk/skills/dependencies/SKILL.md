---
name: dependencies
description: >
  Manage pure dependency changesets via the @savvy-web/changesets CLI.
  Ships two scripts: `detect.sh` (read-only) and `regen.sh` (delete-and-
  recreate). The regen flow enforces our convention of one-package-per-
  changeset and one-dependency-changeset-per-package.
user-invocable: false
model: sonnet
allowed-tools: Bash(bash *)
---

# Manage Dependency Changesets

This is an agent-internal skill. The changeset-manager agent invokes it
during the reconcile flow whenever a branch's diff includes changes to
any `package.json`'s `dependencies` / `devDependencies` /
`peerDependencies` / `optionalDependencies` fields.

## The single-package convention

**Always write one package per changeset file.** Although
`@changesets/cli` accepts multi-package frontmatter, this project treats
one changeset = one package as the rule. The regen script enforces this:
it never writes a multi-package dependency changeset, and a workspace
package may have at most **one** changeset file whose only content is a
`## Dependencies` table.

## Primary path: `regen.sh`

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/dependencies/scripts/regen.sh"
```

What it does:

1. Computes the cumulative dep diff from the merge base with the
   project's base branch (`.changeset/config.json#baseBranch`, default
   `main`) to the working tree — committed, staged, unstaged.
2. Finds every "pure dependency changeset" in `.changeset/*.md`. Strict
   detection: single-package frontmatter, exactly one `## Dependencies`
   heading, no other body content.
3. Deletes them all.
4. Writes one fresh `<adjective>-<noun>-<verb>.md` per workspace
   package with current dep changes: single-package frontmatter,
   `patch` bump, one `## Dependencies` section, one CSH005 table
   (Dependency | Type | Action | From | To).

Output (JSON to stdout):

```jsonc
{
  "toDelete": [{"file": "...", "package": "@scope/foo"}],
  "toWrite":  [{"file": "...", "package": "@scope/foo", "diff": {...}}],
  "skippedMixed": ["..."]  // changesets with Dependencies + other sections — never touched
}
```

Common flags forwarded to the CLI:

| Flag | Effect |
| --- | --- |
| `--dry-run` | Print the plan without writing or deleting. |
| `--package <name>` | Restrict to a single workspace package. Only that package's pure-dep changeset is deleted and re-written. |
| `--base <branch>` | Override the base branch (defaults to the config's `baseBranch`). |

## Secondary path: `detect.sh`

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/dependencies/scripts/detect.sh"
```

Read-only. Returns the same per-workspace-package diff structure that
`regen.sh` would write, without touching any files. Useful when you
want to *see* what would change before committing to a regen, or when
folding a dep change into a hand-authored mixed changeset.

Flags: `--from <ref>` / `--to <ref>` (defaults: merge-base → working
tree), `--package <name>`, `--markdown` (emit ready-to-paste CSH005
blocks instead of JSON).

## When to invoke

- **The diff touches any `package.json`'s dep fields.** Look at the
  `analyze-branch.sh` output: if any of the `files[]` entries are a
  workspace `package.json` and have `status: "modified"`, run `regen.sh`.
- **An existing `.changeset/*.md` has a stale Dependencies table.** The
  `regen.sh` script will detect and replace it.
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

Both scripts propagate the CLI's exit code:

- **Exit 0**: JSON plan on stdout.
- **Exit 1, CLI not installed**: stderr names the missing dep. Report and stop.
- **Exit non-zero, GitError**: typically a missing base branch. Report and stop.
