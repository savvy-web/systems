---
status: needs-review
module: github-actions
category: architecture
created: 2026-07-23
updated: 2026-07-27
last-synced: 2026-07-27
completeness: 85
related:
  - ../silk/plugin.md
  - ../_archive/github-action-effects/index.md
  - ../github-action-builder/architecture.md
  - ../mcp/architecture.md
dependencies: []
---

# plugins/github-actions — the action-engineering Claude Code plugin

The `github-actions@savvy-web-systems` Claude Code plugin. A single specialist agent (`action-engineer`) over a
twelve-skill suite that teaches building Node.js 24 GitHub Actions on `@savvy-web/github-action-effects` and
`@savvy-web/github-action-builder`, plus a SessionStart orientation hook and the same shared `savvy-mcp` server the
silk plugin spawns.

## Table of Contents

- [Overview](#overview)
- [Current State](#current-state)
- [The action-engineer agent](#the-action-engineer-agent)
- [Skill suite](#skill-suite)
- [Vendored references and provenance](#vendored-references-and-provenance)
- [Verification discipline](#verification-discipline)
- [Source access outside the monorepo](#source-access-outside-the-monorepo)
- [MCP wiring and orientation](#mcp-wiring-and-orientation)
- [Hook surface](#hook-surface)
- [Tests](#tests)
- [Relationship to the silk plugin](#relationship-to-the-silk-plugin)
- [Versioning and release scope](#versioning-and-release-scope)
- [Rationale](#rationale)

## Overview

`plugins/github-actions` is the companion plugin for the action toolchain — `@savvy-web/github-action-effects`
(Effect v4 services replacing every `@actions/*` package) and `@savvy-web/github-action-builder` (rsbuild →
single-file Node 24 ESM under a committed `dist/`). Like `plugins/silk` it is **authored and bundled** in this
monorepo (plugins are static, not runtime-discovered) and registered as a **local** entry in
`.claude-plugin/marketplace.json` (`source: "./plugins/github-actions"`).

**Location:** `plugins/github-actions` in `savvy-web/systems`
**Marketplace name:** `github-actions@savvy-web-systems`

Its scope boundary is deliberate: it engineers *actions*. It does not own the org-level reusable workflows (those
live in `savvy-web/.github`), does not restructure a host monorepo, and hands substantially generic Effect work
(a new library service, a v3→v4 migration) back to the matching effected-plugin agent rather than absorbing it.

**The audience is a standalone action repo, not this monorepo.** The reading agent is assumed to be working in a
repo cloned from `savvy-web/github-action-template`, with the two libraries present only as installed packages
under `node_modules/@savvy-web/` — this monorepo is not checked out, and neither are the production action repos
the house style was distilled from. Every skill and reference is written to that assumption: no sibling-repo
names, no `file:line` citations into repos the reader cannot open, no "which repo canonizes what" tables. See
[Written for a standalone action repo](#written-for-a-standalone-action-repo) for the consequences that shape.

## Current State

> **Removed from the repo (2026-07-26).** Commit `670cd115` deleted `plugins/github-actions/` and its `.claude-plugin/marketplace.json` entry, and the root `pnpm test:hooks` script no longer runs its test runner (the stale leg was dropped once the removal left it broken). This doc is now the record of the plugin as last shipped — read the present tense below as historical. The kit-migration pass described in the next note never landed; if an action-engineering plugin returns re-pointed at the `@effected/*` kit, this record is its starting point.
>
> **Stale against the `@effected` github-split, and tracked.** Every skill, reference and the orientation hook
> still teach `@savvy-web/github-action-effects`, which was **deleted from this repo** in the github-split
> adoption. Action repos now consume `@effected/github-actions`, `@effected/github`, `@effected/sbom`,
> `@effected/npm` and `@effected/commands` directly, and savvy-specific action business logic is moving into
> `@savvy-web/silk-effects`. The plugin's content has not been migrated: its package-relative citations
> (`@savvy-web/github-action-effects@3.0.4`, the service catalog, the `*Test`-double topology, the `./testing`
> subpath) name a package a reader will not find in `node_modules`. Re-pointing the twelve skills at the kit is
> outstanding work and should be done as one deliberate pass — see the archived
> [`../_archive/github-action-effects/index.md`](../_archive/github-action-effects/index.md) for what the old
> surface was, and the `@effected` kit's own `.d.ts` for what replaces it. Until that lands, read every
> `github-action-effects` mention below as *the thing this plugin currently says*, not as current truth.

Implemented on branch `feat/github-actions-plugin`. Contents:

- **Manifest** (`.claude-plugin/plugin.json`): name, description, author/homepage/repository, keywords, and one
  `mcpServers.savvy-mcp` block. See [Versioning and release scope](#versioning-and-release-scope) — the `version`
  field is changeset-managed and never hand-edited.
- **Agent** (`agents/action-engineer.md`): the single specialist, preloading all twelve skills via the `skills:`
  frontmatter key and carrying a curated `tools:` allowlist. See
  [The action-engineer agent](#the-action-engineer-agent).
- **Skills** (`skills/`): twelve skills — one router (`action-engineering`) plus eleven topic skills — with sixteen
  bundled `references/` files across ten of them. See [Skill suite](#skill-suite).
- **MCP wiring** (`bin/start-mcp.sh`): byte-identical to the silk plugin's launcher, spawning the same shared
  `savvy-mcp` server. See [MCP wiring and orientation](#mcp-wiring-and-orientation).
- **Hooks** (`hooks/hooks.json`, `hooks/session-start/orientation.sh`, `hooks/lib/`): exactly one hook — an
  unmatched SessionStart orientation block, whose payload also carries the plugin's dogfood-feedback loop. See
  [Hook surface](#hook-surface) and [Dogfood feedback](#dogfood-feedback).
- **Tests** (`tests/`): a BATS + shellcheck suite mirroring silk's runner, formerly wired into the root `pnpm test:hooks` and the Hook Tests CI workflow (both legs removed with the plugin). See [Tests](#tests).

## The action-engineer agent

One agent, not a family of them. `agents/action-engineer.md` handles building, extending, debugging and reviewing
an action end to end; the orientation hook tells the main agent to prefer delegating a whole action-engineering
task to it rather than hand-rolling the work inline.

- **Skill preloading is `skills:`, not `tools:`.** The agent lists all twelve skills under the `skills:`
  frontmatter key so they arrive preloaded, and the bats suite exists specifically to pin that placement — a skill
  name in `tools:` satisfies any naive grep while never being loaded (see [Tests](#tests)).
- **The `tools:` allowlist is curated, never omitted.** Inheriting everything would undo the scoping. The
  frontmatter is the authoritative list; as of this writing it carries the file/search/authoring set (`Read`,
  `Write`, `Edit`, `Glob`, `Grep`, `Skill`, `ToolSearch`,
  `Bash`, `WebFetch`, `WebSearch`), the teammate/task set (`SendMessage`, `ReportFindings`, `TaskCreate`,
  `TaskUpdate`, `TaskList`, `TaskGet`), five savvy-mcp tools under the plugin-scoped
  `mcp__plugin_github-actions_savvy-mcp__` prefix (`workspace_info`, `biome_check`, `turbo_inspect`,
  `repos_inspect`, `repos_manage`), and three vitest-agent tools (`run_tests`, `test_errors`, `triage_brief`).
  `SendMessage` is mandatory, not decorative: a teammate-dispatched agent without it cannot report back or answer
  a `shutdown_request` and idle-loops until killed (savvy-web/systems#256, #263). The MCP prefix is
  per-plugin — the same server reached through the silk plugin carries `mcp__plugin_silk_savvy-mcp__` instead, so
  an allowlist entry copied between plugins silently names a tool that does not exist.
- **Prime directive: the installed source is the authority.** The brief carries no pattern-to-repo lookup table —
  a reader in a standalone action repo cannot open those repos. What it carries instead is the known-stale-doc
  list (see [Verification discipline](#verification-discipline)) and the standing rule that when docs and source
  disagree, the source wins and the disagreement gets reported. The complementary rule points the other way and
  is just as load-bearing: when a skill states a rule and the agent's instinct disagrees, **the skill wins until
  the installed source proves otherwise** — the skills exist precisely to override generic GitHub-Actions memory.
- **A three-rung authority ladder** is what a pattern lookup resolves against: (1) the installed packages under
  `node_modules/@savvy-web/`, where `src/index.ts` is the barrel and the authoritative export inventory; (2) the
  action repo itself, which started from `github-action-template` and carries working build/test wiring worth
  reading; (3) for anything deeper — library internals, upstream history — the silk plugin's `repos` capability to
  vendor `savvy-web/systems`, home of both libraries. See
  [Source access outside the monorepo](#source-access-outside-the-monorepo).
- **A fixed working order.** Route first through `action-engineering` (including what does *not* exist), start new
  actions from the template repo rather than `github-action-builder init`, design the input and output contracts
  before implementation, implement in the house style, and verify before reporting done — `pnpm typecheck`, then
  `CI=true pnpm ci:build` (which surfaces strict-mode validation), the tests (preferring the vitest-agent
  `run_tests` tool), an inspection of `dist/` for exactly the expected files, and a check of the built artifact
  for any runtime-computed dynamic import, because vitest, tsc and lint cannot see bundler-level regressions.
- **Reporting obligations.** It reports what it built, what it verified with the exact commands, anything it could
  not confirm against the installed packages, every doc/source disagreement it hit, and any gap or awkward API in
  the effects package or the builder — those are upstream improvement signals, never dropped.

## Skill suite

Twelve skills, in the roster order the orientation payload and the agent both use: `action-engineering`,
`scaffolding`, `builder-config`, `runtime-and-layers`, `inputs`, `outputs-and-schemas`, `github-app-auth`,
`github-api`, `checks-and-reports`, `logging`, `errors-and-state`, `testing-actions`.

- **Plain names, no tool prefix.** The silk plugin prefixes its user-facing skills because three merged tools share
  one namespace there; here the plugin namespace already disambiguates — `/github-actions:inputs` and
  `/github-actions:logging` cannot be confused with anything, so an `action-` prefix on every skill would be pure
  ceremony. All twelve are user-invokable.
- **`action-engineering` is the router, and it routes rather than teaches.** Its "I need to… → reach for…" table
  maps a job to the owning service *and* the owning skill; rows never carry the pattern itself. It also owns two
  things no topic skill can: the **absent-capability catalog** (no ANSI/color API, no `ActionInputs` service, no
  JSON-Schema generator in the library, no `@actions/io` cp/mv/rmRF/mkdirP wrappers, `action.yml`
  scaffolding/validation living in the builder not the effects package) and the cross-cutting facts every consumer
  inherits (the root-vs-`/testing` import seam, `effect` and `@effect/platform-node` staying peerDependencies in
  actions, secrets as `Redacted<string>` end to end, and `dist/` being committed and byte-reproducible). Both the
  agent brief and the orientation payload say to consult it first, precisely so the agent does not design
  something the catalog says is absent or already shipped.
- **Six skills carry `paths` triggers**, so the relevant one auto-loads when the agent opens the file it owns:
  `builder-config` (`**/action.config.ts`), `scaffolding` and `inputs` (`**/action.yml`), `runtime-and-layers`
  (`**/src/main.ts`, `**/src/pre.ts`, `**/src/post.ts`), `github-app-auth` (`**/src/pre.ts`, `**/src/post.ts`),
  and `outputs-and-schemas` (`**/lib/scripts/generate-schema.ts`, `**/*.schema.json`). Two path collisions are
  deliberate and mirror silk's `build`/`tsdoc` split: on `action.yml`, `scaffolding` owns the file's *conventions*
  while `inputs` owns the `inputs:` section; on `pre.ts`/`post.ts`, `runtime-and-layers` owns entry-point and
  layer *shape* while `github-app-auth` owns the token *lifecycle* that lives in those phases.
- **The remaining six are description-triggered and on-demand** (`action-engineering`, `github-api`,
  `checks-and-reports`, `logging`, `errors-and-state`, `testing-actions`) — they answer questions that have no
  single backing file, so a `paths` trigger would have nothing honest to match.
- **Every skill's `description` records the exact version it was verified against**
  (`@savvy-web/github-action-effects@3.0.4`, `@savvy-web/github-action-builder@2.0.4`) — a version, never a repo
  name, so the claim stays checkable from `node_modules`. Every `when_to_use` block is written as the
  phrases a user actually types, including error strings (`Cannot find module at runtime in an action`,
  `Critical dependency: the request of a dependency is an expression`, `type error: R is not never`), so the
  routing works from a symptom, not just from a concept.

The roster, with what each skill owns and how it triggers (the directory is the authoritative list):

| Skill | Owns | Trigger |
| --- | --- | --- |
| `action-engineering` | job → service → skill routing, absent capabilities, cross-cutting facts | description |
| `scaffolding` | new actions from the template repo, `action.yml` conventions, `src/` layout | `**/action.yml` |
| `builder-config` | `defineConfig`, externals vs ignore vs nativeDynamicImports, verify steps | `**/action.config.ts` |
| `runtime-and-layers` | `Action.run` semantics, entry shapes, `MainLive`, `Layer.orDie`, tiers | `**/src/{main,pre,post}.ts` |
| `inputs` | `Config`/`ActionInput` at point of use, YAML 1.2 booleans, `inputs.ts` | `**/action.yml` |
| `outputs-and-schemas` | annotated Schema contracts, generated + drift-tested JSON Schema, `setJson` | schema paths |
| `github-app-auth` | provision → client → dispose, `REQUIRED_PERMISSIONS`, token-input bridge | `**/src/{pre,post}.ts` |
| `github-api` | `GitHubClient`, pagination, resilience, derived services | description |
| `checks-and-reports` | check runs, job summaries, sticky comments, `GithubMarkdown`/`ReportBuilder` | description |
| `logging` | the `Step` namespace, decision-log doctrine, emoji vocabulary | description |
| `errors-and-state` | tagged-error house style, demote vs die, `ActionState` bundles | description |
| `testing-actions` | `/testing` imports, library test layers, `ConfigProvider.fromUnknown` | description |

## Vendored references and provenance

Sixteen `references/*.md` files ship inside ten of the twelve skills (`inputs` and `errors-and-state` are
self-contained). Each opens with a **provenance banner** naming the source it was distilled from, the exact
package version, the date, and the standing instruction that on version skew the installed source wins.

Banner citations are **package-relative and readable from `node_modules`** — `@savvy-web/github-action-effects@3.0.4`
source at `src/services/*.ts`, `src/layers/*.ts`, `src/errors/*.ts`; `@savvy-web/github-action-builder@2.0.4` at
`src/schemas/config.ts`, `src/errors.ts` — never monorepo paths the reader cannot resolve. Where material came
from real actions rather than library source, the banner says **"production actions built on this stack"** and
nothing more: provenance without attribution, because naming a repo the reader cannot open is a dead pointer
dressed up as a citation. `real-world-configs.md` is the honest edge case — verbatim configs including their
comments (the comments *are* the institutional knowledge) "with action-specific identifiers neutralized".

The three under `action-engineering` are the load-bearing ones — `service-catalog.md` (all 39 services with APIs,
error types and layer requirements), `error-taxonomy.md` (all 41 tagged errors with verbatim field shapes) and
`toolkit-parity.md` (the `@actions/*` → effects substitution map) — and the router's reference map states when to
load each rather than leaving it to judgment.

Vendoring rather than linking is a deliberate editorial position: **agent docs are a harness, not expository user
documentation.** Their job is strong guidelines plus exploration pointers that survive being read out of order and
in fragments — dense tables, decision guides, absent-capability lists — which is a different artifact from the
package's own `docs/` even when both cover the same service. Vendoring also makes the plugin work in an action
repo that does not have the systems monorepo checked out. The provenance banner is what keeps that honest: it
converts an unavoidably-stale copy into a dated, versioned, re-verifiable one, and pairs with the source-over-docs
rule below.

## Verification discipline

Every skill and reference was written against the **installed package source**, not the packages' own
documentation, because several docs are known stale. The agent brief and `action-engineering` both carry the list
so the agent recognizes the trap instead of rediscovering it:

- The builder's README, `docs/` and `init` scaffold all show `GitHubAction.create()` as the config default export.
  That form silently decodes to all-defaults; the real form is `export default defineConfig({...})`.
- `build.target` and `build.quiet` are documented and do not exist; `validation.maxBundleSize` is declared but
  never enforced.
- The effects package's docs import `FetchHttpClient` from `@effect/platform`; the source imports it from
  `effect/unstable/http`.
- `Config.int` is the Effect v4 spelling; `Config.integer` does not exist, though the effects package's docs use
  it — the `inputs` skill carries the correction inline in its example.

The rule the plugin encodes from those cases is short: **when docs and source disagree, the source wins — and when
you find a new disagreement, report it.** `src/index.ts` is the authoritative export inventory, which is why the
authority ladder starts at the installed package rather than at any prose.

That rule cuts both ways: the vendored references are themselves a dated copy, and `@savvy-web/github-action-effects`
has since moved under two of them. `github-api`'s `references/service-signatures.md` still shows
`fn: (octokit: unknown)` for `GitHubClient.rest`/`paginate`/`paginateStream`, and `action-engineering`'s
`references/error-taxonomy.md` still lists `GitBranchError` as `branch`/`operation`/`reason` only. The package now
exports a `GitHubOctokit` type for those callbacks to be annotated with, and `GitBranchError` carries optional
`status`/`alreadyExists` fields (see `../_archive/github-action-effects/services.md` and
`../_archive/github-action-effects/errors-and-schemas.md`). Both are outstanding re-sync items for the vendored references —
recorded here rather than silently patched, because the provenance-banner mechanism is what is supposed to catch
this class of drift and a design doc is the right place to note when it has accrued.

## Source access outside the monorepo

The agent's authority ladder is (1) the installed packages under `node_modules/@savvy-web/`, (2) the action repo
itself — template-derived, with working build/test wiring — and (3), for what neither answers (library internals,
upstream history), the **silk plugin's `repos` capability**, loaded beside this one: `/silk:repos` plus the
`repos_inspect`/`repos_manage` MCP tools vendor `savvy-web/systems`, the home of both libraries, under `.repos/`
as read-only reference source. Vendored trees are never written to; silk's three PreToolUse tripwires enforce
that from the other side (see `../silk/plugin.md`). Both the agent brief and `action-engineering`'s own
"Source access" section state the same ladder, so it holds whether the agent arrived via delegation or via a
skill trigger.

That is a cross-plugin dependency accepted knowingly rather than duplicated: re-implementing a `repos` capability
here would mean two plugins racing to manage the same `.repos/` manifest. If the coupling proves awkward — an
action repo that loads this plugin without silk — the fix is to genericize the capability into something both
plugins can declare, not to fork it.

## MCP wiring and orientation

`.claude-plugin/plugin.json` declares the same `mcpServers.savvy-mcp` block as the silk plugin, spawning
`bin/start-mcp.sh` — a file byte-identical to silk's launcher (package-manager detection from
`packageManager`/lockfile, then `exec`ing `savvy-mcp` through it). Same server, same tools, different framing.

This is the information-vs-direction split applied a second time: **information lives in the MCP server, direction
lives in the plugin.** The server is shared and knows nothing about which plugin spawned it; each plugin's
orientation decides what its agent should reach for. So this plugin's `<mcp_tools>` block is short and
action-shaped — call `workspace_info` for workspace layout and package structure before shelling out or answering
from memory, and use `repos_inspect`/`repos_manage` as the sanctioned way to get read-only source access to
`savvy-web/systems` from an action repo — and it explicitly defers the full tool surface to the silk plugin's
documentation when both are loaded, rather than restating a ten-tool index that would drift.

## Hook surface

One hook: `hooks/session-start/orientation.sh`, registered in `hooks/hooks.json` as a single SessionStart entry
with **no matcher** (so it fires on every start including resume and compact) and a 5s timeout. There are no
PreToolUse guards, no PostToolUse validation and no Stop nudge — this plugin advises, it does not police, and
every enforcement surface in the ecosystem already lives in the silk plugin.

The payload is a single `<github_actions_plugin>` block, index-shaped:

- A framing paragraph: what the stack is, that the **installed package source outranks the packages' docs**
  (several known-stale), and that new actions start from `savvy-web/github-action-template` rather than
  `github-action-builder init`.
- An `<agents>` block preferring delegation of a whole action-engineering task to `action-engineer`, noting it
  arrives with every skill preloaded.
- A `<skills>` block naming all twelve with one-line summaries, opening with "consult `action-engineering` FIRST"
  and repeating the three headline absent capabilities inline — cheap insurance against designing a color API.
- The `<mcp_tools>` block described above, carrying the plugin-scoped prefix explicitly.
- A `<dogfood_feedback>` block. See [Dogfood feedback](#dogfood-feedback).

Mechanics: it sources the shared `hooks/lib/hook-output.sh` (identical to silk's) and `hook-debug.sh` (forked only
to renamespace the logs — `HOOK_LOG_PREFIX` defaults to `github-actions`, with `GITHUB_ACTIONS_HOOK_DEBUG` and
`GITHUB_ACTIONS_HOOK_ERROR_LOG`/`GITHUB_ACTIONS_HOOK_DEBUG_LOG` overrides — so the two plugins' hook logs never
interleave). It **fails open without `jq`**: `emit_context` needs it, so a missing `jq` logs a hook error, emits a
noop and exits 0 rather than aborting the session start. The SessionStart envelope is **drained, not parsed**
(`cat >/dev/null`) — the hook needs nothing from it, and draining rather than reading keeps arbitrary or empty
stdin from breaking the script under `set -euo pipefail`. Like silk's hooks, the scripts commit as `100644`: the
lint-staged ShellScripts handler strips the exec bit, and nothing needs it because `hooks.json` and the bats
runner both invoke them as `bash "${CLAUDE_PLUGIN_ROOT}/hooks/..."` (savvy-web/systems#289).

### Dogfood feedback

The payload's last block is `<dogfood_feedback>`, modeled on the effected plugin's equivalent and added because
this plugin is new enough that its own rough edges are the most valuable thing a session can produce. It asks the
main agent to keep a **running log** of plugin issues while it works — a skill giving wrong, unhelpful or
confusing guidance, guidance that contradicts the installed package source, a missing skill/reference/routing
entry, a hook firing at the wrong moment — and to instruct any subagent it dispatches (the `action-engineer`
above all) to flag the same kinds of findings and **report them back rather than dropping them**. At session end
it surfaces the log and asks the user whether to open improvement issues.

Three properties are deliberate:

- **The filing gate is hard, and marked as such.** Issues go to `savvy-web/systems` (where both libraries and
  this plugin live) via `gh issue create`, and **only** with the user's explicit agreement. That sentence is
  wrapped in its own `<important>` tag inside the block, separating the standing invitation to *notice* things
  from the one rule that must not be relaxed: never file on your own judgement, and never treat the block as
  standing permission. An agent filing issues unprompted is the failure mode being designed out, so the
  prohibition gets structural emphasis rather than sitting as the last sentence of a paragraph.
- **It is collection-first, not interrupt-first.** Findings accumulate and surface once at the end, so
  dogfooding never derails the task the user actually asked for.
- **It propagates across the delegation boundary.** A finding discovered inside a subagent is worthless if it
  dies there, which is why the instruction to relay is part of the main agent's orientation rather than only the
  agent brief's closing paragraph (the brief carries the mirror obligation: report doc/source disagreements and
  any gap or awkward API in the libraries).

The cost is a permanent block in every session's context — the same trade silk made and later reversed when its
own dogfood prompt outlived its usefulness (see `../silk/plugin.md`, "Dogfood-feedback prompt (removed)"). That
precedent is the exit condition: this block should come out once the plugin stops producing findings.

## Tests

`tests/run-hook-tests.sh` mirrors silk's runner: a shellcheck leg over every shebang-carrying `.sh` under
`hooks/`, `bin/`, `tests/` **and `skills/`** plus the `tests/*.bash` helpers (sourced-only libs are validated
*in context* via `-x` with `-P SCRIPTDIR`, never standalone), then a bats leg over `tests/*.bats`. No skill
bundles a script today — the `skills/` arm of the scan is a standing guard so the first one that does cannot ship
unlinted, which is exactly how silk's bundled `changeset/scripts/list.sh` would otherwise have entered. It preflights `shellcheck`,
`bats` and `jq` and exits 127 with install instructions when any is missing. `tests/test_helper.bash` isolates
`HOME` per test and strips leaked `CLAUDE_*` env so a run from inside a live session stays hermetic.

Two suites, nine tests:

- **`session-start-orientation.bats`** (5) — the payload assertion (`hookEventName`, the block name, the agent
  name, `workspace_info`, both package names, and the `dogfood_feedback` block, so the feedback loop cannot be
  dropped in an edit without a red test); the **every-skill-on-disk roster check**, which walks `skills/*/`
  and requires each directory name to appear in the payload; the jq fail-open case under a restricted `PATH`
  stubbed with everything except `jq`, asserting exit 0 and a literal `{}`; and stdin tolerance for both malformed
  and empty input.
- **`agent-skill-registration.bats`** (4) — the `skills:`-vs-`tools:` frontmatter discrimination. Two awk helpers
  extract each block by key, stopping at the next top-level key, so the tests search *only* inside the intended
  array: every agent declares a non-empty `skills:` block; every skill on disk is listed there; **no skill name
  leaks into `tools:`** (the exact bug the file exists to catch, invisible to any whole-file grep); and every
  skill an agent names has a real `SKILL.md` on disk.

Both roster loops end in a `≥ 12` count guard. Without it an empty `skills/*/` glob — a moved directory, a rename,
a bad checkout — makes both loops iterate zero times and pass vacuously, which is precisely the regression the
suites exist to catch.

Wiring (historical): the root `pnpm test:hooks` ran silk's runner then this one, and `.github/workflows/hook-tests.yml` watched `plugins/github-actions/**` (whole-subtree, unlike silk's narrower `hooks/`+`tests/`+`bin/` paths) and ran both suites in one job. The broader path list was deliberate and the workflow header said why: these bats suites assert the agent/skill *registration* contract, so a change under `agents/` or `skills/` could break them without touching a single shell script. The root-script leg was dropped after the plugin's removal left it pointing at a deleted runner.

## Relationship to the silk plugin

The two plugins are siblings in one marketplace, usually loaded together, and the division of labor is
deliberate rather than incidental:

- **Shared infrastructure, duplicated only where it must be.** `bin/start-mcp.sh` and `hooks/lib/hook-output.sh`
  are byte-identical copies of silk's; `hook-debug.sh` diverges only to renamespace its logs. Copies are how
  Claude Code plugins share shell code at all — a plugin is a self-contained directory with no cross-plugin
  `source` path — so the discipline is to keep them identical on purpose and re-copy rather than hand-patch. The
  MCP *server* is genuinely shared (one `savvy-mcp`), only the tool-name prefix differs per plugin.
- **Enforcement lives in silk, advice lives here.** Commit format, lint, changeset nudges, vendored-tree
  tripwires and push discipline are all silk hooks. Re-registering any of them here would double-fire on a shared
  matcher (`Bash`, `Write|Edit|NotebookEdit`) and produce two denies for one action.
- **This plugin consumes one silk capability**, `repos`, for read-only source access outside the monorepo (see
  [Source access outside the monorepo](#source-access-outside-the-monorepo)).
- **Domain boundary.** Silk covers the suite's repo mechanics (changesets, commits, builds, TSDoc, turbo, vendored
  repos); this plugin covers building an *action*. A task that is really about the host monorepo goes back to
  silk's agents; a task that is really about generic Effect goes to the effected plugin's agents.

## Versioning and release scope

The manifest's `version` is **changeset-managed and never hand-bumped.** `.changeset/config.json` gives
`@savvy-web/silk` a `versionFiles` glob of `plugins/*/.claude-plugin/plugin.json` (`$.version`), so both plugin
manifests move in lockstep with the silk package — this plugin currently reads `3.1.2` because silk does.

Work on this plugin also lands in silk's changeset scope: silk's `additionalScopes` covers
`plugins/github-actions/**` alongside `plugins/silk/**` and `.github/workflows/hook-tests.yml`, so a
plugin-only branch is attributed to `@savvy-web/silk` and a changeset is expected for it. The implementation
branch carries exactly that — a `minor` on `@savvy-web/silk`.

The consequence worth stating plainly: this plugin has **no independent version line**, by choice. Both plugins
are shipped from and installed against the same suite release, and giving the newer one its own cadence would buy
nothing but a second thing to reconcile.

## Rationale

### Written for a standalone action repo

The plugin's first draft was written from inside this monorepo and read like it: pattern-to-repo tables,
`file:line` citations into sibling action repos, per-repo attribution on individual rules, and narration of how
the house style diverged from earlier actions. All of it is inert — worse, actively misleading — for the reader
the plugin actually serves, an agent in a repo cloned from `github-action-template` with neither the monorepo nor
those action repos on disk. A genericization pass removed it. The resulting rules:

- **State the rule, don't cite the precedent.** A pattern is written as a direct instruction with a
  self-contained generic example, not as "do what `<some>-action` does". History that cannot be opened is not
  evidence; it is decoration that invites the agent to go looking for a repo that is not there.
- **Cite only what the reader can open.** Library citations are package-relative source paths resolvable under
  `node_modules/@savvy-web/…`. Real-action material is credited as "production actions built on this stack" —
  provenance without a dead pointer.
- **Consumer identities are placeholders.** Org and repo names in examples the agent will copy are `<org>`,
  `<repo>`, `<action-name>` (see the `$schema` URL in `outputs-and-schemas`), so a copied line is obviously a
  template rather than someone else's repo silently inherited.
- **Issue references are fully qualified.** A bare `#94` means nothing outside the repo it was filed in, so
  every reference is written `savvy-web/systems#94` — the libraries' home, which is also where a reader who
  vendors anything will end up.
- **Drop legacy and divergence narration entirely.** "This used to be X" is meaningful to a maintainer of the
  libraries and pure noise to someone building their first action.

The trade accepted here is that the plugin can no longer say "go read the canonical implementation". That
capability moves into the authority ladder — installed packages, then the action repo itself, then vendoring
`savvy-web/systems` on demand — which works from a standalone repo, where the table never did.

### Why one agent, not one per capability

The twelve skills are twelve facets of one job — nobody scaffolds an action without also wiring inputs, outputs
and a build. Splitting them across agents would mean each hand-off re-establishes the same working tree, source
context and verification discipline, and the natural boundary (delegate the *whole* action task)
already produces the right unit of work. Splitting becomes right when a genuinely different contract appears —
silk's `tsdoctor` earns its own agent because "drive diagnostics to zero" has a terminating condition an
action-engineering task does not.

### Why the skills are plain-named

Prefixing is a namespace fix, and the plugin name is already the namespace: `/github-actions:logging` is
unambiguous. Silk prefixes because three merged tools collide inside one plugin; there is no collision here, so
an `action-` prefix on all twelve would add typing without adding information.

### Why references are vendored rather than linked

An action repo is the plugin's real habitat, and the systems monorepo is usually not checked out there — a link
into `packages/github-action-effects/docs/` would resolve to nothing in the common case. Vendoring also lets the
material be re-shaped for an agent audience (tables, decision guides, absent-capability lists) instead of the
prose a human reader wants, which is the same reason the plugin does not simply point at the package README. The
provenance banner is the tax that makes it safe: source files, version, date, and "on skew, source wins".

### Why the source, not the docs, is the authority

The stale-doc list in [Verification discipline](#verification-discipline) is not hypothetical — the builder's own
`init` scaffold emits a config form that silently decodes to all-defaults. An agent that trusts documentation over
`src/index.ts` will reproduce every one of those errors confidently. Encoding "source over docs" as a prime
directive, and enumerating the known cases, converts a class of silent failures into a lookup the agent already
has in context.

### Why it advertises rather than enforces

The plugin ships one SessionStart hook and no guards. The behaviors worth enforcing repo-wide — commit format,
lint, vendored-tree protection, push discipline — already have guards in the silk plugin, which is loaded in the
same sessions; duplicating any of them here would double-fire on a shared matcher. What is left is genuinely
advisory (which skill to read, which service to reach for, that docs are stale), and advice belongs in orientation
and skills, not in a `permissionDecision`.
