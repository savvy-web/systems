---
type: Convention
title: Use @effect/vitest per file, not per package
description: "Choose the test entry point by whether the file runs an Effect: it.effect by default, it.live for real time/console, layer(...) only for a stateless or read-only-shared group; provide layers per test, double filesystems with @effected/memfs, and assert typed failures with Effect.flip."
stale_after: 2027-03-12T00:00:00-04:00
tags: [testing]
sources:
  - id: effect-vitest
    resource: ../../packages/silk-effects/__test__/repos/services__manager.test.ts
generated:
  by: okfit/claude-code
  at: 2026-09-13T01:18:00Z
  body_sha256: 6e4348c9a158c42280d6edf7b1f5da400ff73f4c0da5c0a90713f138df324d2a
---

# Use @effect/vitest per file, not per package

Decide test tooling per FILE, not per package: a test file that runs an Effect uses `@effect/vitest` (`catalog:effect`); a test file with no Effect surface stays on plain `vitest`. Do not assume a package is "on" one or the other — re-derive with `grep -rl "@effect/vitest" --include="*.test.ts" packages e2e`.[^effect-vitest]

Never run a live runner (`Effect.runPromise`/`Effect.runSync`/`runPromiseExit`) inside a test body. The only legitimate use is inside a `beforeAll`/`afterAll` lifecycle hook that `@effect/vitest` does not wrap — and there, always use `runPromise`, never `runSync`, because platform filesystem operations are async and `runSync` throws `AsyncFiberError` out of the hook, failing the whole suite.[^effect-vitest]

## Pick the entry point

- `it.effect` is the default: the body is an `Effect.gen` block running against `TestEnv` (frozen `TestClock`, `TestConsole`).
- `it.live` is for a test that needs real elapsed time (a retry `baseDelay`, a debounce) or real stdout/stderr (a spy on `process.stdout.write` that bypasses Effect's `Console` ref). A test that drives the clock explicitly with `TestClock.adjust` stays on `it.effect`.
- `layer(...)` is for a whole `describe` group sharing one built layer — deliberately rare.
- Plain `it` from `"vitest"` is for files with no Effect surface at all.[^effect-vitest]

## Layer provision: per-test is the default

Provide layers per test with `Effect.provide` inside the test body. Reach for a suite-boundary `layer(...)` block only when the layer is genuinely constant across the group AND holds no state whose lifetime is itself under test.

`layer(...)` memoizes the built layer across every test in the group; per-test `Effect.provide` does not. A `*Test` double with mutable in-memory backing (a captured-calls array, an outputs list) accumulates state across tests under `layer(...)`, producing order-dependent failures far from their cause.

Two shapes justify `layer(...)`:

- The layer is stateless (an empty logger set, a pure validator with no mutable backing), and the group does not depend on ambient process state either (no `chdir`; each test gets its own temp dir).
- The layer is expensive to build and the group is read-only against it (a root-bound runtime built once in `beforeAll`, wrapped in `Layer.suspend` so construction happens inside `layer(...)`'s own nested `beforeAll`, after the fixture hook — never at module scope, which turns a setup failure into a load-time throw that reports `0/0 passed` rather than a named hook failure).[^effect-vitest]

## Filesystem doubles

A test that needs a `FileSystem` provides `MemoryFileSystem.layerWith(seed)` from `@effected/memfs` — never a hand-rolled stub (no `as unknown as FileSystem.FileSystem` cast, no `FileSystem.layerNoop` with a few methods filled in). A hand-rolled stub is dishonest in specific, testable ways: it answers path membership by exact string match instead of normalization, fails with a bare `Error` instead of a typed `PlatformError`, returns one canned body regardless of path, or hands a recursion test an empty tree. `FileSystem.layerNoop` stays acceptable only where the code under test never touches a tree.

Inject faults with `MemoryFileSystem.layerFaulty({ method: handler })` — it delegates by default, so only the named operation fails and everything else runs against genuine filesystem behavior; this is what makes "denied" distinguishable from "missing".

Volume sharing is per BUILD, not per layer value: binding `layerWith(seed)` to a const does not make two `Effect.provide` calls share a volume, since each provide builds an independently re-seeded one. Keep a write and its read-back inside ONE `Effect.provide` over one composed program (e.g. `Layer.provideMerge(ServiceUnderTest.layer, volume)`), or a write-then-read split across two provides reads back the seed and passes vacuously.

memfs records file modes but never enforces them — `chmod` persists and `stat` reports it, but a write to a `0o444` file still succeeds because memfs models no process identity. A test whose subject is the OS refusing an operation (real `EACCES` through a locked ancestor) needs a real tmpdir, not a volume; fault injection substitutes only where the reaction to a denial is the subject, not the denial itself.[^effect-vitest]

## Failure assertions

Assert a typed failure with `Effect.flip` and check the error's `_tag`/fields, not with `Effect.exit` plus `Exit.isFailure`: the exit-inspection shape also passes when the error escapes as a defect, and a nested `is-a-Failure`/`is-a-Some` guard around the assertion can silently skip it, reporting green having asserted nothing. Reserve `Effect.exit` plus `Cause` inspection for tests whose point IS that something escapes the typed channel, with an explicit `throw` on the non-failure branch.[^effect-vitest]

## Test doubles fail loudly

A new test double must fail loudly on an unstubbed member — `Layer.mock`'s `UnimplementedError` or an explicit `Effect.die` — never quietly succeed. Where a service ships its own `*Test` layer, use that layer rather than writing a per-file double.[^effect-vitest]

## Importing `vi`

Any file calling `vi.mock` must import `vi` from `"vitest"`, never from the `@effect/vitest` re-export: vitest hoists `vi.mock` above imports, and the hoist only recognizes the `"vitest"` specifier. `vi.fn`/`vi.spyOn` (not hoisted) may come from either; when in doubt, import `vi` from `"vitest"`.[^effect-vitest]

## Deciding a logging test's entry point

Whether a logging test still observes output under `it.effect` depends on how the code under test writes it: Effect's default logger writes through the `Console` ref, so `TestConsole` silences it under `it.effect`. Code with its own logger writing straight to `process.stderr.write` bypasses the ref, so a spy on it still works under `it.effect`. Decide by verifying the write path in the code under test and confirm by mutation, not by inference.[^effect-vitest]

[^effect-vitest]: `../../packages/silk-effects/__test__/repos/services__manager.test.ts` — a representative file mixing `it.effect`/`it.live`, `Effect.flip`, and memfs volumes
