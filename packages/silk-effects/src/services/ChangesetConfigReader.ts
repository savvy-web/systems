import { Context, Effect, FileSystem, Layer, Schema } from "effect";
import { ChangesetConfigError } from "../errors/ChangesetConfigError.js";
import { ChangesetConfigFile, SilkChangesetConfigFile } from "../schemas/VersioningSchemas.js";

/**
 * Substrings that identify a Silk changelog adapter entry in `.changeset/config.json`.
 *
 * `@savvy-web/changelog` is the canonical standalone changelog id that `savvy init`
 * now writes. The two legacy forms — the original standalone package
 * (`@savvy-web/changesets/changelog`) and the consolidated Silk re-export
 * (`@savvy-web/silk/changesets/changelog`) — remain accepted for configs written
 * before the rename. The `/silk/` segment in the consolidated path breaks the
 * `@savvy-web/changesets` substring, so each form needs its own marker.
 */
const SILK_CHANGELOG_MARKERS = ["@savvy-web/changelog", "@savvy-web/changesets", "@savvy-web/silk/changesets"] as const;

function matchesSilkMarker(value: string): boolean {
	return SILK_CHANGELOG_MARKERS.some((marker) => value.includes(marker));
}

function isSilkChangelog(changelog: unknown): boolean {
	if (typeof changelog === "string") {
		return matchesSilkMarker(changelog);
	}
	if (Array.isArray(changelog) && changelog.length > 0) {
		return typeof changelog[0] === "string" && matchesSilkMarker(changelog[0] as string);
	}
	return false;
}

/**
 * The {@link ChangesetConfigReader} service shape.
 *
 * @since 3.2.0
 * @public
 */
export interface ChangesetConfigReaderShape {
	/**
	 * Read and decode `.changeset/config.json` from the given workspace root.
	 *
	 * @param root - Absolute path to the workspace root containing the `.changeset/` directory.
	 * @returns An `Effect` that succeeds with the decoded config or fails with {@link ChangesetConfigError}.
	 *
	 * @since 0.1.0
	 */
	readonly read: (root: string) => Effect.Effect<ChangesetConfigFile | SilkChangesetConfigFile, ChangesetConfigError>;
}

/**
 * Service that reads and decodes the `.changeset/config.json` for a given workspace root.
 *
 * @remarks
 * Automatically detects whether the config uses the Silk changelog adapter
 * (`@savvy-web/changesets`) and decodes as {@link (SilkChangesetConfigFile:type)} or the
 * standard {@link (ChangesetConfigFile:type)} accordingly.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const reader = yield* ChangesetConfigReader;
 *     return yield* reader.read(process.cwd());
 *   }).pipe(
 *     Effect.provide(ChangesetConfigReaderLive),
 *     Effect.provide(NodeServices.layer),
 *   )
 * );
 * ```
 *
 * @since 0.1.0
 * @public
 */
export class ChangesetConfigReader extends Context.Service<ChangesetConfigReader, ChangesetConfigReaderShape>()(
	"@savvy-web/silk-effects/ChangesetConfigReader",
) {}

/**
 * Live implementation of {@link ChangesetConfigReader}.
 *
 * @remarks
 * Requires the core `FileSystem` service. Provide `NodeServices.layer` (or
 * `NodeFileSystem.layer`) from `@effect/platform-node` to satisfy this dependency.
 *
 * @since 0.1.0
 * @public
 */
export const ChangesetConfigReaderLive: Layer.Layer<ChangesetConfigReader, never, FileSystem.FileSystem> = Layer.effect(
	ChangesetConfigReader,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		const read = (root: string): Effect.Effect<ChangesetConfigFile | SilkChangesetConfigFile, ChangesetConfigError> => {
			const configPath = `${root}/.changeset/config.json`;

			return Effect.gen(function* () {
				const exists = yield* fs.exists(configPath).pipe(
					Effect.mapError(
						/* v8 ignore next 4 -- error path requires fs.exists to fail */
						(cause) =>
							new ChangesetConfigError({
								path: configPath,
								reason: String(cause),
							}),
					),
				);

				if (!exists) {
					return yield* Effect.fail(
						new ChangesetConfigError({
							path: configPath,
							reason: "File not found",
						}),
					);
				}

				const raw = yield* fs.readFileString(configPath).pipe(
					Effect.mapError(
						/* v8 ignore next 4 -- error path requires fs.readFileString to fail */
						(cause) =>
							new ChangesetConfigError({
								path: configPath,
								reason: String(cause),
							}),
					),
				);

				const parsed: unknown = yield* Effect.try({
					try: () => JSON.parse(raw) as unknown,
					catch: (cause) =>
						new ChangesetConfigError({
							path: configPath,
							reason: `Invalid JSON: ${String(cause)}`,
						}),
				});

				const rawConfig = parsed as { changelog?: unknown };

				if (isSilkChangelog(rawConfig.changelog)) {
					return yield* Schema.decodeUnknownEffect(SilkChangesetConfigFile)(parsed).pipe(
						Effect.mapError(
							/* v8 ignore next 4 -- error path requires schema decode failure */
							(cause) =>
								new ChangesetConfigError({
									path: configPath,
									reason: `Schema decode failed: ${String(cause)}`,
								}),
						),
					);
				}

				return yield* Schema.decodeUnknownEffect(ChangesetConfigFile)(parsed).pipe(
					Effect.mapError(
						/* v8 ignore next 4 -- error path requires schema decode failure */
						(cause) =>
							new ChangesetConfigError({
								path: configPath,
								reason: `Schema decode failed: ${String(cause)}`,
							}),
					),
				);
			});
		};

		return { read };
	}),
);
