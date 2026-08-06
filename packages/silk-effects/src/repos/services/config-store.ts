import { Clock, Context, Effect, FileSystem, Layer, Option, Path, Schedule, Schema } from "effect";
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

			// A `.lock` file left behind by a killed/crashed holder (the process
			// died between `open` and the matching `remove` in `releaseLock`) used
			// to block every future `update` forever: only `releaseLock` ever removed
			// it, and the 2s retry window always ran out first. A lock older than
			// this age is presumed abandoned and reclaimed (removed, then the acquire
			// attempt retried) rather than treated as still-held; a lock younger than
			// this is left alone, mirroring `STALE_LOCK_MAX_AGE_MS`'s reasoning in
			// `manager.ts` for the analogous `index.lock`/`shallow.lock` case.
			const LOCK_MAX_AGE_MS = 60_000;

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

					// Reclaim a stale lock BEFORE each open attempt (including the
					// first): a lock whose mtime already exceeds `LOCK_MAX_AGE_MS` is
					// removed here so the subsequent `open` succeeds immediately rather
					// than waiting out the full retry window. A lock that is present but
					// still young (a genuinely active holder) is left alone; the `open`
					// below then fails `AlreadyExists` and the retry schedule below runs
					// its normal backoff.
					const attempt = Effect.gen(function* () {
						const info = yield* fs.stat(lockPath).pipe(Effect.option);
						if (Option.isSome(info) && Option.isSome(info.value.mtime)) {
							const now = yield* Clock.currentTimeMillis;
							const age = now - info.value.mtime.value.getTime();
							if (age >= LOCK_MAX_AGE_MS) {
								yield* fs.remove(lockPath).pipe(Effect.ignore);
							}
						}
						yield* Effect.scoped(fs.open(lockPath, { flag: "wx" })).pipe(Effect.asVoid);
					});

					yield* attempt.pipe(
						Effect.retry({
							schedule: lockSchedule,
							while: (error) => error.reason._tag === "AlreadyExists",
						}),
						Effect.mapError(
							(cause) =>
								new ReposConfigError({
									path: lockPath,
									// Name the path AND the remedy explicitly -- the previous
									// message ("timed out acquiring lock: ...") named neither,
									// leaving the user to guess that the fix for a lock this old
									// (a lock younger than LOCK_MAX_AGE_MS is already reclaimed
									// above, so reaching this message at all means either a
									// genuinely active holder or a lock not yet old enough to
									// reclaim) is to remove the file by hand.
									reason: `timed out acquiring lock after 2s at ${lockPath}: ${String(cause)}. If no other savvy process is running, a previous run likely crashed while holding it -- remove ${lockPath} and retry.`,
									kind: "invalid",
								}),
						),
					);
				});

			const releaseLock = (root: string) => fs.remove(`${manifestPath(root)}.lock`).pipe(Effect.ignore);

			// Acquire/release is a single scoped resource: the finalizer
			// (`releaseLock`) is bound via `Effect.acquireRelease` and run by
			// `Effect.scoped` when the surrounding scope closes, so it cannot be
			// skipped by any future refactor of the body -- unlike the previous
			// `Effect.ensuring` shape, which relied on the body always being wrapped
			// correctly by hand.
			const update = (
				root: string,
				fn: (manifest: ReposManifestFile) => ReposManifestFile | Effect.Effect<ReposManifestFile, ReposConfigError>,
			) =>
				Effect.scoped(
					Effect.gen(function* () {
						yield* Effect.acquireRelease(acquireLock(root), () => releaseLock(root));
						const manifest: ReposManifestFile = yield* read(root).pipe(
							Effect.catchTag("ReposConfigError", (error) =>
								error.kind === "missing" ? Effect.succeed({ repos: {} } as ReposManifestFile) : Effect.fail(error),
							),
						);
						const result = fn(manifest);
						const next = Effect.isEffect(result) ? yield* result : result;
						yield* write(root, next);
						return next;
					}),
				);

			return { exists, read, write, update };
		}),
	);
}
