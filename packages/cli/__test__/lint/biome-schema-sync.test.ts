import { describe, expect, it } from "@effect/vitest";
import { MemoryFileSystem } from "@effected/memfs";
import { WorkspaceDiscovery, WorkspaceRoot } from "@effected/workspaces";
import { BiomeSchemaSync } from "@savvy-web/silk-effects";
import { Effect, FileSystem, Layer, Logger, Path } from "effect";
import { BIOME_VERSION } from "../../src/commands/lint/biome-version.js";
import { syncBiomeSchemas } from "../../src/commands/lint/init.js";

const ROOT = "/repo";

/** A biome config pinned to a deliberately stale schema version. */
const STALE = `${JSON.stringify({ $schema: "https://biomejs.dev/schemas/1.9.3/schema.json" }, null, "\t")}\n`;

/** The URL every synced config must end up carrying. */
const EXPECTED = `https://biomejs.dev/schemas/${BIOME_VERSION}/schema.json`;

/** A leaf manifest — `version` included, which workspace discovery requires. */
const manifest = (name: string) => JSON.stringify({ name, version: "0.0.0" });

/**
 * Run `syncBiomeSchemas` over an in-memory volume and hand the body the same
 * `FileSystem` it wrote through.
 *
 * Volume sharing is per BUILD, not per layer value: a second `Effect.provide`
 * would build a second, freshly re-seeded volume, and a read-back written
 * against the seed would pass vacuously. So the service graph and the volume
 * are composed into ONE build via `provideMerge`, and the whole body — sync
 * and assertions — runs inside it.
 *
 * `WorkspaceDiscovery.layer({ cwd })` is bound explicitly rather than left to
 * read `process.cwd()`: the volume lives at `/repo`, which the real cwd is not.
 */
function runOnVolume<A, E>(
	seed: Record<string, string>,
	cwd: string,
	body: Effect.Effect<A, E, BiomeSchemaSync | WorkspaceDiscovery | FileSystem.FileSystem>,
): Effect.Effect<A, E> {
	const volume = Layer.provideMerge(MemoryFileSystem.layerWith(seed), Path.layer);
	const workspace = WorkspaceDiscovery.layer({ cwd }).pipe(Layer.provide(WorkspaceRoot.layer));
	const services = Layer.mergeAll(BiomeSchemaSync.layer, workspace);
	return Effect.provide(body, Layer.provideMerge(services, volume).pipe(Layer.provide(Logger.layer([]))));
}

/** Read a file back from the volume the surrounding `runOnVolume` body is running against. */
const readBack = (path: string) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.readFileString(path));

describe("syncBiomeSchemas", () => {
	it.effect("updates leaf-package biome configs as well as the workspace root", () =>
		runOnVolume(
			{
				[`${ROOT}/package.json`]: JSON.stringify({ name: "root", version: "0.0.0", private: true }),
				[`${ROOT}/pnpm-workspace.yaml`]: 'packages:\n  - "packages/*"\n',
				[`${ROOT}/biome.jsonc`]: STALE,
				// One leaf uses biome.json, the other biome.jsonc — both must be found.
				[`${ROOT}/packages/alpha/package.json`]: manifest("alpha"),
				[`${ROOT}/packages/alpha/biome.json`]: STALE,
				[`${ROOT}/packages/beta/package.json`]: manifest("beta"),
				[`${ROOT}/packages/beta/biome.jsonc`]: STALE,
			},
			ROOT,
			Effect.gen(function* () {
				yield* syncBiomeSchemas();

				expect(yield* readBack(`${ROOT}/biome.jsonc`)).toContain(EXPECTED);
				expect(yield* readBack(`${ROOT}/packages/alpha/biome.json`)).toContain(EXPECTED);
				expect(yield* readBack(`${ROOT}/packages/beta/biome.jsonc`)).toContain(EXPECTED);
			}),
		),
	);

	it.effect("leaves a package with no biome config alone", () =>
		runOnVolume(
			{
				[`${ROOT}/package.json`]: JSON.stringify({ name: "root", version: "0.0.0", private: true }),
				[`${ROOT}/pnpm-workspace.yaml`]: 'packages:\n  - "packages/*"\n',
				[`${ROOT}/packages/alpha/package.json`]: manifest("alpha"),
				[`${ROOT}/packages/alpha/biome.json`]: STALE,
				// beta has no biome config at all — the pass must skip it, not create one.
				[`${ROOT}/packages/beta/package.json`]: manifest("beta"),
			},
			ROOT,
			Effect.gen(function* () {
				yield* syncBiomeSchemas();

				expect(yield* readBack(`${ROOT}/packages/alpha/biome.json`)).toContain(EXPECTED);

				const fs = yield* FileSystem.FileSystem;
				expect(yield* fs.exists(`${ROOT}/packages/beta/biome.json`)).toBe(false);
				expect(yield* fs.exists(`${ROOT}/packages/beta/biome.jsonc`)).toBe(false);
			}),
		),
	);

	it.effect("leaves a leaf config whose $schema is not a biomejs.dev URL untouched", () =>
		runOnVolume(
			{
				[`${ROOT}/package.json`]: JSON.stringify({ name: "root", version: "0.0.0", private: true }),
				[`${ROOT}/pnpm-workspace.yaml`]: 'packages:\n  - "packages/*"\n',
				[`${ROOT}/packages/gamma/package.json`]: manifest("gamma"),
				[`${ROOT}/packages/gamma/biome.json`]: '{\n\t"$schema": "./local-schema.json"\n}\n',
			},
			ROOT,
			Effect.gen(function* () {
				yield* syncBiomeSchemas();

				expect(yield* readBack(`${ROOT}/packages/gamma/biome.json`)).toBe('{\n\t"$schema": "./local-schema.json"\n}\n');
			}),
		),
	);

	it.effect("does not abort the remaining roots when one leaf config is malformed", () =>
		runOnVolume(
			{
				[`${ROOT}/package.json`]: JSON.stringify({ name: "root", version: "0.0.0", private: true }),
				[`${ROOT}/pnpm-workspace.yaml`]: 'packages:\n  - "packages/*"\n',
				[`${ROOT}/biome.jsonc`]: STALE,
				[`${ROOT}/packages/alpha/package.json`]: manifest("alpha"),
				[`${ROOT}/packages/alpha/biome.json`]: "{ this is not json",
				[`${ROOT}/packages/zeta/package.json`]: manifest("zeta"),
				[`${ROOT}/packages/zeta/biome.json`]: STALE,
			},
			ROOT,
			Effect.gen(function* () {
				yield* syncBiomeSchemas();

				// alpha's parse failure is reported and skipped; the root and the
				// alphabetically-later leaf are still synced.
				expect(yield* readBack(`${ROOT}/biome.jsonc`)).toContain(EXPECTED);
				expect(yield* readBack(`${ROOT}/packages/zeta/biome.json`)).toContain(EXPECTED);
				expect(yield* readBack(`${ROOT}/packages/alpha/biome.json`)).toBe("{ this is not json");
			}),
		),
	);

	it.effect("falls back to a single default-directory pass when there is no workspace root", () =>
		runOnVolume(
			// No pnpm-workspace.yaml and no `workspaces` field anywhere above the
			// process cwd in this volume: discovery fails root-not-found, and the
			// pass degrades to BiomeSchemaSync's own default directory.
			{ [`${process.cwd()}/biome.json`]: STALE },
			process.cwd(),
			Effect.gen(function* () {
				yield* syncBiomeSchemas();

				expect(yield* readBack(`${process.cwd()}/biome.json`)).toContain(EXPECTED);
			}),
		),
	);
});
