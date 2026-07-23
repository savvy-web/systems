---
name: scaffolding
description: >
  Starting a new Node 24 GitHub Action on this stack — copy the
  pre-configured github-action-template repo, then customize only the action
  identity, inputs/outputs, and entry files. Also the action.yml conventions
  the builder validates and the canonical src/ layout. Never use
  `github-action-builder init` (stale scaffold). Verified against
  @savvy-web/github-action-builder@2.0.4. User-invokable as
  /github-actions:scaffolding.
when_to_use: >
  "create a GitHub Action", "new action", "scaffold an action", "start a
  new action repo", "set up an action", "action.yml conventions", "what goes
  in src/ for an action", "use the action template", "github-action-template"
paths:
  - "**/action.yml"
---

# Scaffolding a new action

New actions start from the template repo, not from a generator and not from
scratch. Everything below is about what to change *after* copying — the
template already carries the repo wiring (scripts, tsconfig, turbo, biome,
workflows, committed `dist/`).

## Start from the template

Copy **<https://github.com/savvy-web/github-action-template>** (use it as a
GitHub template repo, or clone and re-init).

| Do this | Not this |
| --- | --- |
| Copy `github-action-template` | Run `github-action-builder init` — its scaffold is stale: it emits a `GitHubAction.create()` config default export (silently decodes to all-defaults; see `builder-config`), an outdated tsconfig, and `@actions/core` dependencies instead of `@savvy-web/github-action-effects` |
| Keep the template's `package.json` scripts, `tsconfig.json` (`extends "@savvy-web/github-action-builder/tsconfig/action.json"`), `turbo.json`, and committed `dist/` | Re-derive repo wiring by hand — the template is the wiring; deltas only |

Known template staleness (verify on copy, fix in your new repo):

- `src/CLAUDE.md` in the template is a stale leftover — it teaches
  `@actions/core` / `core.getInput` patterns this stack has replaced. Delete
  or rewrite it; the correct idioms are this plugin's `inputs`,
  `runtime-and-layers`, and `logging` skills.
- The entry files (`src/main.ts`, `src/pre.ts`, `src/post.ts`,
  `src/apps/program.ts`) are empty placeholders — you write them.
- The template nests the program at `src/apps/program.ts`; the canonical
  layout puts it at `src/program.ts`. Use `src/program.ts`.

## What to customize after copying

1. **`action.yml` identity** — `name`, `description`, `branding`, then your
   real `inputs:` / `outputs:` (conventions below).
2. **Entry files** — keep only the lifecycle entries the action needs and make
   `action.config.ts` `entries` + `action.yml` `runs:` agree. A single-phase
   action is `main` only (delete `pre.ts`/`post.ts` and the `runs.pre`/
   `runs.post` lines); App-authenticated actions keep all three (see
   `github-app-auth`).
3. **`package.json`** — name, description, repository/homepage/bugs URLs.
   Keep `"private": true`, `"type": "module"`, Node ≥24.
4. **`action.config.ts`** — usually only `entries`; the template default is
   correct otherwise. Dependency-graph options live in `builder-config`.

## Canonical src/ layout

Scale this up as the action grows — never sideways into a different shape:

```text
src/
  main.ts          # 3–8 lines: guard + Action.run(program, { layer: MainLive })
  pre.ts, post.ts  # only if the action has those lifecycle phases
  program.ts       # the Effect pipeline; all orchestration lives here
  state.ts         # Schema.Class cross-phase state + STATE_KEYS (multi-phase only)
  layers/app.ts    # pure Layer wiring, no logic
  schemas/         # Effect Schema domain types (single source of truth)
  errors/          # Schema.TaggedErrorClass hierarchy
  services/        # Context.Service classes + *Live layers
  <module>.test.ts # co-located tests, always
```

Entry files use the guard so tests can import `program` without module-level
execution:

```typescript
/* v8 ignore next 3 */
if (process.env.GITHUB_ACTIONS) {
 await Action.run(program, { layer: MainLive });
}
```

## action.yml conventions

The builder validates `action.yml` against GitHub's metadata schema on every
build (validation details: `builder-config`). Hard schema facts, from the
builder's `src/schemas/action-yml.ts`:

- `runs.using: node24` — exactly. `node20`, `composite`, `docker` all fail.
- Top-level `name`, `description`, and `runs.main` are required.
- Every input and every output **must** have a `description` (schema-required
  for outputs; strict mode makes a missing input description CI-fatal).
- `inputs.*.default` must be a **string** — booleans are quoted (`"false"`).
- `branding.icon` is a closed Feather-icon set; `branding.color` is one of
  nine literals (`white`, `black`, `yellow`, `blue`, `green`, `orange`,
  `red`, `purple`, `gray-dark`). Omitting `branding` builds locally and
  **fails in CI** (auto-strict promotes the warning).

Conventions on top of the schema:

- Non-required inputs carry an explicit `default:` (`""` when genuinely
  empty).
- Multi-line descriptions use YAML `|` blocks and include an inline example
  or the value vocabulary (enumerate output phases, flag meanings).
- A structured JSON output's description points at its hosted JSON Schema URL
  (see `outputs-and-schemas`).

## dist/ and local testing

- `dist/` is **committed** — the runner executes it directly. Every build
  cleans and rewrites it; never hand-edit files there.
- `persistLocal` mirrors the build into `.github/actions/local/` so
  `act` (via the template's `act-test.yml` workflow) can exercise the action
  without publishing. Keep it enabled unless the repo has a reason not to
  (see `builder-config` for the trade-off).
- Verify a fresh scaffold end-to-end before writing features:
  `pnpm typecheck && CI=true pnpm ci:build` — CI-strict surfaces the
  branding/description warnings locally instead of on the runner.

## Reference map

| Reference | Load when |
| --- | --- |
| [repo-wiring.md](./references/repo-wiring.md) | Adopting the pattern in an EXISTING repo (not template-copied), or debugging the scripts/tsconfig/turbo contract the template ships |

## Related skills

`builder-config` owns `action.config.ts` and the dependency decision guide;
`runtime-and-layers` owns the entry-file and layer shapes; `inputs` /
`outputs-and-schemas` own the input/output content this skill only names;
`github-app-auth` decides whether you need `pre`/`post` at all. Route from
`action-engineering`.
