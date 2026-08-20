---
name: build
description: >
  Configure and run @savvy-web/bundler builds (and its rspress-builder
  sibling): the build() front door, the full BuildConfig option surface, the
  build:dev/build:prod/types:check/prepare package.json script contract, the
  Turborepo build:dev/build:prod/types:check task graph, SEA executables, and
  the API Extractor meta pass. Auto-loads on savvy.build.ts, and on
  package.json/turbo.json to explain the bundler's script/task-graph
  contract when that file belongs to a bundler-built package (harmless
  no-op on files that aren't). User-invokable as /silk:build.
when_to_use: >
  "set up savvy.build.ts", "configure the bundler", "build:dev vs
  build:prod", "how do I add prepare", "why does this package need
  prepare", "can I delete this prepare script", "wire turbo build tasks",
  "dual-format esm cjs", "bundle a dependency", "externals vs
  bundledPackages vs dtsExternals", "build a single executable", "SEA
  binary", "--target exe", "generate api model", "suppress api extractor
  warning", "rspress plugin build", "definePlugin", "what does <option> do
  in savvy.build.ts", "what is this package.json script for", "what does
  this turbo.json task do", "is this package built by the bundler"
paths:
  - "**/savvy.build.ts"
  - "**/package.json"
  - "**/turbo.json"
---

# Building with @savvy-web/bundler

## Is this file actually a bundler package?

`package.json` and `turbo.json` exist in nearly every package in every repo — most of them have nothing to do with `@savvy-web/bundler`. Before applying anything below, check the file (or its directory) for ONE of:

- a sibling `savvy.build.ts`
- `publishConfig.directory` set to `dist/dev/pkg`
- a `build:dev` script running `node savvy.build.ts --target dev` (`tsdown-plugins` runs `tsx savvy.build.ts --target dev` instead — it self-hosts before `node`'s own build target exists, but the contract is the same)

None present? This skill's content does not apply to that file — move on.

## savvy.build.ts: the per-package build entry

Run it with `node savvy.build.ts --target dev|prod`. It builds JS + `.d.ts`, transforms the manifest, and — on `prod` — runs the API Extractor meta pass.

### Front door (preferred)

```ts
import { build } from "@savvy-web/bundler";

await build();
```

Zero-config `build()` reads `package.json` `exports`/`bin`, derives the target from `process.argv` (`--target dev|prod|exe`, `--watch`, `--no-exe`, `--verbose`), and builds. Pass overrides as `build({ … })` using any `BuildConfig` field — see `references/options.md` for the full surface.

### Escape hatch (secondary)

```ts
import { defineBuild, runBuild } from "@savvy-web/bundler";

const config = defineBuild({ /* … */ });
// inspect / snapshot / transform `config` here
await runBuild(config, { cwd: process.cwd(), argv: process.argv.slice(2) });
```

Use only when you must inspect or programmatically transform the resolved config, or inject `RunOptions` IO hooks (testing/self-host). Default builds use `build()`.

## Reading a build as evidence

Two different failures produce a build log that reads exactly like a clean gate. Both matter most when the build is the evidence for a claim — "the warnings are fixed", "the surface is clean", "the change is in the artifact".

**A direct `node savvy.build.ts --target prod` is not the `build:prod` task.** The task graph runs `types:check` and `build:dev` first; invoking the script by hand skips both. The prod pass then runs against whatever `dist/dev` happens to hold, may emit no `.d.ts` at all, and can leave a truncated `issues.json` whose empty diagnostic buckets are indistinguishable from a clean one. Run the task, not the script: `pnpm turbo run build:prod --filter <package>`.

**A turbo cache hit replays the previous run's output verbatim.** `FULL TURBO`, the same file count, the same `suppressed` figure — a stale artifact and a fresh one read identically in the log. An agent that edits source, builds, and reads a clean log has no evidence from that log that the build ever saw the edit.

The tell for both is the same: `dist/<target>/issues.json`'s `generatedAt` must postdate your newest source edit.

```bash
node -pe "require('./dist/prod/issues.json').generatedAt"
find src -name '*.ts' -newer dist/prod/issues.json
```

Any path printed by `find` is a source file newer than the artifact — the gate you are reading predates that edit and belongs to an earlier tree. `find` printing nothing means the artifact is at least as new as every source. A replay against genuinely unchanged inputs is legitimate and needs no rebuild; pass `--force` when you need to defeat the cache deliberately, as `/silk:tsdoc`'s verification recipe does.

`issues.json` also carries a `buildOk` stamp — read it before the diagnostic buckets, since the artifact is written on every terminal path including a crash. `/silk:tsdoc` owns that recipe.

## package.json script contract

Every bundler-built package declares `publishConfig.directory: dist/dev/pkg` and three scripts: `build:dev` (`node savvy.build.ts --target dev`), `build:prod` (`node savvy.build.ts --target prod`), `types:check` (`tsc --noEmit`). Other supporting scripts may exist alongside these.

### `prepare` — read this before touching it

A package ALSO needs `"prepare": "turbo run build:dev"` whenever it is a `workspace:*` dependency of ANY OTHER `package.json` in the repo — the root, a sibling package, or an `e2e/*` fixture all count. Its consumer resolves it through a `link:` into `dist/dev/pkg`, and that link has to resolve at **install time**, before and independently of Turborepo's task graph — turbo hasn't run anything yet at that point.

**Do not delete a `prepare` script on the theory that turbo's `dependsOn` already covers the ordering — it does not, and this is a known, repeating mistake.** A package that happens to build fine without `prepare` in one session may only be working by accident of *that run's* orchestration order, not by design; absence of breakage is not evidence the script is unnecessary. This has cost real repairs: deleting `@savvy-web/changelog`'s `prepare` as "redundant with turbo" broke `changeset version`/`changeset_preview` with `Cannot find package '@savvy-web/changelog'`, because it's resolved at install time via `link:` from the root, not by turbo.

Before adding, removing, or reasoning about a `prepare` script, find who actually consumes the package rather than guessing:

```bash
grep -rl '"@savvy-web/<name>": "workspace:\*"' **/package.json
```

Any hit — anywhere in the repo — means it needs `prepare`. Zero hits means it doesn't yet; add one the moment something starts depending on it. See `references/workspace-setup.md` for the current roster and the two valid `prepare` forms.

## turbo.json: what it orders, and what it doesn't

`build:dev` depends on `^build:dev` (a package's workspace deps build first); `build:prod` depends on `types:check` + `build:dev`; `types:check` depends on `^build:dev`. This `dependsOn` graph governs build order **whenever turbo actually runs** — `pnpm build`, CI, or a package's own `prepare: turbo run build:dev`. It's why `prepare` is written as `turbo run build:dev` rather than a bare `node savvy.build.ts`: invoked from inside the package, turbo scopes to that package plus its whole upstream `^build:dev` chain, so one `prepare` script builds everything it needs in the right order.

What `dependsOn` does NOT do is decide *whether* a package's `prepare` runs at all — that's `pnpm install`'s own install-time linking, entirely outside turbo. `pnpm install` triggers a workspace package's `prepare` because that package is resolved as a `workspace:*` dependency somewhere in the repo, full stop; it does not skip a package's `prepare` on the theory that some consumer's `prepare` would transitively rebuild it via `dependsOn` anyway. `dependsOn` orders builds that are already triggered — it never triggers one itself, and it never reaches outside a `turbo run`. That gap is exactly what makes the "turbo already orders it" argument for deleting `prepare` wrong. Full root/per-package `turbo.json` shape and sentinels (`$TURBO_ROOT$`, `$TURBO_DEFAULT$`, `$TURBO_EXTENDS$`) are in `references/workspace-setup.md`.

## Which reference do I need

| Reference | Covers |
| --- | --- |
| `references/options.md` | Every `BuildConfig` field |
| `references/workspace-setup.md` | `build:dev`/`build:prod`/`types:check`/`prepare` scripts, the current with/without-`prepare` roster, and root + per-package `turbo.json` wiring |
| `references/sea.md` | Single Executable Application (SEA) binaries |
| `references/api-extractor.md` | The meta pass + a bundling-knob decision guide |
| `references/rspress-builder.md` | Building RSPress plugins |

For TSDoc release tags and fixing `ae-*`/`tsdoc-*` diagnostics, use `/silk:tsdoc` — this skill owns build *config*, `tsdoc` owns doc *comments*.
