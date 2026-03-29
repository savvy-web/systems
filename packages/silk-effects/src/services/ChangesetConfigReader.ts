import { FileSystem } from "@effect/platform";
import { Context, Effect, Layer, Schema } from "effect";
import { ChangesetConfigError } from "../errors/ChangesetConfigError.js";
import { ChangesetConfig, SilkChangesetConfig } from "../schemas/VersioningSchemas.js";

const SILK_CHANGELOG_MARKER = "@savvy-web/changesets";

function isSilkChangelog(changelog: unknown): boolean {
	if (typeof changelog === "string") {
		return changelog.includes(SILK_CHANGELOG_MARKER);
	}
	if (Array.isArray(changelog) && changelog.length > 0) {
		return typeof changelog[0] === "string" && (changelog[0] as string).includes(SILK_CHANGELOG_MARKER);
	}
	return false;
}

/**
 * Service that reads and decodes the `.changeset/config.json` for a given workspace root.
 *
 * @remarks
 * Automatically detects whether the config uses the Silk changelog adapter
 * (`@savvy-web/changesets`) and decodes as {@link SilkChangesetConfig} or the
 * standard {@link ChangesetConfig} accordingly.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const reader = yield* ChangesetConfigReader;
 *     return yield* reader.read(process.cwd());
 *   }).pipe(
 *     Effect.provide(ChangesetConfigReaderLive),
 *     Effect.provide(NodeContext.layer),
 *   )
 * );
 * ```
 *
 * @since 0.1.0
 */
export class ChangesetConfigReader extends Context.Tag("@savvy-web/silk-effects/ChangesetConfigReader")<
	ChangesetConfigReader,
	{
		/**
		 * Read and decode `.changeset/config.json` from the given workspace root.
		 *
		 * @param root - Absolute path to the workspace root containing the `.changeset/` directory.
		 * @returns An `Effect` that succeeds with the decoded config or fails with {@link ChangesetConfigError}.
		 *
		 * @since 0.1.0
		 */
		readonly read: (root: string) => Effect.Effect<ChangesetConfig | SilkChangesetConfig, ChangesetConfigError>;
	}
>() {}

/**
 * Live implementation of {@link ChangesetConfigReader}.
 *
 * @remarks
 * Requires `FileSystem` from `@effect/platform`. Provide `NodeContext.layer` or
 * `BunContext.layer` to satisfy this dependency.
 *
 * @since 0.1.0
 */
export const ChangesetConfigReaderLive: Layer.Layer<ChangesetConfigReader, never, FileSystem.FileSystem> = Layer.effect(
	ChangesetConfigReader,
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		const read = (root: string): Effect.Effect<ChangesetConfig | SilkChangesetConfig, ChangesetConfigError> => {
			const configPath = `${root}/.changeset/config.json`;

			return Effect.gen(function* () {
				const exists = yield* fs.exists(configPath).pipe(
					Effect.mapError(
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
					return yield* Schema.decodeUnknown(SilkChangesetConfig)(parsed).pipe(
						Effect.mapError(
							(cause) =>
								new ChangesetConfigError({
									path: configPath,
									reason: `Schema decode failed: ${String(cause)}`,
								}),
						),
					);
				}

				return yield* Schema.decodeUnknown(ChangesetConfig)(parsed).pipe(
					Effect.mapError(
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
