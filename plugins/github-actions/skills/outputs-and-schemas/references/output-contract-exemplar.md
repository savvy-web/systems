# Output contract devices — a worked exemplar

> Distilled from `@savvy-web/github-action-effects@3.0.4` source and production
> actions built on this stack, 2026-07-23. On version skew the installed source
> wins — re-verify before relying on this.

The worked example is a publish-style action whose `ReportOutput` is a
`Schema.Union` of phase structs, every field annotated. This reference catalogs
the devices so you can reproduce them in any contract. File names follow the
conventions of `outputs-and-schemas`; adapt to your action.

## File anatomy

```text
src/schema/report-output.ts      the contract: consts, annotated schemas, the union
src/schema/projections.ts        pure domain → contract projections
lib/scripts/generate-schema.ts   Effect Schema → committed JSON Schema
__test__/generate-schema.test.ts drift guard
<action-name>.output.schema.json the committed, hosted document
```

The contract module's doc comment states the whole doctrine:

```ts
/**
 * The action's structured JSON output contract.
 *
 * @remarks
 * `ReportOutput` is a `Schema.Union` of phase structs, discriminated by the
 * `phase` literal. It is the single source of truth: the committed
 * `<action-name>.output.schema.json` is generated from it, and `main.ts`
 * emits a Schema-encoded instance as the `result` action output.
 *
 * Field order matters — `setJson` serialises in declaration order, so `$schema`
 * is declared first in every phase struct.
 */
```

## Device 1 — module-level contract consts

```ts
export const SCHEMA_URL =
 "https://raw.githubusercontent.com/<org>/<repo>/main/<action-name>.output.schema.json";

/**
 * In-band schema version. Bumped only on a breaking JSON-shape change
 * (removed/renamed field, changed type) — additive fields do not bump it.
 */
export const SCHEMA_VERSION = "1";
```

Both are exported: the generator uses `SCHEMA_URL` as `$id`, projections stamp
both into every value, the drift test imports them. The bump rule lives in the
doc comment where the next editor will see it.

## Device 2 — derived status with documented precedence

```ts
const StatusLiteral = Schema.Literals(["no-op", "success", "partial", "failed"]).annotate({
 identifier: "ResultStatus",
 title: "Result status",
 description:
  "Coarse human-readable status label, derived from the machine flags. `no-op`: nothing to do this run; `success`: the phase completed cleanly; `partial`: the phase completed but with at least one failure; `failed`: the phase did not succeed and did not produce partial results. Consumers needing failure granularity should read `succeeded`/`hasFailures` and the phase payload instead.",
});

/** The three orthogonal machine flags every phase derives. */
export interface ResultFlags {
 readonly noop: boolean;
 readonly succeeded: boolean;
 readonly hasFailures: boolean;
}

export const deriveStatus = (flags: ResultFlags): ResultStatus => {
 if (flags.noop) return "no-op";
 if (flags.succeeded) return "success";
 if (flags.hasFailures) return "partial";
 return "failed";
};
```

Be honest in the surrounding doc comment: admit that `"partial"` means
"completed with failures", that the flags carry no "some work landed" signal,
and when `"failed"` is a defensive fallthrough the projections never actually
reach. Contract docs that admit their own limits keep downstream agents from
over-reading a field.

## Device 3 — factored field annotations, inlined literals

Shared top-level fields are annotated **once** as consts and reused in every
phase struct:

```ts
const annotatedSchemaUrlField = Schema.Literal(SCHEMA_URL).annotate({
 title: "JSON Schema URL",
 description:
  "URL of the hosted JSON Schema this output conforms to. Editors and json-schema-aware consumers use this for hover docs and validation.",
});

const annotatedSucceededField = Schema.Boolean.annotate({
 title: "Succeeded",
 description: "True when the phase completed cleanly with no failures.",
});

const annotatedDryRunField = Schema.Boolean.annotate({
 title: "Dry run",
 description:
  "True when the action ran with `dry-run: true`. The publish phase publishes nothing in dry-run mode; earlier phases still observe and report, but mutations are suppressed.",
});
```

Keep the `$schema` value a `Schema.Literal` (not a plain string): the union
discriminator must narrow on it. Write cross-cutting semantics into the
description — the `dryRun` prose says what dry-run means **per phase**, not
just "whether dry-run was set".

## Device 4 — per-field annotation grammar

Every leaf gets `title` + `description`; strings with a canonical shape get
`examples`; every named struct gets an `identifier` (which becomes the
`$defs` key in the generated document):

```ts
name: Schema.String.annotate({
 title: "Target branch name",
 description: "The git branch the action operates on and reports against.",
 examples: ["main"],
}),
```

Description conventions to apply throughout the payload structs:

- **State consequences, not just meaning** — for a `hasConflicts`-style flag:
  "When true, the branch needs manual conflict resolution before subsequent
  runs can complete; the action will keep failing on this branch until the
  conflict is resolved."
- **Say when null** — on a nullable struct: "Null when no PR was created
  (nothing to release)."
- **Say when empty** — on an array: "Empty array when no packages matched; the
  action emits a no-op in that case."
- **Cross-reference sibling types** — "The verify phase emits an extended set
  under `VerifyBumpType` that adds `new` and `unknown`." An agent reading one
  variant learns the other exists.

## Device 5 — enum literals whose meanings are spelled out

```ts
skipReason: Schema.NullOr(
 Schema.Literals(["already-published-identical", "already-published-unknown"]),
).annotate({
 identifier: "PublishPackageSkipReason",
 title: "Skip reason",
 description:
  "`already-published-identical` — the version is already published and the tarball digest matches …",
}),
```

Never ship a bare literal enum: each literal's meaning goes in the
description, backtick-quoted so the mapping is unambiguous.

## Device 6 — the phase struct with a full worked example

```ts
export const PublishOutput = Schema.Struct({
 $schema: annotatedSchemaUrlField,          // FIRST — setJson declaration order
 schemaVersion: annotatedSchemaVersionField,
 phase: Schema.Literal("publish").annotate({
  title: "Phase discriminator",
  description: "`publish` identifies this as a publish-phase output.",
 }),
 status: StatusLiteral,
 noop: Schema.Boolean.annotate({
  title: "No-op",
  description:
   "True when no publishable packages were found; the phase exits without contacting any registry.",
 }),
 succeeded: annotatedSucceededField,
 hasFailures: annotatedHasFailuresField,
 dryRun: annotatedDryRunField,
 publish: PublishPayload,
}).annotate({
 identifier: "PublishOutput",
 title: "Publish output",
 description:
  "The structured `result` output emitted when the action runs the publish phase: packs each publishable package, probes the registry, and publishes what is missing.",
 examples: [
  {
   $schema: SCHEMA_URL,
   schemaVersion: SCHEMA_VERSION,
   phase: "publish",
   status: "success",
   noop: false,
   succeeded: true,
   hasFailures: false,
   dryRun: false,
   publish: {
    packages: {
     count: 1,
     published: [{ name: "@example/pkg", version: "1.2.3" }],
    },
   },
  },
 ],
});
```

Each variant carries a **complete, realistic example** in its struct-level
annotation. The examples land in the generated JSON Schema, so editors and
agents see a full instance, not just field types. The shared top-level fields
reuse the factored annotated consts; `noop`'s description is
**phase-specific** and re-annotated per phase.

## Device 7 — the union annotation documenting invariants

```ts
export const ReportOutput = Schema.Union([VerifyOutput, PublishOutput]).annotate({
 identifier: "ReportOutput",
 title: "Action output",
 description:
  'The phase-discriminated output contract. Use `phase` to discriminate to the right variant. Four orthogonal state signals (`status`, `noop`, `succeeded`, `hasFailures`) are derived from the same underlying outcome and obey a fixed relationship: `noop` is true when the phase had nothing to do — in this case `succeeded` is true and `hasFailures` is false; `status` is `"no-op"`. When the phase produced its intended work without errors, `noop` is false, `succeeded` is true, `hasFailures` is false, and `status` is `"success"`. When the phase produced any failure, `status` is `"partial"`. The `status` value `"failed"` is reserved for an impossible flag combination and is never emitted by the current projections; treat `"partial"` as the canonical failure label. `status` is a coarse label for logs and summaries; the three booleans are the machine contract. Every variant carries the same shared top-level fields (`$schema`, `schemaVersion`, `phase`, `status`, `noop`, `succeeded`, `hasFailures`, `dryRun`) plus a phase-specific payload.',
});
export type ReportOutput = Schema.Schema.Type<typeof ReportOutput>;
```

This is the crown device. It tells a consumer: how to discriminate, every
legal flag combination, which value never occurs, which fields are the
contract vs labels, and what every variant shares. Write the equivalent
paragraph for any multi-variant contract you author.

## Projections: the curation rules

Module doctrine for `projections.ts`: each projection takes an **explicit
input interface** — the deliberate seam between sprawling internal types and
the published contract. `main.ts` adapts internal results into these inputs;
the projections stay pure and independently testable.

Curation devices worth copying:

- **Explicit field forwarding, never spreads**:
  `published: input.packages.map((p) => ({ name: p.name, version: p.version }))`
  — only the fields the schema declares cross the seam.
- **Classification helpers with documented rules**: a `classifyTarget` that
  maps the internal result onto the `published`/`skipped`/`failed` enum, with
  numbered curation rules in comments ("Content mismatch is a failure, never a
  skip (curation rule 1)").
- **Orthogonality preserved at the flags**:

  ```ts
  // The three flags are orthogonal by design — noop does not clamp hasFailures;
  // deriveStatus precedence resolves the human-facing label.
  const flags: ResultFlags = {
   noop,
   succeeded: !noop && input.buildsPassed && publishOk,
   hasFailures: !input.buildsPassed || !publishOk,
  };
  ```

- **Derivations live in the projection, not the schema** — e.g. a
  `deriveBumpType` computing `major/minor/patch/new/unknown` from version
  strings; the schema only declares the literal set.
- **Null-tolerant joins documented in @remarks** — when a projected field
  falls back to `null` on a failed join, say so: "falls back to `null`, which
  the schema's `packageName: NullOr(string)` admits."
