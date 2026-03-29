import { Context, Effect, Layer } from "effect";
import { TargetResolutionError } from "../errors/TargetResolutionError.js";
import type { ResolvedTarget } from "../schemas/PublishabilitySchemas.js";

/**
 * Service that resolves raw publish-target values into fully-normalised {@link ResolvedTarget} records.
 *
 * @remarks
 * Accepts a single target or an array of targets. Each item may be a
 * {@link PublishTargetShorthand} string, an `https://` registry URL, or a
 * {@link PublishTargetObject}. Unknown values produce a {@link TargetResolutionError}.
 *
 * @example
 * ```typescript
 * const result = await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const resolver = yield* TargetResolver;
 *     return yield* resolver.resolve("npm");
 *   }).pipe(Effect.provide(TargetResolverLive))
 * );
 * ```
 *
 * @since 0.1.0
 */
export class TargetResolver extends Context.Tag("@savvy-web/silk-effects/TargetResolver")<
	TargetResolver,
	{
		/**
		 * Resolve one target (or an array of targets) into an array of {@link ResolvedTarget} records.
		 *
		 * @param target - A single publish-target value or an array of them.
		 * @returns An `Effect` that succeeds with the resolved targets or fails with {@link TargetResolutionError}.
		 *
		 * @since 0.1.0
		 */
		readonly resolve: (target: unknown) => Effect.Effect<ReadonlyArray<ResolvedTarget>, TargetResolutionError>;
	}
>() {}

const DEFAULTS = {
	directory: "dist/npm",
	access: "public" as const,
	provenance: false,
	tag: "latest",
};

function deriveTokenEnv(registryUrl: string): string {
	try {
		const hostname = new URL(registryUrl).hostname;
		return `NPM_TOKEN_${hostname.replace(/\./g, "_").toUpperCase()}`;
	} catch {
		return "NPM_TOKEN";
	}
}

function resolveOne(target: unknown): Effect.Effect<ResolvedTarget, TargetResolutionError> {
	// Shorthand: "npm"
	if (target === "npm") {
		return Effect.succeed({
			...DEFAULTS,
			protocol: "npm" as const,
			registry: "https://registry.npmjs.org/",
			auth: "oidc" as const,
			tokenEnv: null,
		});
	}

	// Shorthand: "github"
	if (target === "github") {
		return Effect.succeed({
			...DEFAULTS,
			protocol: "npm" as const,
			registry: "https://npm.pkg.github.com/",
			auth: "token" as const,
			tokenEnv: "GITHUB_TOKEN",
		});
	}

	// Shorthand: "jsr"
	if (target === "jsr") {
		return Effect.succeed({
			...DEFAULTS,
			protocol: "jsr" as const,
			registry: null,
			auth: "oidc" as const,
			tokenEnv: null,
		});
	}

	// Custom URL string
	if (typeof target === "string" && target.startsWith("https://")) {
		return Effect.succeed({
			...DEFAULTS,
			protocol: "npm" as const,
			registry: target,
			auth: "token" as const,
			tokenEnv: deriveTokenEnv(target),
		});
	}

	// Object target
	if (typeof target === "object" && target !== null && !Array.isArray(target)) {
		const obj = target as Record<string, unknown>;
		const protocol = (obj.protocol as "npm" | "jsr" | undefined) ?? "npm";
		const registry = (obj.registry as string | undefined) ?? null;
		const directory = (obj.directory as string | undefined) ?? DEFAULTS.directory;
		const access = (obj.access as "public" | "restricted" | undefined) ?? DEFAULTS.access;
		const provenance = (obj.provenance as boolean | undefined) ?? DEFAULTS.provenance;
		const tag = (obj.tag as string | undefined) ?? DEFAULTS.tag;

		let auth: "oidc" | "token";
		let tokenEnv: string | null;

		if (registry !== null) {
			try {
				const hostname = new URL(registry).hostname;
				if (hostname === "npm.pkg.github.com") {
					auth = "token";
					tokenEnv = "GITHUB_TOKEN";
				} else {
					auth = "oidc";
					tokenEnv = null;
				}
			} catch {
				auth = "oidc";
				tokenEnv = null;
			}
		} else {
			auth = "oidc";
			tokenEnv = null;
		}

		return Effect.succeed({
			protocol,
			registry,
			directory,
			access,
			provenance,
			tag,
			auth,
			tokenEnv,
		});
	}

	return Effect.fail(
		new TargetResolutionError({
			target,
			reason: `Unsupported target type: ${typeof target}. Expected "npm", "github", "jsr", an https:// URL, or an object.`,
		}),
	);
}

/**
 * Live implementation of {@link TargetResolver} with no external dependencies.
 *
 * @remarks
 * All resolution logic is pure: shorthand strings, `https://` URLs, and object targets
 * are mapped to {@link ResolvedTarget} records without any I/O.
 *
 * @since 0.1.0
 */
export const TargetResolverLive = Layer.succeed(TargetResolver, {
	resolve: (target: unknown) => {
		if (Array.isArray(target)) {
			return Effect.all(target.map(resolveOne));
		}
		return resolveOne(target).pipe(Effect.map((resolved) => [resolved]));
	},
});
