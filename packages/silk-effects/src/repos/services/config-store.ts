import { FileSystem, Path } from "@effect/platform";
import { Context, Effect, Layer, Schema } from "effect";
import { MANIFEST_PATH } from "../constants.js";
import { ReposConfigError } from "../errors.js";
import { ReposManifestFile } from "../schemas/manifest.js";

/** @internal */
export interface ReposConfigStoreShape {
	readonly exists: (root: string) => Effect.Effect<boolean>;
	readonly read: (root: string) => Effect.Effect<ReposManifestFile, ReposConfigError>;
	readonly write: (root: string, manifest: ReposManifestFile) => Effect.Effect<void, ReposConfigError>;
}

const _tag = Context.Tag("@savvy-web/silk-effects/ReposConfigStore");
/** @internal */
export const ReposConfigStoreBase = _tag<ReposConfigStore, ReposConfigStoreShape>();
/**
 * Reads, validates, and writes the .repos/config.json manifest.
 * @public
 */
export class ReposConfigStore extends ReposConfigStoreBase {}

/**
 * Live layer over the platform FileSystem.
 * @public
 */
export const ReposConfigStoreLive: Layer.Layer<ReposConfigStore, never, FileSystem.FileSystem | Path.Path> =
	Layer.effect(
		ReposConfigStore,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const manifestPath = (root: string) => path.join(root, MANIFEST_PATH);

			const exists = (root: string) => fs.exists(manifestPath(root)).pipe(Effect.orElseSucceed(() => false));

			const read = (root: string) =>
				Effect.gen(function* () {
					const present = yield* exists(root);
					if (!present) {
						return yield* Effect.fail(
							new ReposConfigError({ path: manifestPath(root), reason: "no such file", kind: "missing" }),
						);
					}
					const text = yield* fs
						.readFileString(manifestPath(root))
						.pipe(
							Effect.mapError(
								(cause) => new ReposConfigError({ path: manifestPath(root), reason: String(cause), kind: "invalid" }),
							),
						);
					const json = yield* Effect.try({
						try: () => JSON.parse(text) as unknown,
						catch: (cause) =>
							new ReposConfigError({
								path: manifestPath(root),
								reason: `invalid JSON: ${String(cause)}`,
								kind: "invalid",
							}),
					});
					return yield* Schema.decodeUnknown(ReposManifestFile)(json).pipe(
						Effect.mapError(
							(cause) => new ReposConfigError({ path: manifestPath(root), reason: String(cause), kind: "invalid" }),
						),
					);
				});

			const write = (root: string, manifest: ReposManifestFile) =>
				Effect.gen(function* () {
					const dir = path.join(root, ".repos");
					yield* fs.makeDirectory(dir, { recursive: true }).pipe(Effect.orElseSucceed(() => undefined));
					const encoded = yield* Schema.encode(ReposManifestFile)(manifest).pipe(
						Effect.mapError(
							(cause) => new ReposConfigError({ path: manifestPath(root), reason: String(cause), kind: "invalid" }),
						),
					);
					yield* fs
						.writeFileString(manifestPath(root), `${JSON.stringify(encoded, null, "\t")}\n`)
						.pipe(
							Effect.mapError(
								(cause) => new ReposConfigError({ path: manifestPath(root), reason: String(cause), kind: "invalid" }),
							),
						);
				});

			return { exists, read, write };
		}),
	);
