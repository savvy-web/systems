---
name: config
description: >
  Surface the project's .changeset/config.json and the branch's
  diff-with-classification via two thin wrappers around the
  savvy CLI (@savvy-web/cli). The agent uses these to get reliable
  package attribution without re-implementing the logic.
user-invocable: false
model: sonnet
allowed-tools: Bash(bash *)
---

# Inspect Changeset Configuration

This is an agent-internal skill. Two bundled scripts wrap the
`savvy` CLI (`@savvy-web/cli`):

- **`scripts/inspect.sh`** — `savvy changeset config show --json`. Returns
  the resolved config: changelog formatter, base branch, ignore list, and
  per-package release surfaces (with `additionalScopes`, `versionFiles`,
  and the materialized file lists).
- **`scripts/analyze-branch.sh`** — `savvy changeset analyze-branch --json`.
  Returns the merge-base SHA, the per-file diff classification, the deduped
  set of affected packages, and the list of unmapped paths the agent
  should ask the user about.

In 0.9.0+ the **primary** call is `analyze-branch.sh` — one invocation
gives the agent everything it needs for create-mode classification.
`inspect.sh` remains available for debugging or for commands that don't
need a diff (e.g., a release-surface lookup before the user has any
diff to analyze).

## Primary path: `analyze-branch.sh`

Use the Bash tool:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/config/scripts/analyze-branch.sh"
```

Pass `--base <branch>` (or other CLI flags) as positional args to override
auto-detection:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/config/scripts/analyze-branch.sh" --base develop
```

Output schema (matches `BranchAnalysis` in the CLI source):

| Field | Shape | Meaning |
| --- | --- | --- |
| `baseBranch` | string | The branch the diff was computed against. |
| `mergeBaseSha` | string | Merge-base SHA between `HEAD` and `baseBranch`. |
| `files[]` | array | One entry per changed file. |
| `files[].path` | string | Repo-relative path (new path on rename). |
| `files[].status` | string | `"added"` / `"modified"` / `"deleted"` / `"renamed"` / `"copied"` / `"typechange"` / `"unmerged"` / `"unknown"`. |
| `files[].package` | string \| null | Owning package, or `null` if outside every known release surface. |
| `files[].reason` | object \| string \| null | `"workspace"` / `{kind:"additionalScope", glob}` / `{kind:"versionFile", glob}` / `null`. |
| `packagesAffected[]` | string[] | Unique package names that own at least one changed file. |
| `unmappedFiles[]` | string[] | Files whose `package` is `null` — **ask the user about these**. |

### How the agent uses the output

1. **Skip the manual diff step.** `files[]` already carries status + classification.
2. **Skip the workspace lookup step.** `package` and `reason` are pre-resolved by `ConfigInspector`.
3. **For every entry in `files[]`** — apply the five exclusion categories (AI context, internal design docs, trivial doc-with-code, behavior-neutral config, routine churn). Files that survive the exclusion filter and have a non-null `package` go into the reconcile step.
4. **For every entry in `unmappedFiles[]`** — invoke `AskUserQuestion` to find out whether the path belongs to a package's release surface. Do not invent a "not a release surface" exclusion.

## Secondary path: `inspect.sh`

When the agent needs the config independently of a diff — for example, to
render a release-surface list for a specific package, or to confirm that
the config validates after a manual edit — use:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/config/scripts/inspect.sh"
```

Output schema (matches `InspectedConfig` in the CLI source):

| Field | Meaning |
| --- | --- |
| `configPath` | Absolute path of `.changeset/config.json`. |
| `projectDir` | Absolute project root. |
| `changelog` | The changelog formatter ID. |
| `baseBranch` | Base branch from the config. |
| `access` | npm access level (`"public"` / `"restricted"`). |
| `ignore[]` | Packages the changeset workflow ignores. |
| `packages[]` | Per-package release surfaces (see below). |
| `legacyVersionFilesUsed` | `true` when the deprecated 0.8.x shape is still in use; the CLI emits a one-line deprecation warning to stderr on the same run. |

`packages[]` entry:

| Field | Meaning |
| --- | --- |
| `name` | Package name (matches `package.json#name`). |
| `workspaceDir` | Absolute path to the package's workspace directory. |
| `version` | Current `package.json#version`. |
| `additionalScopes[]` | Globs declared in the config. |
| `additionalScopeFiles[]` | Materialized absolute file paths. |
| `versionFiles[]` | Per-entry: `{ glob, paths, matchedFiles }`. |

## Error handling

Both scripts propagate the CLI's exit code:

- **Exit 0**: JSON document on stdout.
- **Exit 1, CLI not installed**: stderr says so. The agent should report that `@savvy-web/cli` must be installed in the project (it provides the `savvy` binary) and stop.
- **Exit non-zero, ConfigurationError or GitError**: stderr has a structured message from the CLI (overlap conflict, unknown package, dual-shape, missing base branch, etc.). The agent should report the message to the user and stop — these are real configuration problems the user must fix.

## What this skill does not do

- It does not classify files. The CLI does that via `ConfigInspector.classify`; this skill is the agent's window onto the result.
- It does not infer release surfaces. The trust boundary is the config file: `pnpm-workspace.yaml` defines workspace packages, `.changeset/config.json#packages[*].additionalScopes` defines linked surfaces, and anything outside both gets reported in `unmappedFiles` for the agent to ask about.
- It does not modify the config. Treat it as read-only — use `/silk:changeset-create` or direct edits to make changes.
