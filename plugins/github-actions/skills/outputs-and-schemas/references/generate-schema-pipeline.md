# The generate-schema pipeline

> Distilled from `@savvy-web/github-action-effects@3.0.4`-era production
> actions and verified against the installed `effect` v4 Schema/JsonSchema
> APIs, 2026-07-23. On version skew the installed source wins — re-verify
> before relying on this.

The canonical pipeline turns the contract's Effect Schema into a committed
Draft-07 document with ajv strict validation, Biome-stable serialization,
write-if-changed, and a drift test. A minimal variant for low-stakes documents
is at the end. The script lives at `lib/scripts/generate-schema.ts`, runs via a
`generate-schema` package script, and commits its output at the repo root.

## Stage by stage

### 1. Convert: Effect Schema → Draft 2020-12 → Draft-07

```ts
import { Effect, FileSystem, JsonSchema, Schema } from "effect";

const document = JsonSchema.toDocumentDraft07(Schema.toJsonSchemaDocument(schema));
```

`Schema.toJsonSchemaDocument` (v4 core `Schema`) emits a `Document` —
`{dialect, schema, definitions}` — on the 2020-12 dialect.
`JsonSchema.toDocumentDraft07` lowers it to Draft-07, rewriting `#/$defs/...`
refs to the canonical Draft-07 `#/definitions/...` form. Schema `identifier`
annotations become the definitions keys — this is why every named struct in
the contract needs one.

### 2. Assemble the published shape + restore `$defs` refs

The published document keeps its definitions pool under `$defs` (a
Draft-07-valid alias), so refs must be rewritten back:

```ts
const DRAFT_07_META_SCHEMA = "http://json-schema.org/draft-07/schema#";

/** Matches a Draft-07 `#/definitions/...` `$ref` pointer prefix. */
const DEFINITIONS_REF_PREFIX = /^#\/definitions(?=\/|$)/;

const restoreDefsRefs = (node: unknown): unknown => {
 if (Array.isArray(node)) return node.map(restoreDefsRefs);
 if (typeof node === "object" && node !== null) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
   out[key] =
    key === "$ref" && typeof value === "string"
     ? value.replace(DEFINITIONS_REF_PREFIX, "#/$defs")
     : restoreDefsRefs(value);
  }
  return out;
 }
 return node;
};

export const buildActionJsonSchema = (schema: Schema.Constraint, $id: string): JsonSchema.JsonSchema => {
 const document = JsonSchema.toDocumentDraft07(Schema.toJsonSchemaDocument(schema));
 return restoreDefsRefs({
  $schema: DRAFT_07_META_SCHEMA,
  $id,
  ...document.schema,
  $defs: document.definitions,
 }) as JsonSchema.JsonSchema;
};
```

`buildActionJsonSchema` is **exported and pure** — the drift test imports it.
`$id` is the hosted `SCHEMA_URL` from the contract module. Skipping the ref
restore ships a document whose `$ref`s point at a `definitions` key that does
not exist — which stage 3 catches, so do not skip stage 3 either.

### 3. Validate with ajv in strict mode

```ts
import { Ajv } from "ajv";

const validateStrict = (document: JsonSchema.JsonSchema): Effect.Effect<void, Error> =>
 Effect.try({
  try: () => {
   const ajv = new Ajv({ strict: true, allErrors: true });
   ajv.compile(document);
  },
  catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
 });
```

Strict compile surfaces unknown keywords and unresolvable `$ref`s **before**
anything is written. `ajv` is a devDependency of the action repo (its optional
plugins also sit on the ecosystem's default builder `ignore` list via
cyclonedx — that only affects the bundled action, not this build-time script).

### 4. Serialize through Biome so regeneration is diff-stable

```ts
const serializeDocument = (path: string, document: JsonSchema.JsonSchema): Effect.Effect<string, Error> =>
 Effect.try({
  try: () =>
   execFileSync("pnpm", ["exec", "biome", "format", `--config-path=${BIOME_CONFIG}`, `--stdin-file-path=${path}`], {
    input: JSON.stringify(document, null, "\t"),
    encoding: "utf8",
    cwd: REPO_ROOT,
   }),
  catch: (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
 });
```

Formatting through Biome **via stdin** (`--stdin-file-path` picks up the
per-path rules) makes the committed file byte-identical to what the
pre-commit hook would produce — so `pnpm generate-schema` never creates a
formatting-only diff and the drift comparison stays stable across
regenerations. If the repo formats JSON with a different tool, route through
that tool the same way.

### 5. Write-if-changed

```ts
const writeIfChanged = (path: string, document: JsonSchema.JsonSchema) =>
 Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const serialized = yield* serializeDocument(path, document);
  const exists = yield* fs.exists(path);
  const current = exists ? yield* fs.readFileString(path) : "";
  if (current === serialized) {
   yield* Effect.log(`Unchanged: ${path}`);
   return;
  }
  yield* fs.writeFileString(path, serialized);
  yield* Effect.log(`Written: ${path}`);
 });
```

### 6. Multiple targets, one driver

```ts
const targets: ReadonlyArray<SchemaTarget> = [
 { schema: ReportOutput, $id: SCHEMA_URL, path: OUTPUT_PATH },        // output contract
 { schema: ActionConfig, $id: INPUT_SCHEMA_URL, path: INPUT_PATH },   // input-config schema
];

const program = Effect.gen(function* () {
 for (const target of targets) {
  const document = buildActionJsonSchema(target.schema, target.$id);
  yield* validateStrict(document);
  yield* writeIfChanged(target.path, document);
 }
});
```

The same pipeline serves output contracts **and** input-config schemas — add a
target per document.

### 7. Direct-invocation guard + runtime

```ts
const invokedDirectly =
 process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (invokedDirectly) {
 await Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer)));
}
```

The guard keeps the module importable by the drift test without executing.
`NodeServices.layer` (from `@effect/platform-node`) provides `FileSystem`.

## The drift test

```ts
// __test__/generate-schema.test.ts
import { buildActionJsonSchema } from "../lib/scripts/generate-schema.js";

const cases = [
 { file: "<action-name>.output.schema.json", schema: ReportOutput, $id: SCHEMA_URL },
 { file: "<action-name>.input.schema.json", schema: ActionConfig, $id: INPUT_SCHEMA_URL },
];

describe("generated action JSON Schemas", () => {
 for (const c of cases) {
  it(`${c.file} matches its Effect Schema source`, () => {
   const generated = buildActionJsonSchema(c.schema, c.$id);
   const committed = JSON.parse(readFileSync(resolve(REPO_ROOT, c.file), "utf8"));
   expect(committed).toEqual(generated);
  });
 }
});
```

The comparison is on **parsed JSON**, not bytes — formatting differences
cannot flake it; the Biome stage exists so the committed *file* is also
hook-stable. Put the fix instruction in the test file's header comment: "If
this fails, run `pnpm generate-schema` and commit the regenerated files."

## The minimal variant, and what it lacks

```ts
// lib/scripts/generate-schema.ts (abridged minimal form)
const { schema, definitions } = JsonSchema.toDocumentDraft07(Schema.toJsonSchemaDocument(ActionConfig));

const schemaWithMeta = {
 $schema: "http://json-schema.org/draft-07/schema#",
 title: "My Action Configuration",
 description: "Configuration file for the my-action workflow that …",
 ...schema,
 ...(Object.keys(definitions).length > 0 ? { definitions } : {}),
};

await writeFile(OUTPUT_PATH, `${JSON.stringify(schemaWithMeta, null, "\t")}\n`, "utf-8");
```

Differences from the canonical pipeline: keeps refs on `definitions` (no
restore needed since it emits that key), plain `JSON.stringify` (no
format-stable serialization), no `$id`, no ajv validation, no
write-if-changed, no drift test, raw `node:fs` instead of the Effect
`FileSystem`. Acceptable for a small single-struct config schema; upgrade to
the canonical pipeline the moment the document matters to downstream
consumers.

## Wiring checklist

- `lib/scripts/generate-schema.ts`, run by a `generate-schema` package script.
- Output committed at the repo root, named `<action-name>.output.schema.json`
  / `<action-name>.input.schema.json` (or `<config>.schema.json`).
- `SCHEMA_URL` in the contract module points at where the committed file is
  actually hosted —
  `https://raw.githubusercontent.com/<org>/<repo>/main/<file>` works from day
  one; a SchemaStore registration is optional later.
- Drift test in `__test__/` importing the pure builder.
- devDependencies: `ajv`, `@effect/platform-node` (for `NodeServices.layer`).
