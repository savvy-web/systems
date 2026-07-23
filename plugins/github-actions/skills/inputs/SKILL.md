---
name: inputs
description: >
  Declaring, reading, and validating GitHub Action inputs with Effect Config
  and ActionInput — the INPUT_* key mapping, the YAML 1.2 boolean rule,
  multiline discipline, Redacted secrets, the validated inputs.ts struct
  pattern, and the action.yml input conventions. Verified against
  @savvy-web/github-action-effects@3.0.4.
  User-invokable as /github-actions:inputs.
when_to_use: >
  "read an action input", "declare inputs", "validate inputs", "boolean
  input", "multiline input", "Config.string vs getInput", "input default",
  "secret input", "INPUT_ environment variable", "parse a semver input",
  "inputs.ts", "required input", "action.yml inputs section"
paths:
  - "**/action.yml"
---

# Action inputs

Inputs are read through Effect's `Config` API against an `ActionsConfigProvider`
that `Action.run` installs for you — there is deliberately **no `ActionInputs`
service** in `@savvy-web/github-action-effects`. Read each input at its point of
use (or in a dedicated `inputs.ts` once the action has more than ~4 inputs),
apply defaults with `Config.withDefault`, and promote anything that needs
cross-field or format validation into a tagged error before the program's real
work begins. Tests inject inputs with `ConfigProvider.fromUnknown` — never by
mutating `process.env`.

## The key mapping (ActionsConfigProvider)

`Config.string("name")` reads `INPUT_<NAME>`: spaces become underscores, the
whole key is uppercased, and **hyphens are preserved** — matching GitHub's own
runner behavior (`src/runtime/ActionsConfigProvider.ts:27-38` in the installed
`@savvy-web/github-action-effects` source).

| Config key | Environment variable |
| --- | --- |
| `Config.string("name")` | `INPUT_NAME` |
| `Config.string("retry-count")` | `INPUT_RETRY-COUNT` |
| `Config.string("my input")` | `INPUT_MY_INPUT` |

**An empty string is treated as missing** and raises the same missing-data
`Config.ConfigError` as an unset variable. This is why every optional
`action.yml` input can safely declare `default: ""` — the provider converts it
to "absent" and your `Config.withDefault` supplies the real default.

## Reading inputs: the four forms

```ts
import { Config, Effect, Redacted } from "effect";
import { ActionInput } from "@savvy-web/github-action-effects";

const program = Effect.gen(function* () {
 // string with default — the workhorse
 const branch = yield* Config.string("target-branch").pipe(Config.withDefault("main"));

 // integer — v4 is Config.int (Config.integer does not exist; the effects
 // package docs showing it are stale)
 const timeout = yield* Config.int("timeout").pipe(Config.withDefault(180));

 // boolean — ALWAYS ActionInput.boolean, never Config.boolean (see below)
 const dryRun = yield* ActionInput.boolean("dry-run").pipe(Config.withDefault(false));

 // multiline list — split on \n, empty lines dropped, each line trimmed
 const paths = yield* ActionInput.multiline("paths").pipe(Config.withDefault([]));

 // secret — stays Redacted end-to-end; unwrap only at the last moment
 const token = yield* Config.redacted("token");
 const raw = Redacted.value(token); // only where the raw string is unavoidable
});
```

Defaults live **at the point of use** via `Config.withDefault`, mirroring the
`default:` in `action.yml`. Keep the two in agreement; the `action.yml` default
is what workflow authors see, the `withDefault` is what actually executes.

## Booleans: the YAML 1.2 rule

GitHub Actions follows the YAML 1.2 "Core Schema" **exactly**: the accepted set
is `true | True | TRUE | false | False | FALSE` (whitespace-trimmed). Effect's
`Config.boolean` accepts a different set.

| Do this | Not this |
| --- | --- |
| `ActionInput.boolean("dry-run")` — accepts exactly the YAML 1.2 set, fails everything else with a `Config.ConfigError` (`src/runtime/ActionInput.ts:42-64`) | `Config.boolean("dry-run")` — silently accepts `yes`/`on`/`1` (which GitHub's own runtime rejects) and **rejects `True`** (which GitHub accepts) |

A workflow author writing `dry-run: True` (valid YAML, valid for GitHub) gets a
confusing failure from `Config.boolean` and a correct `true` from
`ActionInput.boolean`. There is no situation in an action where `Config.boolean`
is the right call.

## Multiline lists

`ActionInput.multiline(name)` matches `@actions/core.getMultilineInput`: split
on `\n`, drop empty lines, trim each remaining line
(`src/runtime/ActionInput.ts:77-85`). A missing input is a missing-data error —
combine with `Config.withDefault([])`.

For list inputs that should tolerate comments, layer a `stripComments` helper on
top rather than inventing a permissive parser:

```ts
const stripComments = (lines: ReadonlyArray<string>): ReadonlyArray<string> =>
 lines.map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("#"));

const packages = stripComments(yield* ActionInput.multiline("packages").pipe(Config.withDefault([])));
```

| Do this | Not this |
| --- | --- |
| Newline-separated values via `ActionInput.multiline` (+ `stripComments`) — the GitHub-native form | A hand-rolled permissive parser accepting JSON arrays / bullet lists / comma-separation — a compatibility wart that multiplies the formats every consumer must know and document |

## Secrets

Read secrets with `Config.redacted(name)` and keep them `Redacted<string>`
through the entire program — `Redacted` prints as `<redacted>` in logs and
`Cause` output. Unwrap with `Redacted.value` only at the API boundary that needs
the raw string, and mask any secret the action *generates* with
`ActionOutputs.setSecret` before it can appear in a log. The GitHub App key
inputs (`app-private-key`) are the canonical case — see `github-app-auth`.

## The `inputs.ts` pattern (>4 inputs)

Once an action reads more than a handful of inputs, extract a dedicated
`inputs.ts` exporting one Effect that returns a validated, immutable struct:

```ts
export interface ParsedInputs {
 readonly configFile: string;
 readonly patterns: ReadonlyArray<PackagePattern>;
 readonly packages: ReadonlyArray<string>;
 readonly dryRun: boolean;
 // ...
}

export const parseInputs: Effect.Effect<ParsedInputs, InvalidInputError | Config.ConfigError> =
 Effect.gen(function* () {
  const configFile = yield* Config.string("config-file").pipe(
   Config.withDefault(".github/publish.config.json"),
  );
  const rawPatterns = yield* ActionInput.multiline("patterns").pipe(Config.withDefault([]));
  const patterns = yield* parsePatterns(rawPatterns); // per-line format validation
  const packages = stripComments(yield* ActionInput.multiline("packages").pipe(Config.withDefault([])));

  // Cross-field validation fails with a tagged error, not a defect
  if (patterns.length === 0 && packages.length === 0) {
   return yield* Effect.fail(
    new InvalidInputError({
     field: "packages / patterns",
     value: undefined,
     reason: "At least one selection method must be configured: provide 'packages' and/or 'patterns'",
    }),
   );
  }

  const dryRun = yield* ActionInput.boolean("dry-run").pipe(Config.withDefault(false));
  // ...
  return { configFile, patterns, packages: [...packages], dryRun /* ... */ };
 });
```

The rules the pattern encodes:

- One exported Effect, one exported readonly interface. `program.ts` calls
  `yield* parseInputs` once and threads the struct.
- Per-value format validation (each `parsePatterns` line) and cross-field
  validation both fail with a **tagged error** carrying `field`, `value`, and a
  human `reason` — `Action.run` formats it as `[InvalidInputError] …` and the
  run fails with a clear annotation.
- An action that reads a dozen-plus inputs inline in `program.ts` turns its
  orchestration file into its least readable one — extract early, before the
  reads sprawl.

## Up-front format validation (semver, enums)

Validate constrained inputs **before** the program does any real work, mapping
parse failures into the library's `ActionInputError{inputName, reason,
rawValue}`. The pattern for inputs that accept keywords OR a semver range:

```ts
for (const [inputName, value, keywords] of [
 ["node-version", rawNodeVersion, ["auto", "lts"]],
 ["package-manager-version", rawPmVersion, ["auto", "latest"]],
] as const) {
 if (!(keywords as ReadonlyArray<string>).includes(value)) {
  yield* Range.parse(value).pipe(
   Effect.mapError(
    (e) =>
     new ActionInputError({
      inputName,
      reason: `Invalid semver range: ${String(e)}`,
      rawValue: value,
     }),
   ),
  );
 }
}
```

For soft enums where a wrong value should degrade rather than fail, log the
decision explicitly — warn and fall back to the default; a silent fallback is a
debugging trap. See `logging` for the decision-log doctrine.

## action.yml input conventions

- Every input carries a `description` — the builder's CI-strict validation
  fails the build on inputs without one (see `builder-config`).
- Non-required inputs with a meaningful default declare it explicitly;
  booleans are **quoted strings** (`default: "false"`), because `action.yml`
  values are strings.
- Multiline inputs get a `|`/`|-` block description with an inline `Example:`
  showing the exact expected line format.
- App-auth actions declare `app-client-id` and `app-private-key` as
  `required: true` (see `github-app-auth`).
- Keep `action.yml` defaults and `Config.withDefault` values in sync by hand —
  nothing checks this for you.

## Anti-patterns

| Do this | Not this |
| --- | --- |
| `yield* Config.string("target-branch").pipe(Config.withDefault("main"))` | `core.getInput("target-branch") \|\| "main"` — the `@actions/core` pattern; conflates empty and missing, bypasses the ConfigProvider, untestable without env mutation |
| `ActionInput.boolean` | `Config.boolean` — wrong truth set for GitHub (see above) |
| Fail early with `ActionInputError`/`InvalidInputError` carrying `inputName`/`field` + `rawValue` | Letting a malformed input surface later as a defect deep in the pipeline |
| Tests: `Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ "dry-run": "true" })))` | Tests that write `process.env.INPUT_DRY-RUN` — order-dependent, leaks between tests (see `testing-actions`) |

## Related skills

`action-engineering` routes the library; `outputs-and-schemas` covers the other
direction (writing outputs); `github-app-auth` covers the auth inputs
specifically; `errors-and-state` covers the tagged-error house style the
validation errors follow; `testing-actions` covers injecting inputs in tests;
`builder-config` covers the `action.yml` validation the builder enforces.
