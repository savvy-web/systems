import { Schema } from "effect";

/**
 * The publish protocol used when pushing a package to a registry.
 *
 * @remarks
 * `"npm"` covers all npm-compatible registries (npmjs.org, GitHub Packages, custom).
 * `"jsr"` targets the JSR registry via its own publish tool.
 *
 * @since 0.1.0
 */
export const PublishProtocol = Schema.Literal("npm", "jsr");
/** @since 0.1.0 */
export type PublishProtocol = typeof PublishProtocol.Type;

/**
 * Authentication strategy used to obtain publish credentials.
 *
 * @remarks
 * `"oidc"` relies on GitHub Actions OIDC provenance tokens (no explicit secret needed).
 * `"token"` reads a long-lived token from an environment variable.
 *
 * @since 0.1.0
 */
export const AuthStrategy = Schema.Literal("oidc", "token");
/** @since 0.1.0 */
export type AuthStrategy = typeof AuthStrategy.Type;

/**
 * Full publish-target configuration expressed as a structured object.
 *
 * @remarks
 * All fields are optional and fall back to sensible defaults when omitted.
 * `protocol` defaults to `"npm"`. `access` defaults to the registry default.
 *
 * @since 0.1.0
 */
export const PublishTargetObject = Schema.Struct({
	protocol: Schema.optionalWith(PublishProtocol, { default: () => "npm" as const }),
	registry: Schema.optional(Schema.String),
	directory: Schema.optional(Schema.String),
	access: Schema.optional(Schema.Literal("public", "restricted")),
	provenance: Schema.optional(Schema.Boolean),
	tag: Schema.optional(Schema.String),
});
/** @since 0.1.0 */
export type PublishTargetObject = typeof PublishTargetObject.Type;

/**
 * Shorthand string identifiers for common publish destinations.
 *
 * @remarks
 * - `"npm"` — the public npm registry, authenticated via OIDC.
 * - `"github"` — GitHub Packages, authenticated via `GITHUB_TOKEN`.
 * - `"jsr"` — the JSR registry, authenticated via OIDC.
 *
 * @since 0.1.0
 */
export const PublishTargetShorthand = Schema.Literal("npm", "github", "jsr");
/** @since 0.1.0 */
export type PublishTargetShorthand = typeof PublishTargetShorthand.Type;

/**
 * Union of all accepted publish-target representations.
 *
 * @remarks
 * Accepts a {@link PublishTargetShorthand} string (`"npm"`, `"github"`, `"jsr"`),
 * an `https://` URL pointing to a custom npm-compatible registry, or a full
 * {@link PublishTargetObject} with explicit field overrides.
 *
 * @since 0.1.0
 */
export const PublishTarget = Schema.Union(
	PublishTargetShorthand,
	Schema.String.pipe(Schema.filter((s) => s.startsWith("https://"))),
	PublishTargetObject,
);
/** @since 0.1.0 */
export type PublishTarget = typeof PublishTarget.Type;

/**
 * Fully resolved publish target with all fields populated and defaults applied.
 *
 * @remarks
 * Produced by {@link TargetResolver.resolve} from any {@link PublishTarget} input.
 * All optional fields from {@link PublishTargetObject} become required here,
 * and `auth` / `tokenEnv` are derived from the registry URL.
 *
 * @since 0.1.0
 */
export const ResolvedTarget = Schema.Struct({
	protocol: PublishProtocol,
	registry: Schema.NullOr(Schema.String),
	directory: Schema.String,
	access: Schema.Literal("public", "restricted"),
	provenance: Schema.Boolean,
	tag: Schema.String,
	auth: AuthStrategy,
	tokenEnv: Schema.NullOr(Schema.String),
});
/** @since 0.1.0 */
export type ResolvedTarget = typeof ResolvedTarget.Type;
