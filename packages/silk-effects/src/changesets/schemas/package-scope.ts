/**
 * Schemas for the per-package release-surface configuration introduced in
 * \@savvy-web/changesets 0.9.0.
 *
 * @remarks
 * A `PackageScope` is the value side of the `packages` record on the
 * \@savvy-web/changesets changelog options. It tells the formatter which
 * non-workspace paths belong to a package's release surface (via
 * `additionalScopes`) and which files have their version fields bumped in
 * lockstep with the package (via `versionFiles`).
 *
 * ```jsonc
 * "changelog": [
 *   "@savvy-web/changesets/changelog",
 *   {
 *     "repo": "savvy-web/changesets",
 *     "packages": {
 *       "@savvy-web/changesets": {
 *         "additionalScopes": ["plugin/**"],
 *         "versionFiles": [
 *           { "glob": "plugin/.claude-plugin/plugin.json",
 *             "paths": ["$.version"] }
 *         ]
 *       }
 *     }
 *   }
 * ]
 * ```
 *
 * Validation contracts that span multiple packages (no-overlap rules for
 * `additionalScopes`, no glob+path conflicts in `versionFiles`, unknown
 * package keys) are enforced by `ConfigInspector` at load time, not at the
 * schema level — schemas only validate per-entry shape.
 *
 * @see {@link ChangesetOptionsSchema} for the consuming options shape
 * @see {@link VersionFileConfigSchema} for the version-file entry shape
 * @see {@link https://effect.website/docs/schema/introduction | Effect Schema documentation}
 *
 * @packageDocumentation
 */

import { Schema } from "effect";

import { VersionFileConfigSchema } from "./version-files.js";

/**
 * Schema for a single repo-relative glob pattern.
 *
 * @remarks
 * Globs in `additionalScopes` must be repo-relative — absolute paths and
 * parent traversal (`../`) are rejected outright because they cannot be
 * meaningfully resolved against the project workspace. Negation patterns
 * (`!path/**`) are accepted; minimatch handles them at match time.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { GlobSchema } from "@savvy-web/changesets";
 *
 * Schema.decodeUnknownSync(GlobSchema)("plugin/**");          // ok
 * Schema.decodeUnknownSync(GlobSchema)("!plugin/cache/**");   // ok (negation)
 * Schema.decodeUnknownSync(GlobSchema)("/absolute/path");     // throws
 * Schema.decodeUnknownSync(GlobSchema)("../sibling/**");      // throws
 * ```
 *
 * @public
 */
export const GlobSchema = Schema.String.pipe(
	Schema.minLength(1),
	Schema.filter((s) => !s.startsWith("/") && !s.startsWith("../") && !s.includes("/../"), {
		message: () => "Glob must be repo-relative — absolute paths and parent traversal (../) are not allowed",
	}),
);

/**
 * Schema for a single entry in the `packages` record — the per-package
 * release-surface declaration.
 *
 * @remarks
 * Both fields are optional. An empty object (`{}`) is a valid PackageScope
 * and means "this package uses only its workspace directory as its release
 * surface."
 *
 * - `additionalScopes` — repo-relative globs naming files outside the
 *   package's workspace directory that belong to the package's release
 *   surface. The contract is "a path belongs to exactly one package" — if
 *   two packages declare overlapping additionalScopes, the config is
 *   rejected by `ConfigInspector`.
 * - `versionFiles` — files whose JSON fields are bumped in lockstep with
 *   this package's version. Each entry uses the new {@link VersionFileConfigSchema}
 *   shape (no `package` field; the parent record key names the owner).
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { PackageScopeSchema } from "@savvy-web/changesets";
 *
 * const scope = Schema.decodeUnknownSync(PackageScopeSchema)({
 *   additionalScopes: ["plugin/**", "!plugin/.cache/**"],
 *   versionFiles: [
 *     { glob: "plugin/.claude-plugin/plugin.json", paths: ["$.version"] },
 *   ],
 * });
 * ```
 *
 * @see {@link PackageScope} for the inferred TypeScript type
 * @see {@link GlobSchema} for individual glob validation rules
 * @see {@link VersionFileConfigSchema} for the version-file entry shape
 *
 * @public
 */
export const PackageScopeSchema = Schema.Struct({
	/** Repo-relative globs naming files outside the package's workspace directory that belong to its release surface. */
	additionalScopes: Schema.optional(Schema.Array(GlobSchema)),
	/** Files whose JSON fields are bumped in lockstep with this package's version. */
	versionFiles: Schema.optional(Schema.Array(VersionFileConfigSchema)),
});

/**
 * Inferred type for {@link PackageScopeSchema}.
 *
 * @public
 */
export interface PackageScope extends Schema.Schema.Type<typeof PackageScopeSchema> {}

/**
 * Schema for the `packages` record on the changelog options.
 *
 * @remarks
 * Keys are package names. The schema itself does not validate that keys
 * resolve to known workspace packages — that check is performed by
 * `ConfigInspector` at config-load time, where `WorkspaceDiscovery` is
 * available to enumerate the workspace.
 *
 * @public
 */
export const PackagesRecordSchema = Schema.Record({ key: Schema.String, value: PackageScopeSchema });
