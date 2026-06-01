---
name: changeset-check
description: >
  Validate existing changeset files in .changeset/ against @savvy-web/changesets
  format rules. Checks structural compliance with CSH001-CSH005 rules and
  reports errors with file paths and rule codes.
when_to_use: >
  "validate changesets", "check changeset format", "lint my changesets",
  "are my changesets valid", "did I write the changesets correctly",
  "verify changeset structure", "any CSH violations in .changeset/?"
model: sonnet
allowed-tools: Bash(bash *)
---

# Validate Pending Changesets

This skill wraps the `savvy-changesets` CLI to validate every changeset in `.changeset/` against CSH001–CSH005. The CLI is assumed to be installed in the project as a dev dependency (it is, by definition — this plugin ships alongside that package).

## Default: human-readable summary

Run the bundled `check.sh` script:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/changeset-check/scripts/check.sh"
```

The script:

- Resolves the project directory from `SILK_PROJECT_DIR` (set by SessionStart) or `CLAUDE_PROJECT_DIR`, falling back to the current working directory.
- Detects the package manager from `SILK_PACKAGE_MANAGER`, `package.json#packageManager`, or lockfile presence.
- Invokes `<pm> exec savvy-changesets check .changeset`.
- Pass-through prints the CLI's output. Exit code 0 = all clean; non-zero = violations found.

Present the script's stdout to the user verbatim — it is already formatted for human consumption with file paths and rule codes.

## When you need machine-parseable output

If you intend to programmatically act on findings — for example, to invoke the `update` skill on each failing file — use the `lint.sh` script instead. It emits `file:line:col` format that's easy to parse:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/changeset-check/scripts/lint.sh"
```

## When the CLI is not installed

Both scripts exit with code 1 and a clear error message ("savvy-changesets CLI is not installed in `<dir>`") when the CLI cannot be resolved. Report this to the user and suggest installing `@savvy-web/changesets` as a dev dependency. Do not attempt to validate changesets manually as a fallback — the CLI is the source of truth and a hand-rolled validation would diverge.

## When there are no changesets

The scripts handle a missing `.changeset/` directory gracefully and report "nothing to validate." Pass that through to the user.
