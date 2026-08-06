import { Context, Effect, FileSystem, Layer, Path, Schedule, Schema } from "effect";
import { MANIFEST_PATH, REPOS_DIR } from "../constants.js";
import { ReposConfigError } from "../errors.js";
import { ReposManifestFile } from "../schemas/manifest.js";

/**
 * The {@link ReposConfigStore} service shape.
 * @public
 */
export interface ReposConfigStoreShape {
	readonly exists: (root: string) => Effect.Effect<boolean>;
	readonly read: (root: string) => Effect.Effect<ReposManifestFile, ReposConfigError>;
	readonly write: (root: string, manifest: ReposManifestFile) => Effect.Effect<void, ReposConfigError>;
	/**
	 * Serialized read-modify-write: acquires an exclusive-create lock file
	 * beside the manifest, reads the current manifest (an absent manifest is
	 * passed to `fn` as `{ repos: {} }` — `update` can initialize), runs `fn`,
	 * writes the result, and always releases the lock. Concurrent callers
	 * queue behind the lock rather than racing a lost update.
	 */
	readonly update: (
		root: string,
		fn: (manifest: ReposManifestFile) => ReposManifestFile | Effect.Effect<ReposManifestFile, ReposConfigError>,
	) => Effect.Effect<ReposManifestFile, ReposConfigError>;
}

/**
 * Reads, validates, and writes the .repos/config.json manifest.
 * @public
 */
export class ReposConfigStore extends Context.Service<ReposConfigStore, ReposConfigStoreShape>()(
	"@savvy-web/silk-effects/ReposConfigStore",
) {
	/**
	 * Production layer over the core FileSystem.
	 * @public
	 */
	static readonly layer: Layer.Layer<ReposConfigStore, never, FileSystem.FileSystem | Path.Path> = Layer.effect(
		this,
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const path = yield* Path.Path;
			const manifestPath = (root: string) => path.join(root, MANIFEST_PATH);

			const exists = (root: string) => fs.exists(manifestPath(root)).pipe(Effect.orElseSucceed(() => false));

			const read = (root: string) =>
				Effect.gen(function* () {
					// A failing stat is NOT the same thing as "the file is absent" --
					// it can mean a permissions error, a broken symlink, or an
					// unreadable mount. Only a stat that SUCCEEDS and returns false
					// means "no manifest yet" (kind "missing"); a failing stat is a
					// real, surfaced error (kind "invalid") so callers that treat
					// "missing" as "safe to reinitialize" (see `ReposManager.add`)
					// can never mistake a transient I/O failure for an empty
					// manifest.
					const present = yield* fs.exists(manifestPath(root)).pipe(
						Effect.mapError(
							(cause) =>
								new ReposConfigError({
									path: manifestPath(root),
									reason: `stat failed: ${String(cause)}`,
									kind: "invalid",
								}),
						),
					);
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
					return yield* Schema.decodeUnknownEffect(ReposManifestFile)(json).pipe(
						Effect.mapError(
							(cause) => new ReposConfigError({ path: manifestPath(root), reason: String(cause), kind: "invalid" }),
						),
					);
				});

			const write = (root: string, manifest: ReposManifestFile) =>
				Effect.gen(function* () {
					const dir = path.join(root, REPOS_DIR);
					yield* fs.makeDirectory(dir, { recursive: true }).pipe(
						Effect.mapError(
							(cause) =>
								new ReposConfigError({
									path: manifestPath(root),
									reason: `mkdir failed: ${String(cause)}`,
									kind: "invalid",
								}),
						),
					);
					const encoded = yield* Schema.encodeEffect(ReposManifestFile)(manifest).pipe(
						Effect.mapError(
							(cause) => new ReposConfigError({ path: manifestPath(root), reason: String(cause), kind: "invalid" }),
						),
					);
					// Write atomically: encode to a sibling `.tmp` file, then rename
					// it onto the real manifest path. `rename` is atomic on the same
					// filesystem, so readers never observe a partially-written
					// manifest.
					const tmpPath = `${manifestPath(root)}.tmp`;
					yield* fs
						.writeFileString(tmpPath, `${JSON.stringify(encoded, null, "\t")}\n`)
						.pipe(
							Effect.mapError(
								(cause) => new ReposConfigError({ path: manifestPath(root), reason: String(cause), kind: "invalid" }),
							),
						);
					yield* fs.rename(tmpPath, manifestPath(root)).pipe(
						Effect.mapError(
							(cause) =>
								new ReposConfigError({
									path: manifestPath(root),
									reason: `rename failed: ${String(cause)}`,
									kind: "invalid",
								}),
						),
					);
				});

			// Retry the exclusive-create lock acquisition with exponential
			// backoff, capped at 2s total elapsed -- long enough to ride out a
			// contending writer's read-modify-write cycle, short enough that a
			// genuinely stuck (crashed-holder) lock fails fast rather than
			// hanging the caller.
			const lockSchedule = Schedule.exponential("25 millis").pipe(Schedule.upTo({ duration: "2 seconds" }));

			const acquireLock = (root: string) =>
				Effect.gen(function* () {
					const lockPath = `${manifestPath(root)}.lock`;
					const dir = path.join(root, REPOS_DIR);
					yield* fs
						.makeDirectory(dir, { recursive: true })
						.pipe(
							Effect.mapError(
								(cause) =>
									new ReposConfigError({ path: lockPath, reason: `mkdir failed: ${String(cause)}`, kind: "invalid" }),
							),
						);
					yield* Effect.scoped(fs.open(lockPath, { flag: "wx" })).pipe(
						Effect.asVoid,
						Effect.retry({
							schedule: lockSchedule,
							while: (error) => error.reason._tag === "AlreadyExists",
						}),
						Effect.mapError(
							(cause) =>
								new ReposConfigError({
									path: lockPath,
									reason: `timed out acquiring lock: ${String(cause)}`,
									kind: "invalid",
								}),
						),
					);
				});

			const releaseLock = (root: string) => fs.remove(`${manifestPath(root)}.lock`).pipe(Effect.ignore);

			const update = (
				root: string,
				fn: (manifest: ReposManifestFile) => ReposManifestFile | Effect.Effect<ReposManifestFile, ReposConfigError>,
			) =>
				Effect.gen(function* () {
					yield* acquireLock(root);
					return yield* Effect.gen(function* () {
						const manifest: ReposManifestFile = yield* read(root).pipe(
							Effect.catchTag("ReposConfigError", (error) =>
								error.kind === "missing" ? Effect.succeed({ repos: {} } as ReposManifestFile) : Effect.fail(error),
							),
						);
						const result = fn(manifest);
						const next = Effect.isEffect(result) ? yield* result : result;
						yield* write(root, next);
						return next;
					}).pipe(Effect.ensuring(releaseLock(root)));
				});

			return { exists, read, write, update };
		}),
	);
}
