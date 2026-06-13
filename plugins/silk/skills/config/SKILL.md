---
name: config
description: >
  Surface the project's .changeset/config.json and the branch's
  diff-with-classification via the changeset_inspect MCP tool
  (savvy-mcp). The agent uses these to get reliable package
  attribution without re-implementing the logic.
user-invocable: false
model: sonnet
allowed-tools: mcp__plugin_silk_savvy-mcp__changeset_inspect mcp__plugin_silk_savvy-mcp__changeset_validate
---

# Inspect Changeset Configuration

This is an agent-internal skill. It calls the `changeset_inspect` MCP tool
(provided by the shared `savvy-mcp` server) in two modes:

- **`mode: "branch"`** — returns the merge-base SHA, the per-file diff
  classification, the deduped set of affected packages, and the list of
  unmapped paths the agent should ask the user about. This is the primary
  call for create-mode classification.
- **`mode: "config"`** — returns the resolved config: changelog formatter,
  base branch, ignore list, and per-package release surfaces (with
  `additionalScopes`, `versionFiles`, and the materialized file lists).
  Available for debugging or for commands that don't need a diff (e.g., a
  release-surface lookup before the user has any diff to analyze).

## Primary path: `mode: "branch"`

Call the `mcp__plugin_silk_savvy-mcp__changeset_inspect` tool with:

```json
{ "mode": "branch" }
```

Pass `base` to override auto-detection:

```json
{ "mode": "branch", "base": "develop" }
```

Output schema (`BranchAnalysis` shape in `structuredContent`):

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

## Secondary path: `mode: "config"`

When the agent needs the config independently of a diff — for example, to
render a release-surface list for a specific package, or to confirm that
the config validates after a manual edit — call the tool with:

```json
{ "mode": "config" }
```

## Tertiary path: `mode: "classify"`

When the agent needs to map one or more arbitrary repo paths to their owning
package — for example, a path the user references directly that does not appear
in the branch diff, or a file outside the diff that should be attributed before
asking via `AskUserQuestion` — call the tool with:

```json
{ "mode": "classify", "paths": ["path/to/file.ts", "another/path.ts"] }
```

The tool applies the same workspace-lookup and `additionalScopes`/`versionFiles`
resolution as `mode: "branch"` but against the supplied path list rather than the
git diff. Returns a flat array of `{ path, package, reason }` entries in input
order — there is no separate `unmappedPaths[]` field. Entries whose `package` is
`null` are unmapped (outside every known release surface); use those to decide
whether to invoke `AskUserQuestion`. This mode is not a replacement for the
branch-diff pass.

Output schema (`InspectedConfig` shape in `structuredContent`):

| Field | Meaning |
| --- | --- |
| `configPath` | Absolute path of `.changeset/config.json`. |
| `projectDir` | Absolute project root. |
| `changelog` | The changelog formatter ID. |
| `baseBranch` | Base branch from the config. |
| `access` | npm access level (`"public"` / `"restricted"`). |
| `ignore[]` | Packages the changeset workflow ignores. |
| `packages[]` | Per-package release surfaces (see below). |
| `legacyVersionFilesUsed` | `true` when the deprecated 0.8.x shape is still in use; the MCP server emits a deprecation note alongside the result. |

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

The tool surfaces errors as MCP tool errors (no exit codes, no stderr to
parse). Two error types may appear:

- **`ConfigurationError`** — overlap conflict, unknown package, dual-shape,
  or invalid config. The agent should report the error message to the user
  and stop — these are real configuration problems the user must fix.
- **`GitError`** — missing base branch or git command failure. The agent
  should report the error message and stop.

There is no "CLI not installed" branch — the MCP server ships the
implementation and is always available when the session is running.

## What this skill does not do

- It does not classify files. The MCP tool does that via `ConfigInspector.classify`; this skill is the agent's window onto the result.
- It does not infer release surfaces. The trust boundary is the config file: `pnpm-workspace.yaml` defines workspace packages, `.changeset/config.json#packages[*].additionalScopes` defines linked surfaces, and anything outside both gets reported in `unmappedFiles` for the agent to ask about.
- It does not modify the config. Treat it as read-only — use `/silk:changeset-create` or direct edits to make changes.
