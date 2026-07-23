# @actions/* parity map & absent capabilities

> Distilled from `@savvy-web/github-action-effects@3.0.4` docs
> (`docs/06-toolkit-parity.md`, `docs/14-architecture.md`) and source,
> 2026-07-23. On version skew the installed source wins — re-verify before
> relying on this.

The library replaces the entire `@actions/*` toolkit with native-ESM Effect
services — an action built on it has **zero** `@actions/*` dependencies.
When porting toolkit-era muscle memory, translate through this table.

## Substitution map

| `@actions/*` | Replacement | Notes |
| --- | --- | --- |
| `@actions/core` (inputs: `getInput`, `getBooleanInput`, `getMultilineInput`) | Effect `Config.*` via `ActionsConfigProvider`, plus `ActionInput.boolean` / `ActionInput.multiline` | reads `INPUT_*`; `ActionInput.boolean` implements GitHub's YAML 1.2 truth set (`Config.boolean` does not — see `inputs`) |
| `@actions/core` (outputs / state: `setOutput`, `saveState`, `getState`) | `ActionOutputs` / `ActionState` | schema-typed; state round-trips through `Schema` |
| `@actions/core` (logging: `debug`/`info`/`warning`/`error`, `group`, `notice`) | Effect `Logger` via `ActionsLogger` + `ActionLogger` | level→workflow-command mapping; `ActionLogger.notice` for `::notice::`; `setFailed` → `ActionOutputs.setFailed` |
| `@actions/core` (`exportVariable`, `addPath`, `setSecret`) | `ActionOutputs.exportVariable` / `.addPath` / `.setSecret` | |
| `@actions/core` (commands: `stopCommands` etc.) | `WorkflowCommand` (mostly internal; `AnnotationProperties` type is public) | |
| `@actions/core` (`toPosixPath` etc.) | `PathUtils` | `toPosixPath` / `toWin32Path` / `toPlatformPath` |
| `@actions/github` (`context`) | `ActionEnvironment` (`payload` / `repo` / `issue` / `isDebug`) + `WebhookPayload` schema | parsed from `GITHUB_EVENT_PATH`; absent event path → empty payload, like the toolkit |
| `@actions/github` (`getOctokit`) | `GitHubClient` (wraps `@octokit/rest` directly) | adds retry, rate-limit awareness, streaming pagination |
| `@actions/exec` | `CommandRunner` | `exec` / `execCapture` / `execJson(schema)` / `execLines` |
| `@actions/io` (`which`, `findInPath`) | `IoUtil.which` / `whichOrFail` / `findInPath` | namespace over `FileSystem` |
| `@actions/io` (`cp`, `mv`, `rmRF`, `mkdirP`) | **deliberately not wrapped** — `FileSystem` from `@effect/platform` | `copy` / `rename` / `remove` / `makeDirectory`; recipe in library docs/15 |
| `@actions/glob` | `Glob` service | `glob` + `hashFiles` (SHA-256 hash-of-hashes, toolkit-compatible; some option names are documented no-ops) |
| `@actions/http-client` | `HttpClient` from `effect/unstable/http` | no wrapper export |
| `@actions/cache` | `ActionCache` | V2 Twirp + Azure Blob; miss = `Option.none()` |
| `@actions/artifact` | `Artifact` | v2 parity; `getArtifact` miss = `Option.none()`, not a throw |
| `@actions/tool-cache` | `ToolInstaller` | |
| `@actions/attest` | `Attest` cluster (`provenance` / `sbom` / `attest` / `buildBundle`) | Sigstore + GitHub attestation store; predicate shape matches `@actions/attest` |
| `@octokit/auth-app` (direct use) | `GitHubApp` + `OctokitAuthApp`, or the `GitHubToken` lifecycle | see `github-app-auth` |

## Absent capabilities — do not invent these

State these plainly when tempted; each has a real replacement:

| It does NOT exist | What exists instead |
| --- | --- |
| An `ActionInputs` service | Inputs are Effect `Config` reads against `ActionsConfigProvider` (design decision AD-2). There is no injectable inputs service to mock — tests use `ConfigProvider.fromUnknown` |
| ANSI colors / a color API | "Beautiful logs" = the `Step` namespace (✅/❌ buffered steps), `ActionLogger.group` / `withBuffer`, and workflow-command annotations. See `logging` |
| JSON-Schema **generation** in this library | `ActionOutputs.setJson(name, value, schema)` encodes through an Effect Schema; generating a committed JSON Schema document is an action-side pattern (`lib/scripts/generate-schema.ts` from Effect's `Schema.toJsonSchemaDocument`) — see `outputs-and-schemas` |
| `action.yml` scaffolding or validation | Lives in `@savvy-web/github-action-builder` (`validate` command, strict CI mode) — see `builder-config` |
| `@actions/io`-style `cp` / `mv` / `rmRF` / `mkdirP` wrappers | `FileSystem` from `@effect/platform` directly |
| A `RateLimitState` service | Internal only (`src/services/RateLimitState.ts` is not exported); use `RateLimiter` |

## Known doc drift (teach the source form)

The library's own docs still show
`import { FetchHttpClient } from "@effect/platform"` in places; the source
(`src/runtime/ActionsRuntime.ts`) imports `FetchHttpClient` from
**`effect/unstable/http`**. Use the source form.
