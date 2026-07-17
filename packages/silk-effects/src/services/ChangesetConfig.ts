import { Context, Effect, Layer, Option } from "effect";
import type { ChangesetConfigFile, SilkChangesetConfigFile } from "../schemas/VersioningSchemas.js";
import { ChangesetConfigReader } from "./ChangesetConfigReader.js";

/**
 * Changeset operating mode for a workspace root.
 * @public
 */
export type ChangesetMode = "silk" | "vanilla" | "none";

/**
 * The {@link ChangesetConfig} service shape.
 *
 * @since 3.2.0
 * @public
 */
export interface ChangesetConfigShape {
	readonly mode: (root: string) => Effect.Effect<ChangesetMode>;
	readonly versionPrivate: (root: string) => Effect.Effect<boolean>;
	readonly ignorePatterns: (root: string) => Effect.Effect<ReadonlyArray<string>>;
	readonly isIgnored: (name: string, root: string) => Effect.Effect<boolean>;
	readonly fixed: (root: string) => Effect.Effect<ReadonlyArray<ReadonlyArray<string>>>;
	/**
	 * Drop the cached read for every previously-read root. Callers that hold
	 * this service across multiple logical operations in a single process
	 * (e.g. a long-lived MCP server) must call this before an operation that
	 * needs to observe an on-disk edit made since the last accessor call —
	 * the cache never expires on its own.
	 */
	readonly refresh: () => Effect.Effect<void>;
}

/**
 * Accessor service over a workspace root's `.changeset/config.json`.
 *
 * @remarks
 * Reads through {@link ChangesetConfigReader} (FileSystem-based) with a per-root cache.
 * Every accessor is total (error channel `never`): a missing or unreadable config collapses
 * to `mode: "none"` and empty/false defaults.
 *
 * @since 0.4.0
 * @public
 */
export class ChangesetConfig extends Context.Service<ChangesetConfig, ChangesetConfigShape>()(
	"@savvy-web/silk-effects/ChangesetConfig",
) {
	/**
	 * The one ignore matcher: exact name match, or `@scope/*` wildcard.
	 *
	 * `"@scope/*"` matches `"@scope/anything"` (prefix kept includes the trailing slash),
	 * but not the bare scope `"@scope"`.
	 */
	static matches(name: string, pattern: string): boolean {
		if (pattern.endsWith("/*")) {
			const prefix = pattern.slice(0, -1);
			return name.startsWith(prefix);
		}
		return name === pattern;
	}
}

const isSilk = (cfg: ChangesetConfigFile | SilkChangesetConfigFile): boolean =>
	"_isSilk" in cfg && (cfg as SilkChangesetConfigFile)._isSilk === true;

/**
 * Live {@link ChangesetConfig} reading via {@link ChangesetConfigReader}, cached per root.
 *
 * @remarks
 * Requires `ChangesetConfigReader` (which requires `FileSystem`). Provide
 * `ChangesetConfigReaderLive` + a platform layer (`NodeServices.layer`).
 *
 * @since 0.4.0
 * @public
 */
export const ChangesetConfigLive: Layer.Layer<ChangesetConfig, never, ChangesetConfigReader> = Layer.effect(
	ChangesetConfig,
	Effect.gen(function* () {
		const reader = yield* ChangesetConfigReader;
		const cache = new Map<string, Option.Option<ChangesetConfigFile | SilkChangesetConfigFile>>();

		const read = (root: string): Effect.Effect<Option.Option<ChangesetConfigFile | SilkChangesetConfigFile>> =>
			Effect.gen(function* () {
				const hit = cache.get(root);
				if (hit !== undefined) return hit;
				// Reader fails (missing file / malformed JSON / decode error) → treat as absent.
				const result = yield* reader.read(root).pipe(Effect.option);
				cache.set(root, result);
				return result;
			});

		return {
			mode: (root) =>
				read(root).pipe(
					Effect.map(
						Option.match({
							onNone: () => "none" as const,
							onSome: (cfg) => (isSilk(cfg) ? ("silk" as const) : ("vanilla" as const)),
						}),
					),
				),
			versionPrivate: (root) =>
				read(root).pipe(
					Effect.map(
						Option.match({
							onNone: () => false,
							onSome: (cfg) => {
								const pp = cfg.privatePackages;
								return pp !== undefined && pp !== false && pp.version === true;
							},
						}),
					),
				),
			ignorePatterns: (root) =>
				read(root).pipe(Effect.map(Option.match({ onNone: () => [], onSome: (cfg) => cfg.ignore ?? [] }))),
			isIgnored: (name, root) =>
				read(root).pipe(
					Effect.map(
						Option.match({
							onNone: () => false,
							onSome: (cfg) => (cfg.ignore ?? []).some((p) => ChangesetConfig.matches(name, p)),
						}),
					),
				),
			fixed: (root) =>
				read(root).pipe(Effect.map(Option.match({ onNone: () => [], onSome: (cfg) => cfg.fixed ?? [] }))),
			refresh: () => Effect.sync(() => cache.clear()),
		};
	}),
);
