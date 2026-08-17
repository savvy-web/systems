---
status: current
module: testing
category: testing
created: 2026-07-25
updated: 2026-08-16
last-synced: 2026-08-16
completeness: 92
related:
  - ../silk-effects/architecture.md
  - ../e2e/architecture.md
  - ../tsdown-plugins/architecture.md
dependencies: []
---

# Suite-wide test conventions — `@effect/vitest`

The repo-wide testing contract for Effect code: which test entry point to reach for, how layers get provided, how failures are asserted, and the `TestEnv` behaviors that silently change what a test observes.

This doc covers conventions that hold across every package. Package-specific testing topology lives in that package's own design doc — see [Related Documentation](#related-documentation).

## Contents

- [Overview](#overview)
- [Where `@effect/vitest` applies](#where-effectvitest-applies)
- [The four test entry points](#the-four-test-entry-points)
- [Layer provision: per-test is the default](#layer-provision-per-test-effectprovide-is-the-default)
- [Filesystem doubles: `@effected/memfs`](#filesystem-doubles-effectedmemfs)
- [Failure assertions](#failure-assertions)
- [Importing `vi`](#importing-vi)
- [What `TestEnv` replaces](#what-testenv-replaces)
- [The type-variance seam](#the-type-variance-seam)
- [Current State](#current-state)
- [Rationale](#rationale)
- [Related Documentation](#related-documentation)

---

## Overview

Test files that run Effect programs use `@effect/vitest` (`catalog:effect`), not plain `vitest` plus a manual `Effect.runPromise`. The library supplies vitest-integrated test entry points (`it.effect`, `it.live`, `layer`) that build and tear down an Effect runtime per test, so a test body is an `Effect.gen` block rather than a promise-returning closure over a hand-rolled runner.

The migration to this shape was **test-only** — no `src/` file changed anywhere — and held exact baseline parity, which is the bar any future conversion of the remaining files should also meet.

---

## Where `@effect/vitest` applies

**The rule is per-file, not per-package: a test file that runs an Effect uses `@effect/vitest`; a test file with no Effect surface stays on plain `vitest`.** Roughly half the suite is in each camp, and that split is expected rather than unfinished work — pure-function tests (formatters, path math, schema shape assertions, config validators) gain nothing from an Effect runtime and should not pay for one.

Consequently `@effect/vitest` is a devDependency of exactly the packages that have at least one Effect-running test file: `cli`, `github-action-builder`, `mcp`, `silk-effects`, `templates` and `tsdown-plugins`. The packages whose tests never enter the Effect runtime (`bundler`, `changelog`, `rspress-builder`, `silk`, and the `e2e/*` harnesses) carry no such dependency — even where the package's *source* is Effect-based, as the bundler's is, because that Effect surface runs behind a promise boundary the tests call across.

Re-derive both facts rather than trusting a transcribed list:

```bash
# Files on @effect/vitest, by package
grep -rl "@effect/vitest" --include="*.test.ts" packages e2e | cut -d/ -f2 | sort | uniq -c

# Should print nothing: a live Effect runner left behind in a test file
grep -rn "Effect\.runPromise\|Effect\.runSync\|runPromiseExit" --include="*.test.ts" packages e2e
```

The second command is the invariant worth keeping green. The only surviving mentions of those runners in test files are inside comments explaining what the test used to do.

---

## The four test entry points

| Entry point | Use when |
| --- | --- |
| `it.effect` | The default. Test body is an `Effect.gen` block; runs against `TestEnv` (test clock, test console). |
| `it.live` | The body needs a **real** clock or a **real** console — see below. |
| `layer(...)` | A whole `describe`-group shares one built layer. Deliberately rare; see [Layer provision](#layer-provision-per-test-effectprovide-is-the-default). |
| plain `it` | No Effect surface at all. Import from `"vitest"`. |

`it.live` exists for two specific failure modes, both of which present as a *hang to the 5s timeout* or a *silently empty spy*, never as a clear error:

- **Real elapsed time.** Under `it.effect` the ambient `TestClock` is frozen at the epoch. A test that leans on a duration actually passing (a retry `baseDelay` elapsing, a debounce firing) and never calls `TestClock.adjust` will sleep forever. Tests that *do* drive the clock explicitly should stay on `it.effect`; `it.live` is for the ones where advancing it by hand would defeat the point.
- **Real stdout/stderr.** A helper that spies on `process.stdout.write` only sees output that bypasses Effect's `Console` ref. See [What `TestEnv` replaces](#what-testenv-replaces) for the discrimination.

---

## Layer provision: per-test `Effect.provide` is the default

**Provide layers per test with `Effect.provide` inside the test body. Reach for a suite-boundary `layer(...)` block only when the layer is genuinely constant across the group *and* holds no state whose lifetime is itself under test.**

The distinction is not stylistic. `layer(...)` **memoizes** the built layer across every test in the group; per-test `Effect.provide` does not. So a test double with mutable in-memory backing — the near-universal shape of a `*Test` layer in this repo, where a captured-calls array or an outputs list is the assertion target — accumulates state across tests under `layer(...)`, and the resulting cross-test bleed shows up as order-dependent failures far from their cause. Per-test provision gives each test a fresh double for free.

The canonical shape is a small per-file helper that builds fresh state and provides it:

```typescript
const runWithOutputs = <A, E>(effect: Effect.Effect<A, E, ActionOutputs>) => {
  const state = ActionOutputsTest.empty();
  return Effect.map(Effect.provide(effect, ActionOutputsTest.layer(state)), (result) => ({ result, state }));
};
```

Two shapes justify `layer(...)`, and the suite uses both.

**The layer is stateless.** The common case, concentrated in `cli`: `layer(Logger.layer([]))` wrapping a group only to silence the command's INFO logging. An empty logger set carries nothing from one test to the next, so memoization is unobservable. The second precondition still has to hold and is asserted in-file at each site — the group must not depend on ambient process state either. These suites never `chdir`; each test drives a freshly-created temp dir passed in as an argument.

**The layer is expensive to build and the group is read-only against it.** `packages/mcp/__test__/runtime.smoke.test.ts` is the worked example and documents the three conditions in-file:

- The MCP runtime is **root-bound at layer build** (single-root semantics), so the app layer is built once for one fixture root and shared — sharing is the point, not an optimization.
- Every test in the group is **read-only** against that fixture. A test that mutated it would need its own root.
- The fixture is created in `beforeAll` and the layer wrapped in `Layer.suspend`, so layer construction is deferred to build time — which `layer(...)` performs in its own nested `beforeAll`, i.e. *after* the fixture hook. Building at module scope instead turns a setup failure into a load-time throw, which zeroes the whole package (`0/0 passed`, exit 0) rather than reporting a named hook failure.

That last point generalizes: prefer a failure that names a hook over one that empties a file's test count.

---

## Filesystem doubles: `@effected/memfs`

**A test that needs a `FileSystem` provides a real one over an in-memory volume — `MemoryFileSystem.layerWith(seed)` from `@effected/memfs` — not a hand-rolled stub.** It supersedes both shapes the suite used to reach for: an `as unknown as FileSystem.FileSystem` object cast, and `FileSystem.layerNoop` with a handful of methods filled in. Re-derive the current footprint rather than trusting a list: `grep -rl "@effected/memfs" --include="*.test.ts" packages`.

Those stubs were not merely verbose, they were *dishonest*, and each way they lied has a matching failure the volume removes:

- **Membership is not path resolution.** A stub answering `exists` by exact string membership says false for `/repo/./x.json` and `/repo//x.json`, which a real filesystem normalizes and answers true.
- **A bare `Error` is not a `PlatformError`.** `Effect.fail(new Error("ENOENT: …"))` as a not-found signal means a test named for `PlatformError` handling never enters that channel at all; a volume fails typed `NotFound` on its own.
- **One canned body for every path.** `readFileString: () => Effect.succeed(text)` makes path-correctness unobservable — the code under test can read a misspelled path and still pass. Seed the one path it is supposed to read and a wrong path fails.
- **`layerNoop` is deny-by-default, so isolating one method costs a whole fake tree.** Filling in `readDirectory: () => Effect.succeed([])` to get a recursion test off the ground hands it an *empty* tree to recurse into, which is how `ReposLockdown`'s documented lock-recursion-order invariant sat unreachable behind two passing tests.

**Fault injection is the idiom for permission and IO-failure paths.** `MemoryFileSystem.layerFaulty({ method: handler })` wraps a volume and delegates by default — a handler returning `undefined` falls through to the real volume — so a test names exactly one failing operation and everything else runs against genuine filesystem behavior. That is what makes "denied" distinguishable from "missing": inject `PermissionDenied` on `readFileString` over a volume where the file genuinely exists, and the denial becomes the only reason the read can fail. Worked examples: `packages/silk-effects/__test__/repos/services__drift.test.ts`, `packages/mcp/__test__/tools/repos-inspect.test.ts`, and the mode-keyed `chmod` in `packages/silk-effects/__test__/repos/services__lockdown.test.ts`.

**Volume sharing is per BUILD, not per layer value.** Binding `MemoryFileSystem.layerWith(seed)` to a const does not make two `Effect.provide` calls share a volume — layer memoization is per build, so each provide builds an independent, freshly re-seeded one. A write-then-read test split across two provides reads back the seed, and the natural assertion passes *vacuously*. Keep a write and its read-back inside ONE `Effect.provide` over one composed program: `Layer.provideMerge(ServiceUnderTest.layer, volume)` exposes both the service and the `FileSystem` from a single build. `packages/silk-effects/__test__/services/BiomeSchemaSync.test.ts` documents this in-file — it is the one place on the adoption branch where the vacuous pass actually happened.

**memfs records modes but never enforces them, so permission *enforcement* still needs a real tmpdir.** Mode bits round-trip faithfully — `chmod` persists, `stat` reports them, the exec bit survives — but writing to a `0o444` file succeeds, because memfs models no process identity. A test whose subject is the OS refusing an operation (real `EACCES` on path resolution through a locked ancestor, say) is therefore not portable to a volume and stays on a real temp directory; fault injection is the substitute only where the *reaction* to a denial is the subject rather than the denial itself. `packages/silk-effects/__test__/repos/services__lockdown.test.ts` keeps its real-tmpdir blocks for exactly this reason, and `__test__/repos/services__config-store.test.ts`'s `it.live` lock tests stay real because they prove a lock protocol against genuine filesystem atomicity (`open(flag:"wx")`) and real mtime staleness.

---

## Failure assertions

**Assert a failure with `Effect.flip` and check the error's `_tag`/fields.** `flip` swaps the error and success channels, so the test only proceeds if the failure arrived on the **typed** channel:

```typescript
const error = yield* Effect.flip(Effect.provide(handler, TestLayer));
expect(error.kind).toBe("invalid");
```

This is strictly stronger than the `runPromiseExit` + `Exit.isFailure` shape it replaced, which also passed when the error escaped as a **defect** — exactly the regression a typed-error codebase most wants to catch. It also removes the nested `is-a-Failure` / `is-a-Some` guards that shape required, which had a failure mode of their own: an assertion nested under a guard is *silently skipped* whenever the guard does not hold, so a test could report green having asserted nothing.

**Defects** — where the point of the test is that something escapes the typed channel — use `Effect.exit` and inspect the `Cause`, with an explicit `throw` on the non-failure branch so a passing effect cannot fall through as a pass. `Cause.pretty` gives a readable message.

---

## Importing `vi`

**Any file that calls `vi.mock` must import `vi` from `"vitest"`, never from the `@effect/vitest` re-export.** Vitest hoists `vi.mock` calls above the import statements; the hoisting transform recognizes the specifier `"vitest"`, and a `vi` that arrived through the re-export is not in scope at the hoisted position.

For `vi.fn` and `vi.spyOn` — which are not hoisted — importing `vi` alongside `describe`/`it`/`expect` from `@effect/vitest` is fine, and the suite does both. The rule that matters is the `vi.mock` one; when in doubt, importing `vi` from `"vitest"` is always correct.

---

## What `TestEnv` replaces

Under `it.effect`, `@effect/vitest` provides a `TestEnv` that swaps out two ambient services, and both swaps change what a test can observe:

- **`TestClock`** — frozen at the epoch, advanced only by `TestClock.adjust`/`sleep` calls the test makes. See [The four test entry points](#the-four-test-entry-points).
- **`TestConsole`** — replaces the `Console` ref. This is the subtle one, because **whether a logging test still sees output depends on how the code under test writes it.** Effect's default logger writes *through* the `Console` ref, so a test asserting on default-logger output under `it.effect` will be captured by `TestConsole` and go silent. Code that installs its own logger writing straight to `process.stderr.write` bypasses the ref, so `vi.spyOn(process.stderr, "write")` still sees it and the test can stay on `it.effect`. `packages/silk-effects/__test__/commitlint/hook/silence-logger.test.ts` documents this discrimination in-file for `HookSilencer`, citing the line in the logger source that settles it.

The general rule: decide `it.effect`-vs-`it.live` for a logging test by **verifying against the code under test** which write path it takes, and confirm by mutation (make it fail) rather than by inference.

---

## The type-variance seam

`tsgo`'s narrowing of layer composition can leak `any` through `Effect.provide`, so a fully-provided effect does not always typecheck as `R = never` at the call site. Where this bites, the convention is a **single cast helper at the top of the file**, commented with why it exists, rather than per-call-site cast noise. Keep the cast at the seam; do not let it spread into the test bodies, and re-check whether it is still needed on TypeScript and Effect upgrades. The reference example used to live in `github-action-effects`, which has since been deleted — when the seam next bites, document the new instance in-file and cite it here rather than restating the rule from memory.

---

## Current State

95 of the suite's 271 test files are on `@effect/vitest` across six packages (`silk-effects` 53, `cli` 19, `mcp` 14, `tsdown-plugins` 4, `github-action-builder` 3, `templates` 2); the rest have no Effect surface and stay on plain `vitest`. Both numbers dropped sharply when `@savvy-web/github-action-effects` — by far the largest converted package — was deleted in the `@effected` github-split adoption, so re-derive them with the commands above rather than trusting this paragraph. No test file runs a live `Effect.runPromise`/`runSync`/`runPromiseExit`. Suite-boundary `layer(...)` blocks are used in roughly two dozen places, all in `mcp` and `cli` — a stateless silencing logger in most of them, the root-bound MCP runtime in the smoke tests. The suite runs in the forks pool under the root `@vitest-agent/plugin` (`vitest.config.ts`).

**Filesystem doubles are mid-migration.** `@effected/memfs` is a devDependency of `silk-effects` and `mcp` only, and the volume idiom has reached the test files that most needed it; a handful of `FileSystem.layerNoop` sites remain elsewhere, which is fine where the code under test never touches a tree. Adopt a volume when a new or edited test needs one, rather than treating the remainder as a scheduled sweep.

**The `*Test`-double cleanup resolved by deletion, not by refactor.** [savvy-web/systems#378](https://github.com/savvy-web/systems/issues/378) proposed replacing the duplicated `*Test` double layers with service-owned `Layer.mock` and renaming the `*Live` layers in place. The github-split survey concluded the package's problems were structural rather than cosmetic, so the whole package went upstream to the `@effected` kit instead — taking the 38 hand-written doubles, the five mutually incompatible double conventions and the `./testing` subpath with it. What survives as guidance: **a new test double must fail loudly on an unstubbed member** (`Layer.mock`'s `UnimplementedError`, or an `Effect.die`), because the deleted doubles' lenient defaults kept two consumer tests green on a documented lie.

---

## Rationale

**Why `@effect/vitest` rather than hand-rolled runners.** The per-file `run`/`runExit`/`runWith` closures it replaced were near-identical, individually divergent, and each one was a place for the runtime's error handling to differ from its neighbors. Roughly forty of them were deleted in the conversion. Pushing runtime construction into the test framework makes the test body the only thing a test file has to get right, and gives the whole suite one place where `TestEnv` semantics are defined.

**Why per-test provision is the default rather than the exception.** The memoization difference is invisible in a passing suite and expensive in a failing one: state bled through a memoized layer produces failures whose cause is in a different test. Defaulting to the non-memoizing form means the ordinary case is correct without anyone reasoning about layer lifetimes, and the cases that genuinely need sharing declare themselves — the `layer(...)` call is the signal to go read why.

**Why a real in-memory filesystem rather than a stub.** Every hand-rolled `FileSystem` double is a second, informal specification of what a filesystem does, written by whoever needed one method that afternoon — and the ways it diverges are invisible in a green suite, because the code under test is the only thing that ever asks. Path normalization, typed `NotFound`, per-path content and directory recursion each cost a stub author real work to get right and none of them cost anything on a volume, so the stub reliably ends up asserting less than its test name claims. A volume moves the specification into a shared implementation and leaves the test file holding only the *seed* and the one *injected fault* — the two things that are genuinely about this test.

**Why `flip` over exit-inspection.** A typed-error codebase's most valuable test property is that errors arrive where the types say they will. `flip` asserts exactly that and nothing else; exit-inspection asserts the weaker "something went wrong", which a defect also satisfies. The nested-guard skipping problem made the weaker form worse than its weakness suggested.

---

## Related Documentation

- [`github-action-effects` testing strategy](../_archive/github-action-effects/testing-strategy.md) — **archived**; the `./testing` subpath contract and test-layer topology of the deleted package, kept for history only
- [`silk-effects` architecture](../silk-effects/architecture.md#testing-strategy) — fixture-tree integration tests
- [`e2e` architecture](../e2e/architecture.md) — the built-artifact harness, which stays on plain `vitest`
- [`tsdown-plugins` architecture](../tsdown-plugins/architecture.md) — `.repos/effect` as the authority on what Effect v4 exports, including the vendored `@effect/vitest` reference implementation
