---
name: action-engineering
description: >
  The routing map for building Node.js 24 GitHub Actions with
  @savvy-web/github-action-effects and @savvy-web/github-action-builder —
  what the stack is, which service and which skill each job routes to, and
  which capabilities do NOT exist.
  Use FIRST when asking "how do I build an action", "which service do I reach
  for", or before designing any action capability. Rows route; they do not
  teach — patterns live in the other github-actions skills. User-invokable as
  /github-actions:action-engineering.
when_to_use: >
  "build a GitHub Action", "new action", "which service handles X in an
  action", "does github-action-effects have X", "@savvy-web/github-action-effects",
  "@savvy-web/github-action-builder", "action inputs", "action outputs",
  "job summary", "check run", "PR comment from an action", "GitHub App token
  in an action", "replace @actions/core"
---

# Action engineering: the map

The stack: **`@savvy-web/github-action-effects`** is an Effect v4 library that
replaces every `@actions/*` package with schema-validated services (zero
`@actions/*` deps; `effect` and `@effect/platform-node` are peerDependencies).
**`@savvy-web/github-action-builder`** bundles the TypeScript entry points
into single-file Node 24 ESM artifacts under a **committed** `dist/`, and
validates `action.yml`. New actions start from the pre-configured
**`savvy-web/github-action-template`** repo — the repo you are in most likely
did. The skills below carry the house patterns distilled from production
actions built on this stack; when a pattern is unclear, follow the owning
skill and verify against the installed source.

An entry file is 3–8 lines: `Action.run(program, { layer: MainLive })`, which
auto-provides `ActionLogger | ActionOutputs | ActionEnvironment | ActionState`,
the `INPUT_*` ConfigProvider, the workflow-command logger, and top-level
failure handling (formatted `::error::` + `process.exitCode = 1`). Everything
else is layers you merge in.

## I need to… → reach for…

| I need to… | Service / namespace | Skill |
| --- | --- | --- |
| Scaffold a new action | the template repo, not `init` | scaffolding |
| Configure the bundle, fix a runtime `Cannot find module` | `action.config.ts` | builder-config |
| Write `main.ts`/`pre.ts`/`post.ts`, wire layers | `Action.run`, `Layer.mergeAll` | runtime-and-layers |
| Read/validate an input | `Config.*`, `ActionInput.boolean/multiline` | inputs |
| Set outputs, write the job summary | `ActionOutputs` (`set`/`setJson`/`summary`) | outputs-and-schemas |
| Design a machine-readable result for downstream agents | annotated Schema + generated JSON Schema | outputs-and-schemas |
| Mint/revoke a GitHub App installation token | `GitHubToken`, `GitHubApp` | github-app-auth |
| Verify token scopes up front | `TokenPermissionChecker` | github-app-auth |
| Call the GitHub REST/GraphQL API | `GitHubClient` (+ derived services) | github-api |
| Create branches/tags/verified commits | `GitBranch`, `GitTag`, `GitCommit` | github-api |
| Read commit history/diffs | `GitHubCommit` (read ≠ `GitCommit` write) | github-api |
| Releases, issues, PRs, cross-workflow dispatch | `GitHubRelease`, `GitHubIssue`, `PullRequest`, `WorkflowDispatch` | github-api |
| Open a check run with markdown output | `CheckRun` (`withCheckRun` bracket) | checks-and-reports |
| Upsert a sticky PR comment | `PullRequestComment.upsert` | checks-and-reports |
| Render one report to summary + comment + check | `ReportBuilder`, `GithubMarkdown` | checks-and-reports |
| Log beautifully (groups, ✅/❌ steps, decision log) | `Step`, `ActionLogger` | logging |
| Define typed errors, demote non-fatal failures | `Data.TaggedError` house style, `catchTag` | errors-and-state |
| Pass data between pre/main/post | `ActionState` + `Schema.Class` bundles | errors-and-state |
| Test a program without a runner | `/testing` layers, `ConfigProvider.fromUnknown` | testing-actions |
| Run a subprocess / query npm / detect the workspace | `CommandRunner`, `NpmRegistry`, `WorkspaceDetector` | references/service-catalog.md |
| Cache, artifacts, blob storage, tool installs | `ActionCache`, `Artifact`, `BlobStore`, `ToolInstaller` | references/service-catalog.md |
| Publish packages, attest provenance/SBOM | `PackagePublish`, `Attest`, `Sbom`, `SigstoreSigner` | references/service-catalog.md |

The full 39-service catalog — every service with its APIs, error type, and
layer requirements — is `references/service-catalog.md`. Consult it before
concluding a capability is missing.

## What does NOT exist (do not invent it)

- **No ANSI/color API.** "Beautiful logs" means the `Step` namespace, groups,
  and buffered transcripts — see `logging`.
- **No `ActionInputs` service.** Inputs deliberately flow through Effect
  `Config` + the `INPUT_*` ConfigProvider — see `inputs`.
- **No JSON-Schema generator in the library.** Output/input JSON Schemas are
  generated per-action from Effect Schema via a `generate-schema.ts` script —
  see `outputs-and-schemas`.
- **No `@actions/io` cp/mv/rmRF/mkdirP wrappers.** Use `FileSystem` from the
  platform layer (`IoUtil` covers only `which`).
- **`action.yml` scaffolding/validation lives in the builder**, not the
  effects library.

The `@actions/*` → effects migration table and the absent-capability detail:
`references/toolkit-parity.md`.

## Cross-cutting facts every consumer inherits

- **Import seams:** entry points import from the package root; tests import
  from `@savvy-web/github-action-effects/testing` (the root barrel statically
  pulls octokit and emits workflow commands at import time).
- **Peer posture:** `effect` and `@effect/platform-node` stay peerDependencies
  in actions — never seal them as regular deps.
- **Secrets are `Redacted<string>` end-to-end**; generated tokens get
  `outputs.setSecret` before any logging.
- **`dist/` is committed.** Builds must be byte-reproducible; never hand-edit
  `dist/` and never report done without rebuilding it.
- **Errors:** 40+ `Data.TaggedError` classes, one per service concern —
  `references/error-taxonomy.md` has every tag and field shape.
- **Docs drift:** the builder docs' `GitHubAction.create()` config form,
  `build.target`/`build.quiet`, and `validation.maxBundleSize` are all wrong
  or inert; effects docs' `@effect/platform` FetchHttpClient import is stale.
  Source over docs, always.

## Source access

Verify APIs against the installed packages (`node_modules/@savvy-web/…` —
`src/index.ts` is the authoritative barrel). For anything the installed
packages don't answer (library internals, upstream history), use the silk
plugin's `repos` capability (`/silk:repos`) to vendor `savvy-web/systems`
(home of both libraries) under `.repos/` as read-only reference source.

## Reference map

| Reference | Load when |
| --- | --- |
| [service-catalog.md](./references/service-catalog.md) | routing a job the table above doesn't answer, or enumerating any service's APIs/errors/layers |
| [error-taxonomy.md](./references/error-taxonomy.md) | matching on or defining tagged errors, writing `catchTag` handlers |
| [toolkit-parity.md](./references/toolkit-parity.md) | migrating from `@actions/*` code or checking whether a toolkit capability exists here |

## Related skills

This skill routes; the others teach. Build order for a new action:
`scaffolding` → `inputs` + `outputs-and-schemas` → `runtime-and-layers` →
`github-app-auth`/`github-api` as needed → `checks-and-reports` + `logging` →
`errors-and-state` → `testing-actions` → `builder-config` to ship it.
