import { Command, CommandExecutor } from "@effect/platform";
import { Context, Effect, Layer, Option, Ref } from "effect";
import { PackageManagerDetector, WorkspaceRoot } from "workspaces-effect";
import { ToolNotFoundError } from "../errors/ToolNotFoundError.js";
import { ToolResolutionError } from "../errors/ToolResolutionError.js";
import { ResolvedTool } from "../schemas/ResolvedTool.js";
import type { ToolDefinition } from "../schemas/ToolDefinition.js";
import type { VersionExtractor } from "../schemas/ToolResults.js";

/**
 * Service that resolves CLI tools — locating them globally (PATH) or locally
 * (via package manager), extracting versions, enforcing source and version
 * constraints, and caching results.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const td = yield* ToolDiscovery;
 *     return yield* td.resolve(
 *       ToolDefinition.make({ name: "biome" })
 *     );
 *   }).pipe(
 *     Effect.provide(ToolDiscoveryLive),
 *     Effect.provide(NodeContext.layer),
 *   )
 * );
 * ```
 *
 * @since 0.2.0
 */
export class ToolDiscovery extends Context.Tag("@savvy-web/silk-effects/ToolDiscovery")<
	ToolDiscovery,
	{
		/**
		 * Resolve a tool definition to a {@link ResolvedTool}, enforcing source
		 * requirements and resolution policies. Results are cached by tool name.
		 *
		 * @since 0.2.0
		 */
		readonly resolve: (definition: ToolDefinition) => Effect.Effect<ResolvedTool, ToolResolutionError>;

		/**
		 * Like {@link resolve} but maps failures to {@link ToolNotFoundError}.
		 * Accepts an optional custom error message.
		 *
		 * @since 0.2.0
		 */
		readonly require: {
			(definition: ToolDefinition): Effect.Effect<ResolvedTool, ToolNotFoundError>;
			(definition: ToolDefinition, message: string): Effect.Effect<ResolvedTool, ToolNotFoundError>;
		};

		/**
		 * Quick availability check — returns `true` if the tool can be found
		 * either globally or locally. Does not cache.
		 *
		 * @since 0.2.0
		 */
		readonly isAvailable: (definition: ToolDefinition) => Effect.Effect<boolean>;

		/**
		 * Clear the internal resolution cache so subsequent calls re-run discovery.
		 *
		 * @since 0.2.0
		 */
		readonly clearCache: Effect.Effect<void>;
	}
>() {}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the PM exec prefix for running a local binary.
 */
function pmExecArgs(pmType: "npm" | "pnpm" | "yarn" | "bun", name: string): [string, ...string[]] {
	switch (pmType) {
		case "pnpm":
			return ["pnpm", "exec", name];
		case "npm":
			return ["npx", "--no", "--", name];
		case "yarn":
			return ["yarn", "exec", name];
		case "bun":
			return ["bun", "x", "--no-install", name];
	}
}

/**
 * Run a command and return its stdout, or `Option.none()` on failure.
 */
function tryString(cmd: Command.Command): Effect.Effect<Option.Option<string>, never, CommandExecutor.CommandExecutor> {
	return Command.string(cmd).pipe(
		Effect.map((s) => Option.some(s.trim())),
		Effect.catchAll(() => Effect.succeed(Option.none<string>())),
	);
}

/**
 * Run a command and return true if it succeeds (exit code 0).
 */
function tryExists(cmd: Command.Command): Effect.Effect<boolean, never, CommandExecutor.CommandExecutor> {
	return Command.exitCode(cmd).pipe(
		Effect.map((code) => code === 0),
		Effect.catchAll(() => Effect.succeed(false)),
	);
}

/**
 * Extract version from command output using a VersionExtractor.
 */
function extractVersion(output: Option.Option<string>, extractor: VersionExtractor): Option.Option<string> {
	if (extractor._tag === "None" || Option.isNone(output)) {
		return Option.none();
	}
	const raw = output.value;
	if (extractor._tag === "Flag") {
		const parsed = extractor.parse ? extractor.parse(raw) : raw.trim();
		return Option.some(parsed);
	}
	// Json
	try {
		const obj = JSON.parse(raw);
		const parts = extractor.path.split(".");
		let current: unknown = obj;
		for (const part of parts) {
			if (current == null || typeof current !== "object") return Option.none();
			current = (current as Record<string, unknown>)[part];
		}
		return typeof current === "string" ? Option.some(current) : Option.none();
	} catch {
		return Option.none();
	}
}

// ---------------------------------------------------------------------------
// Live layer
// ---------------------------------------------------------------------------

/**
 * Live implementation of {@link ToolDiscovery}.
 *
 * @remarks
 * Requires `CommandExecutor` from `@effect/platform`, `PackageManagerDetector`
 * and `WorkspaceRoot` from `workspaces-effect`.
 *
 * @since 0.2.0
 */
export const ToolDiscoveryLive: Layer.Layer<
	ToolDiscovery,
	never,
	CommandExecutor.CommandExecutor | PackageManagerDetector | WorkspaceRoot
> = Layer.effect(
	ToolDiscovery,
	Effect.gen(function* () {
		const executor = yield* CommandExecutor.CommandExecutor;
		const wsRoot = yield* WorkspaceRoot;
		const pmDetector = yield* PackageManagerDetector;
		const cache = yield* Ref.make<Map<string, ResolvedTool>>(new Map());

		const resolve = (definition: ToolDefinition): Effect.Effect<ResolvedTool, ToolResolutionError> =>
			Effect.gen(function* () {
				// 1. Check cache
				const cached = yield* Ref.get(cache);
				const hit = cached.get(definition.name);
				if (hit) return hit;

				// 2. Get workspace root
				const root = yield* wsRoot
					.find(process.cwd())
					.pipe(
						Effect.catchAll(() =>
							Effect.fail(new ToolResolutionError({ name: definition.name, reason: "Could not find workspace root" })),
						),
					);

				// 3. Get package manager
				const pm = yield* pmDetector
					.detect(root)
					.pipe(
						Effect.catchAll(() =>
							Effect.fail(
								new ToolResolutionError({ name: definition.name, reason: "Could not detect package manager" }),
							),
						),
					);
				const pmType = pm.type as "npm" | "pnpm" | "yarn" | "bun";

				// 4. Check global availability
				const globalExists = yield* Effect.provideService(
					tryExists(Command.make("sh", "-c", `command -v ${definition.name}`)),
					CommandExecutor.CommandExecutor,
					executor,
				);

				// 5. Extract global version if found
				let globalVersion = Option.none<string>();
				if (globalExists && definition.versionExtractor._tag !== "None") {
					const flag = definition.versionExtractor.flag;
					const globalOutput = yield* Effect.provideService(
						tryString(Command.make(definition.name, flag)),
						CommandExecutor.CommandExecutor,
						executor,
					);
					globalVersion = extractVersion(globalOutput, definition.versionExtractor);
				}

				// 6. Check local availability + extract version
				let localExists = false;
				let localVersion = Option.none<string>();
				const [pmBin, ...pmArgs] = pmExecArgs(pmType, definition.name);
				if (definition.versionExtractor._tag !== "None") {
					const flag = definition.versionExtractor.flag;
					const localOutput = yield* Effect.provideService(
						tryString(Command.make(pmBin, ...pmArgs, flag)),
						CommandExecutor.CommandExecutor,
						executor,
					);
					if (Option.isSome(localOutput)) {
						localExists = true;
						localVersion = extractVersion(localOutput, definition.versionExtractor);
					}
				} else {
					// No version extractor — just check if the tool exists locally
					localExists = yield* Effect.provideService(
						tryExists(Command.make(pmBin, ...pmArgs, "--version")),
						CommandExecutor.CommandExecutor,
						executor,
					);
				}

				// 8. Enforce SourceRequirement
				if (!globalExists && !localExists) {
					return yield* Effect.fail(
						new ToolResolutionError({
							name: definition.name,
							reason: "Tool not found globally or locally",
						}),
					);
				}

				switch (definition.source._tag) {
					case "OnlyLocal":
						if (!localExists) {
							return yield* Effect.fail(
								new ToolResolutionError({
									name: definition.name,
									reason: "Tool is required locally but was only found globally",
								}),
							);
						}
						break;
					case "OnlyGlobal":
						if (!globalExists) {
							return yield* Effect.fail(
								new ToolResolutionError({
									name: definition.name,
									reason: "Tool is required globally but was only found locally",
								}),
							);
						}
						break;
					case "Both":
						if (!globalExists || !localExists) {
							return yield* Effect.fail(
								new ToolResolutionError({
									name: definition.name,
									reason: "Tool is required both globally and locally but was only found in one location",
								}),
							);
						}
						break;
					case "Any":
						break;
				}

				// 9. Determine mismatch and apply ResolutionPolicy
				let mismatch = false;
				let source: "global" | "local" = localExists ? "local" : "global";
				let version: Option.Option<string> = localExists ? localVersion : globalVersion;

				if (globalExists && localExists && Option.isSome(globalVersion) && Option.isSome(localVersion)) {
					if (globalVersion.value !== localVersion.value) {
						mismatch = true;
						switch (definition.policy._tag) {
							case "Report":
								source = "local";
								version = localVersion;
								break;
							case "PreferLocal":
								source = "local";
								version = localVersion;
								break;
							case "PreferGlobal":
								source = "global";
								version = globalVersion;
								break;
							case "RequireMatch":
								return yield* Effect.fail(
									new ToolResolutionError({
										name: definition.name,
										reason: `Version mismatch: global ${globalVersion.value} vs local ${localVersion.value}`,
									}),
								);
						}
					}
				}

				// 10. Cache and return
				const resolved = new ResolvedTool({
					name: definition.name,
					source,
					version,
					globalVersion,
					localVersion,
					packageManager: pmType,
					mismatch,
				});

				yield* Ref.update(cache, (m) => {
					const next = new Map(m);
					next.set(definition.name, resolved);
					return next;
				});

				return resolved;
			});

		const require_ = (definition: ToolDefinition, message?: string): Effect.Effect<ResolvedTool, ToolNotFoundError> =>
			resolve(definition).pipe(
				Effect.mapError(
					(err) =>
						new ToolNotFoundError({
							name: definition.name,
							reason: message ?? err.reason,
						}),
				),
			);

		const isAvailable = (definition: ToolDefinition): Effect.Effect<boolean> =>
			Effect.gen(function* () {
				// Check global
				const globalFound = yield* Effect.provideService(
					tryExists(Command.make("sh", "-c", `command -v ${definition.name}`)),
					CommandExecutor.CommandExecutor,
					executor,
				);
				if (globalFound) return true;

				// Check local — need workspace root and PM
				const rootResult = yield* wsRoot.find(process.cwd()).pipe(Effect.option);
				if (Option.isNone(rootResult)) return false;

				const pmResult = yield* pmDetector.detect(rootResult.value).pipe(Effect.option);
				if (Option.isNone(pmResult)) return false;

				const pmType = pmResult.value.type as "npm" | "pnpm" | "yarn" | "bun";
				const probeFlag = definition.versionExtractor._tag !== "None" ? definition.versionExtractor.flag : "--version";
				const [pmBin, ...pmArgs] = pmExecArgs(pmType, definition.name);
				return yield* Effect.provideService(
					tryExists(Command.make(pmBin, ...pmArgs, probeFlag)),
					CommandExecutor.CommandExecutor,
					executor,
				);
			});

		const clearCache: Effect.Effect<void> = Ref.set(cache, new Map());

		return {
			resolve,
			require: require_ as ToolDiscovery["Type"]["require"],
			isAvailable,
			clearCache,
		};
	}),
);
