---
name: outputs-and-schemas
description: >
  Machine-readable action output contracts for downstream agent and workflow
  consumption — Effect Schema as the single source of truth, the annotated
  $schema/schemaVersion/flags contract shape, pure projections, the
  generate-schema pipeline that commits a drift-tested JSON Schema, and
  setJson emission with convenience scalars. Distilled from production
  actions on this stack; verified against
  @savvy-web/github-action-effects@3.0.4.
  User-invokable as /github-actions:outputs-and-schemas.
when_to_use: >
  "action outputs", "setJson", "JSON schema for action outputs",
  "machine-readable output", "outputs for downstream agents", "structured
  result output", "generate-schema", "schema drift test", "output contract",
  "schemaVersion", "document outputs in action.yml", "config file JSON
  schema", "fromJSON in a workflow"
paths:
  - "**/lib/scripts/generate-schema.ts"
  - "**/*.schema.json"
---

# Output contracts and JSON Schemas

An action that other workflows — and especially other *agents* — consume needs
one structured `result` output whose shape is an Effect Schema, plus a
committed JSON Schema generated from that same source, plus a handful of
convenience scalars. The Effect Schema is the single source of truth; the JSON
Schema document, the emitted JSON, and the projection functions are all derived
from it and drift-tested. There is **no JSON-Schema generator in the effects
library itself** — this is an action-side pattern built on
`Schema.toJsonSchemaDocument` from `effect` and `ActionOutputs.setJson`. The
worked exemplar contract lives in
[output-contract-exemplar.md](./references/output-contract-exemplar.md).

## The contract shape

Keep the contract in one module (`src/schema/report-output.ts` by convention).
Every phase/variant struct shares the same top-level fields, in this order:

```ts
/** Hosted JSON Schema URL; the emitted `result` carries this as `$schema`. */
export const SCHEMA_URL =
 "https://raw.githubusercontent.com/<org>/<repo>/main/<action-name>.output.schema.json";

/**
 * In-band schema version. Bumped only on a breaking JSON-shape change
 * (removed/renamed field, changed type) — additive fields do not bump it.
 */
export const SCHEMA_VERSION = "1";
```

1. **`$schema` — declared FIRST.** `ActionOutputs.setJson` serialises in
   Schema **declaration order**, so `$schema` must be the first field of every
   struct for the emitted JSON to lead with it. Model it as
   `Schema.Literal(SCHEMA_URL)` — a literal, not a plain string, so a union
   discriminates cleanly and the value is pinned.
2. **`schemaVersion`** — `Schema.Literal(SCHEMA_VERSION)`. The bump rule is
   part of the contract: bump **only** on a breaking shape change
   (removed/renamed field, changed type); additive fields do not bump it.
3. **A discriminator** — a `phase`/`kind` literal per variant when the action
   has more than one outcome shape. Consumers switch on it first.
4. **Orthogonal machine booleans + a derived human status.** Three flags —
   `noop`, `succeeded`, `hasFailures` — are the machine contract; `status`
   (`"no-op" | "success" | "partial" | "failed"`) is derived from them by one
   function and exists for logs and humans only:

```ts
// Precedence: no-op, success, partial, failed
export const deriveStatus = (flags: ResultFlags): ResultStatus => {
 if (flags.noop) return "no-op";
 if (flags.succeeded) return "success";
 if (flags.hasFailures) return "partial";
 return "failed";
};
```

| Do this | Not this |
| --- | --- |
| Consumers branch on `noop`/`succeeded`/`hasFailures`; `status` is a label | Making `status` the contract — a coarse enum forces breaking changes the moment a consumer needs finer granularity |
| Keep the flags orthogonal (`noop` does not clamp `hasFailures`; `deriveStatus` precedence resolves the label) | Encoding precedence into the flags themselves |
| Same shared top-level fields on **every** variant | Per-variant top-level shapes that force consumers to discriminate before reading even `succeeded` |

1. **Phase payload last** — one nested struct per variant carrying the
   phase-specific facts.

## Annotations are written for LLM consumers

Every field gets `.annotate({title, description, examples?})`; every named type
gets an `identifier`. The `description` prose is the documentation a downstream
agent reads — write it to preempt the questions an agent would otherwise guess
at: what each literal means, when a field is `null`, which fields to trust.

```ts
// A literal enum whose meanings are spelled out in the description
skipReason: Schema.NullOr(
 Schema.Literals(["already-published-identical", "already-published-unknown"]),
).annotate({
 identifier: "PublishPackageSkipReason",
 title: "Skip reason",
 description:
  "`already-published-identical` — the version is already published and the tarball digest matches …",
}),
```

**Document cross-field invariants on the union/root annotation** — the single
highest-leverage device in the whole pattern. The root annotation states, in
prose, the fixed relationship between `status`, `noop`, `succeeded`, and
`hasFailures`, which flag combinations occur, which values are never emitted,
and that "the three booleans are the machine contract." An agent reading only
the JSON Schema learns the semantics, not just the types. Load
[output-contract-exemplar.md](./references/output-contract-exemplar.md) before
writing contract annotations — it carries the full device vocabulary.

## Projections stay pure

Never build contract values inline in `main.ts`/`program.ts`. Write one pure
projection function per variant in `src/schema/projections.ts`: an explicit
input interface in, a schema struct out, no I/O.

```ts
export const toPublishOutput = (input: PublishInput): PublishOutput => {
 const flags: ResultFlags = {
  noop: input.packages.length === 0,
  succeeded: input.failures.length === 0,
  hasFailures: input.failures.length > 0,
 };
 return {
  $schema: SCHEMA_URL,
  schemaVersion: SCHEMA_VERSION,
  phase: "publish",
  status: deriveStatus(flags),
  noop: flags.noop,
  succeeded: flags.succeeded,
  hasFailures: flags.hasFailures,
  dryRun: input.dryRun,
  publish: {
   /* … */
   packages: {
    count: input.packages.length,
    // Explicit projection — only forward the fields the schema declares.
    published: input.packages.map((p) => ({ name: p.name, version: p.version })),
   },
  },
 };
};
```

The projection is the **curation seam**: it drops internal noise, normalises
statuses, and forwards only declared fields (never spread an internal object
into the contract). Because it is pure it is trivially unit-testable, and any
derived markdown report built from the same value is "provably a projection of
the exact emitted JSON."

## The generate-schema pipeline

`lib/scripts/generate-schema.ts` turns the Effect Schema into a committed
Draft-07 document. The full walkthrough with verbatim functions is in
[generate-schema-pipeline.md](./references/generate-schema-pipeline.md); the
stages, each load-bearing:

1. `Schema.toJsonSchemaDocument(schema)` → Draft 2020-12 document
   (`{dialect, schema, definitions}`).
2. `JsonSchema.toDocumentDraft07(...)` → Draft-07 (rewrites `#/$defs/...` refs
   to `#/definitions/...`).
3. Assemble `{$schema: draft-07 meta, $id: SCHEMA_URL, ...document.schema,
   $defs: document.definitions}` and **rewrite refs back to `#/$defs/...`** so
   they resolve against the `$defs` pool the document actually uses.
4. **ajv `{strict: true, allErrors: true}` compile** — catches unknown
   keywords and unresolvable `$ref`s before anything is written.
5. **Biome-format via stdin** (`--stdin-file-path`) so the committed file is
   byte-identical to what the pre-commit hook would produce — regeneration
   never creates formatting-only diffs.
6. **Write-if-changed**, logging `Written`/`Unchanged`.

Keep the document builder (`buildActionJsonSchema`) exported and pure — the
drift test imports it directly:

```ts
// __test__/generate-schema.test.ts — the committed file must equal regeneration
const generated = buildActionJsonSchema(c.schema, c.$id);
const committed = JSON.parse(readFileSync(resolve(REPO_ROOT, c.file), "utf8"));
expect(committed).toEqual(generated);
```

The schema JSON is **committed at the repo root** and hosted at `SCHEMA_URL` —
`https://raw.githubusercontent.com/<org>/<repo>/main/<action-name>.output.schema.json`
(registering it with SchemaStore later is optional; the raw URL works from day
one). Wire `pnpm generate-schema` as the regen script; the drift test's failure
message tells the next agent exactly what to run.

## Emission

Emit **one `result` JSON output plus convenience scalars** mirroring the
most-wanted facts, so a workflow `if:` never needs `fromJSON`:

```ts
yield* outputs
 .setJson("result", output, ReportOutput) // validates against the schema before serialising
 .pipe(
  Effect.catch((e) =>
   Effect.logWarning(`Failed to emit structured "result" output: ${e instanceof Error ? e.message : String(e)}`),
  ),
 );
yield* outputs.set("phase", output.phase);
yield* outputs.set("status", output.status);
yield* outputs.set("succeeded", output.succeeded ? "true" : "false");
yield* outputs.set("package-count", String(scalars.packageCount));
yield* outputs.set("report-pr-number", scalars.prNumber === null ? "" : String(scalars.prNumber));
```

- `setJson(name, value, schema)` validates against the Schema before
  serialising and fails `ActionOutputError` — emission is **non-fatal**
  (`Effect.catch` → `logWarning`): a reporting failure must not fail a run
  whose real work succeeded.
- Scalars are strings; booleans as `"true"`/`"false"`, absent numbers as `""`.
- In `action.yml`, document `result` by pointing at the hosted schema URL and
  cross-referencing the scalars:

```yaml
outputs:
  result:
    description: |
      Structured JSON describing what the run did. A phase-discriminated object
      validated by
      https://raw.githubusercontent.com/<org>/<repo>/main/<action-name>.output.schema.json.
      Parse it for the full contract; the scalars below mirror the common facts.
  succeeded:
    description: Whether all intended work completed (or correctly did nothing)
```

## Scale to the action

Not every action needs the full apparatus. The tiers, smallest that fits:

- **Scalars only** — a router/pre-flight action emitting a handful of flat
  facts other jobs branch on.
- **`setJson` struct** — one `result` struct + scalars, no committed schema.
  Adopt when consumers parse JSON but the shape is small and single-variant.
- **Full contract** — `$schema`/`schemaVersion`/discriminator/flags +
  annotations + generated committed schema + drift test. Adopt the moment
  downstream **agents** consume the output or the shape has variants. Minimum
  bar at this tier: `$schema` first, `schemaVersion`, orthogonal booleans, a
  discriminator, convenience scalars.

**Input-config schemas** are the same pipeline pointed at an input: an action
that reads a JSON config file generates and commits
`<config-name>.schema.json` from the config's own Effect Schema, so editors
and agents get validation and hover docs when writing the file. The config
file's own `$schema` field is `Schema.optional(Schema.String)` in the config
schema so users may pin it.

## Anti-patterns

| Do this | Not this |
| --- | --- |
| `$schema` declared first in every struct | Alphabetical/arbitrary field order — `setJson` serialises declaration order; `$schema` buried mid-object |
| Bump `SCHEMA_VERSION` only on breaking shape changes | Bumping on additive fields (churns consumers), or never bumping (silently breaks them) |
| Pure projections forwarding declared fields | `setJson("result", internalResult as never, …)` or spreading internal objects into the contract |
| Non-fatal emission (`Effect.catch` → `logWarning`) | Letting `ActionOutputError` on a reporting write fail a run whose work succeeded |
| Committed schema + drift test importing the pure builder | A generator script with no test — the committed file rots the first time the Schema changes |
| ajv strict-compile before writing | Trusting the converter — unresolvable `$ref`s ship silently otherwise |

## Reference map

| Reference | Load when |
| --- | --- |
| [output-contract-exemplar.md](./references/output-contract-exemplar.md) | Writing or reviewing contract schemas/annotations/projections — the full device vocabulary with a worked contract |
| [generate-schema-pipeline.md](./references/generate-schema-pipeline.md) | Writing or debugging a generate-schema script — the verbatim pipeline functions and the drift test |

## Related skills

`inputs` covers the reading direction; `checks-and-reports` renders the same
projected value as markdown for humans; `errors-and-state` covers
`ActionOutputError` handling posture; `testing-actions` covers asserting
emitted outputs via `ActionOutputsTest`; `action-engineering` routes the
library surface (`ActionOutputs`, `setJson`, `summary`).
