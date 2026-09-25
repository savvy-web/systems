---
type: Interface
title: savvy-mcp tool surface
description: "The ten savvy-mcp tools an agent calls: purpose, inputs, what each returns, and whether it is read-only or mutating — the consumer-visible contract, independent of the silk-effects service behind each one."
status: draft
kind: mcp
resource: ../../packages/mcp/src/toolkit.ts
tags: [tooling]
sources:
  - id: mcp-tools
    resource: ../../packages/mcp/src/toolkit.ts
  - id: mcp-server
    resource: ../../packages/mcp/src/server.ts
  - id: issue-688
    resource: https://github.com/savvy-web/systems/issues/688
  - id: mcp-changeset-tools
    resource: ../../packages/mcp/src/tools
  - id: mcp-biome-check
    resource: ../../packages/mcp/src/tools/biome-check.ts
  - id: mcp-repos-tools
    resource: ../../packages/mcp/src/tools
generated:
  by: okfit/claude-code
  at: 2026-09-25T03:02:46Z
  body_sha256: 36765af19cbca48c4d6d968f12d30f27fc3e59808cd715fc6ce504a7b27f5982
---

# savvy-mcp tool surface

## The shared shape

A successful call returns the typed result object in `structuredContent`,
and `content[0].text` carries that same object serialized as JSON — there is
no prose rendering. A tool's `structuredContent` shape is a silk-effects
result schema embedded unchanged (or a documented flat projection); that
schema is the contract to depend on, and the text channel never says more or
less than it.[^mcp-server] A failed call is an `isError` result whose
`content[0].text` carries the failure message with its remediation, and no
`structuredContent`.[^mcp-server]

Claude Code hands the model only `structuredContent` when a result carries
one, which is why the result is shaped for it. A client that instead displays
`content` to a human (Cursor, Copilot, MCP Apps hosts) shows the raw JSON;
that is an accepted trade-off, revisited if MCP adopts per-audience result
variants (SEP-3279).[^issue-688]

Every tool
carries all four MCP hints (`readOnlyHint`/`destructiveHint`/`idempotentHint`/
`openWorldHint`); seven of the ten are read-only and idempotent, three are
documented mutating exceptions.[^mcp-tools]

## workspace_info — read-only

Wraps workspace analysis. Returns a **flat, non-recursive** projection:
`linked`/`fixed` collapse to arrays of workspace names, `targets` to
registry URL strings. A consumer should not expect the richer recursive
shape the underlying analyzer can produce internally — this is a
deliberate, permanent simplification, not an omission to work around.[^mcp-tools]

## turbo_inspect — read-only

Read-only Turborepo introspection; every path runs `turbo … --dry=json` and
never executes a task. Result is a **discriminated union keyed by `mode`**
(`cache` | `graph` | `affected`), each variant embedding the corresponding
Turbo result schema unchanged. Being union-rooted, it serves no
`outputSchema` — read the typed `structuredContent` variant instead.[^mcp-tools]

## changeset_inspect — read-only

Discriminated union keyed by `mode`: `branch` (diff-against-base file
classification, with `packagesAffected` and unmapped paths to ask about),
`config` (the resolved `.changeset/config.json`), `classify` (arbitrary
paths → owning package). An unmapped path may carry a machine-readable
`unmappedHint`. Every call re-checks on-disk edits made since the last call
against the specific root inspected — a consumer should never need to call
this twice to see a change land.[^mcp-changeset-tools]

## changeset_validate — read-only

Validates `.changeset/*.md` (or a given `dir`) against the changeset format
rules. Returns typed diagnostics plus `ok` and `errorCount`. The structured
counterpart to `savvy changeset lint`.[^mcp-changeset-tools]

## changeset_preview — read-only

Runs the real changesets engine over pending `.changeset/` files against a
throwaway temp directory — **never mutates the repo** — and returns each
package's version bump plus the CHANGELOG block exactly as it would ship.
There is no corresponding "apply" tool; a release stays a CLI operation a
human runs (`savvy changeset version`), by design.[^mcp-changeset-tools]

## changeset_deps_detect — read-only

Read-only: computes the pure-dependency changeset plan for the current diff
(devDependencies included, `catalog:`/`workspace:` specifiers resolved) and
touches no file. Returns each affected package's resolved dependency-table
rows plus a `coexisting` list of untouched prose-only changesets referencing
an in-scope package.[^mcp-changeset-tools]

## changeset_deps_regen — mutating, destructive

Computes the same plan and, unless `dryRun` is set, executes it: deletes
only the single-package dependency-only changesets it plans to replace
(never a mixed changeset) and writes fresh ones from the current diff.
Each write lands at a stable, package-derived path —
`.changeset/<scope>-<name>-deps.md` (unscoped: `<name>-deps.md`) — when
that path is free: absent, or a pure-dependency changeset for the same
package authored on this branch, which a re-run overwrites in place so an
unchanged diff produces no file churn. A path that is not free is skipped
to the first free deterministic sibling (`…-deps-2.md`, `-3.md`) and never
overwritten: a file present at the merge base (an earlier, merged-but-
unreleased regen whose rows the changelog aggregates at release), a prose
or mixed changeset, another package's file, or a name already claimed in
the same plan. Any legacy random-named pure-dependency changeset for that
package is deleted on the first regen that rewrites it. The merge-base
guard (#258) therefore holds on both paths: a changeset present at the
merge base is neither deleted nor overwritten. A bare call with `dryRun: true` only computes the plan and
writes nothing. Every write lands under `.changeset/*.md` and is
git-reversible.[^mcp-changeset-tools]

## biome_check — mutating, not destructive

A thin proxy over the Biome CLI, not a silk-effects service — the only tool
whose handler yields no service. `write`/`unsafe` apply fixes; both default
off, so a bare call only reads and reports. Fix-then-validate: when either
flag is set it runs a fix pass, then always runs a read pass reporting what
remains. Severities in the result are Biome's own project-configured
severities (`error`/`warning`/`info`) — a consumer should trust them as-is
rather than re-deriving; `strict` is the only parameter that promotes a
warning to an error, and a promoted diagnostic keeps its
`originalSeverity` alongside the promotion. Writes are confined to source
files under the resolved containment root (the server's own root, or a
sibling worktree of the same repository when `cwd` names one) — never
outside it, and never `.repos/**`.[^mcp-biome-check]

## repos_inspect — read-only

Discriminated union keyed by `mode`: `status` (per-repo presence, dirtiness,
commit triple), `config` (the validated `.repos/config.json` manifest),
`drift` (five-authority reconciliation, returning every disagreement as a
typed entry), `gitmodules` (decoded `.gitmodules` sections). `gitmodules` is
the one mode that never fails on bad input — an unparsable or absent file
returns empty entries plus an optional `parseError`, since "the file is
broken" is itself the answer an agent inspecting it needs.[^mcp-repos-tools]

## repos_manage — mutating, destructive

One `action`-discriminated tool over the whole vendored-repo lifecycle:
`sync`, `pin`, `add`, `note`, `remove`, `rename`, `restore`, `deregister`.
The wire schema is a flat `action` enum plus optional fields (each action's
required fields are named in the tool description and enforced on decode).
`restore` is explicitly destructive to uncommitted worktree edits — its
description says so outright. `pin`, `remove`, and `rename` leave staged,
uncommitted changes for the caller to review and commit; `deregister`
touches only local git config and stages nothing. This is the only path
that leaves a vendored tree correctly locked afterward — a consumer should
never mutate `.repos/**` by any other route.[^mcp-repos-tools]

## What a consumer must not assume

- Do not expect a readable transcript in `content[0].text`; it is the
  `structuredContent` object as JSON, so read `structuredContent` for fields.
- Do not infer read-only behavior from a tool's name alone — check the
  hints (`readOnlyHint`/`destructiveHint`) or this document.
- Do not expect `outputSchema` on a union-rooted result (`turbo_inspect`,
  `changeset_inspect`, `repos_inspect`, `repos_manage`); read the typed
  `structuredContent` instead.
- Do not treat `biome_check`'s bare call (no `write`/`unsafe`) as anything
  other than read-only, and do not expect it to reach outside its
  containment root even when asked.
- Do not expect `changeset_deps_regen` to touch a mixed changeset, or
  `repos_manage restore` to leave uncommitted work intact.

## Related

- [`modules/mcp.md`](../modules/mcp.md) — the server this tool surface is
  part of.
- [`conventions/mcp-tool-authoring.md`](../conventions/mcp-tool-authoring.md)
  — how a tool is shaped and tested, for anyone adding one.
- [`conventions/biome-invocation.md`](../conventions/biome-invocation.md) —
  why `biome_check` is a sanctioned channel and direct Biome is denied.
- [`conventions/vendored-repos-handling.md`](../conventions/vendored-repos-handling.md)
  — why `repos_manage`/`savvy repos` are the only sanctioned mutation path
  for `.repos/**`.

[^mcp-tools]: `../../packages/mcp/src/toolkit.ts`
[^mcp-server]: `../../packages/mcp/src/server.ts`
[^issue-688]: <https://github.com/savvy-web/systems/issues/688>
[^mcp-changeset-tools]: `../../packages/mcp/src/tools` (the five `changeset_*` tool modules)
[^mcp-biome-check]: `../../packages/mcp/src/tools/biome-check.ts`
[^mcp-repos-tools]: `../../packages/mcp/src/tools` (`repos-inspect.ts` and `repos-manage.ts`)
