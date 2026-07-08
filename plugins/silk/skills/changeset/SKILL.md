---
name: changeset
description: >
  The one changeset command. /silk:changeset --create|--squash|--list|
  --preview|--check. Create/reconcile or squash changesets (via the
  changeset-manager agent), validate them, preview the CHANGELOG, or list
  what's pending. A bare or vague invocation defaults to create/reconcile.
when_to_use: >
  "I need a changeset", "draft/add a changeset", "reconcile changesets",
  "do I need a changeset for this branch", "squash/combine/merge changesets",
  "validate/check/lint changesets", "are my changesets valid", "preview the
  changelog", "what will the release notes look like", "list changesets",
  "what's pending for release", "version bump"
argument-hint: "--create | --squash | --list | --preview | --check [mode flags]"
allowed-tools: Agent, mcp__plugin_silk_savvy-mcp__changeset_validate, mcp__plugin_silk_savvy-mcp__changeset_preview, Bash(bash *)
---

# Changeset (router)

The user invoked `/silk:changeset` with arguments: `$ARGUMENTS`

Parse the leading flag off `$ARGUMENTS` and dispatch per the table below. Everything after the leading flag is mode-specific arguments — pass it through verbatim to whichever tool or agent handles that mode.

## Dispatch table

| Flag | What to do |
| --- | --- |
| `--create` | Dispatch the `changeset-manager` agent (`subagent_type: silk:changeset-manager`) in **create** mode. Pass the remaining arguments (`--require`, `--package <name>`, `--bump patch\|minor\|major`, `--dry-run`) through verbatim. |
| `--squash` | Dispatch the `changeset-manager` agent (`subagent_type: silk:changeset-manager`) in **squash** mode. Pass the remaining arguments (`branch\|all`, `--package <name>`, `--dry-run`) through verbatim. |
| `--check` | Call the `mcp__plugin_silk_savvy-mcp__changeset_validate` MCP tool directly. No CLI script — this mode owns validation itself. |
| `--preview` | Call the `mcp__plugin_silk_savvy-mcp__changeset_preview` MCP tool directly. |
| `--list` | Run `bash "${CLAUDE_PLUGIN_ROOT}/skills/changeset/scripts/list.sh"` and summarize its output. |

No flag recognized (bare invocation, or an auto-triggered call whose phrasing doesn't map cleanly) → **default to create/reconcile** (see below). Only print the flag menu if the request is explicitly asking for something else that can't be inferred from the phrase table.

## --create: create / reconcile

Dispatch the `changeset-manager` agent in **create** mode. The agent owns the discover-and-decide logic — your job is to hand off the arguments verbatim and report the agent's result back to the user.

Use the `Agent` tool with `subagent_type: silk:changeset-manager` and a prompt that includes:

1. **Mode**: `create`
2. **Arguments received from the user**: the remainder of `$ARGUMENTS` after `--create`
3. **Reminder**: apply the exclusion rules (AI context documents, internal design docs, trivial doc tweaks alongside code, behavior-neutral config) and the depth guidance from the agent's system prompt. The goal is release documentation, not a changelog of the diff.

Argument semantics:

| Flag | Effect |
| --- | --- |
| `--require` | Assert that a changeset must exist for this branch even if the agent's judgment is "no changeset needed." Creates a conservative-bump entry for the most-affected package. |
| `--package <name>` | Restrict the action set to the named package(s). Repeatable; also accepts comma-separated. |
| `--bump patch\|minor\|major` | Override the agent's auto-classification. |
| `--dry-run` | Print the plan as a table; write nothing. |

If no mode flags remain, the agent runs with full discretion: it discovers what exists, diffs against the base branch, classifies the work, and acts on its own judgment. It will ask only when ambiguity affects the public release surface.

When the agent finishes, surface its report to the user: files created/updated/deleted, packages classified and their assigned bump types, categories of change deliberately skipped, and any questions the agent needed to ask. Do not editorialize the result — the agent's own summary is the source of truth.

## --squash: consolidate

Dispatch the `changeset-manager` agent in **squash** mode. Hand off the arguments verbatim. The agent owns the merge mechanics — your job is the handoff and the report-back.

Use the `Agent` tool with `subagent_type: silk:changeset-manager` and a prompt that includes:

1. **Mode**: `squash`
2. **Arguments received from the user**: the remainder of `$ARGUMENTS` after `--squash`
3. **Explicit rule**: if the requested scope (`branch` or `all`) finds nothing to squash, the agent must report that and stop. It must **not** silently widen the scope.

Argument semantics:

| Positional / flag | Effect |
| --- | --- |
| `branch` (default if omitted) | Squash only changesets that were added in this branch — files present in `.changeset/` on HEAD but not at the merge-base with the default branch. |
| `all` | Squash every pending changeset in `.changeset/`, including those that predate this branch. |
| `--package <name>` | Restrict squashing to groups whose mapping includes the named package. Repeatable. |
| `--dry-run` | Print the plan (sources → target → frontmatter) as a table; do not write or delete. |

Two changesets can squash only if their package-to-bump-type mappings are identical. The agent groups by that mapping, then merges content section-by-section.

When the agent finishes, report: groups squashed (sources → target filename), files removed, files created, anything skipped (single-member groups, `--package` filter exclusions, branch-scope yielded nothing). If the scope yielded nothing, pass the agent's report through without paraphrasing as "no work to do" — the user may want to retry with `all`.

## --check: validate

Call the `mcp__plugin_silk_savvy-mcp__changeset_validate` MCP tool. It returns typed CSH001–CSH005 diagnostics — no stdout to parse, no bundled CLI script involved.

Present the diagnostics grouped by file: rule code, message, and location. If there are no violations, report that every changeset passed. If `.changeset/` has no pending files, report "nothing to validate."

Do not attempt to validate changesets by hand as a fallback if the tool errors — report the error; the MCP tool is the source of truth and a hand-rolled check would diverge from the CLI's actual rules.

## --preview: render the CHANGELOG

Call the `mcp__plugin_silk_savvy-mcp__changeset_preview` tool. Pass `cwd` only if you need to target a workspace other than the current directory. This is read-only; nothing is written.

The tool runs the real changesets release engine against the pending `.changeset/` files in a throwaway directory and returns:

- `releases[]` — per package: `name`, `type` (major/minor/patch), `oldVersion`, `newVersion`, `changesetIds`, and `changelogEntry` (the rendered, transformed CHANGELOG block, dependency tables included).
- `changesets[]` — the parsed pending changesets.
- `preMode` — the pre-release mode, if active.

The tool already returns a formatted markdown transcript in its text content: a "Version bumps" table followed by each package's release notes. Present that to the user as-is. If they ask for detail on a specific package, read that package's `changelogEntry` from the structured content. If `releases` is empty, report "No pending changesets" and stop.

> **Preview reflects the working tree.** Changeset files are not yet committed, so author and PR links won't resolve until release. `savvy changeset version` run at this same point has the identical gap, so content and ordering match what ships.

## --list: overview

Use the Bash tool:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/skills/changeset/scripts/list.sh"
```

The script:

- Resolves project dir and package manager the same way the other plugin scripts do.
- Invokes `<pm> exec changeset status --output=<tmpfile>` to capture structured JSON.
- Pass-through prints the JSON to stdout, with stderr noise from the CLI suppressed.

The JSON has two top-level keys:

| Key | Shape |
| --- | --- |
| `changesets` | Array of `{ id, summary, releases: [{ name, type }], packageJson?, … }` — one entry per `.changeset/*.md`. |
| `releases` | Array of `{ name, type, oldVersion?, newVersion?, changesets: [<id>, …] }` — one entry per package that will be bumped, with cross-references to which changesets contribute. |

Present a human-readable summary:

1. Total count of pending changesets.
2. For each release: package name, bump type, the list of changeset ids contributing, and a one-line summary of each.
3. Any packages that appear in multiple changesets — call them out as candidates for `/silk:changeset --squash`.

Empty / missing cases: an empty `changesets` array means "No pending changesets," a `{"note":"no .changeset/ directory"}` payload means report that, and a non-zero exit with "CLI is not installed" means report that and suggest installing `@changesets/cli`. Concise output: one row per changeset and per release, file paths relative to the project root, count first, then rows, then squash hints.

## Default: no recognized flag

If `$ARGUMENTS` has no leading `--create`/`--squash`/`--check`/`--preview`/`--list` flag — including a bare `/silk:changeset` — default to **create/reconcile**: dispatch the `changeset-manager` agent in create mode exactly as described under `--create`, treating the entirety of `$ARGUMENTS` (if any) as create-mode arguments.

Only fall back to printing the flag menu (`--create | --squash | --list | --preview | --check`) when the request is explicitly asking for a different kind of action that genuinely cannot be inferred — for example an ambiguous "do something with changesets" with no other signal. Prefer inferring from the phrase table below over asking.

## Phrase → mode table (for auto-triggered / vague invocations)

| User said something like… | Mode |
| --- | --- |
| "preview the changelog", "what will the release notes look like", "show me what the CHANGELOG would say" | `--preview` |
| "validate changesets", "are these valid", "check changeset format", "any CSH violations" | `--check` |
| "what's pending", "list changesets", "what's queued for release", "show me the changesets" | `--list` |
| "squash/combine/merge/consolidate changesets", "fold these together", "too many changesets" | `--squash` |
| "I need a changeset", "draft/add a changeset", "reconcile with the diff", "do I need a changeset for this branch", everything else | `--create` (default) |
