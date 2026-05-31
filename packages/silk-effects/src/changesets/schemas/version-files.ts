/**
 * Schemas for `versionFiles` configuration entries.
 *
 * @remarks
 * `versionFiles` lets \@savvy-web/changesets update version fields in
 * arbitrary JSON files (beyond `package.json`) during the
 * `changeset version` command. Each entry specifies a glob pattern to
 * match files and optional JSONPath expressions to locate version fields
 * within those files.
 *
 * Two related schemas live here:
 *
 * - {@link VersionFileConfigSchema} — the **new** per-package entry shape
 *   used inside `packages[*].versionFiles`. It has no `package` field
 *   because the parent record key already names the owning package.
 * - {@link LegacyVersionFileConfigSchema} — the **deprecated** entry shape
 *   used by the top-level `versionFiles[]` array on the changelog options.
 *   It carries an optional `package` field so the owner can be named
 *   inline. Accepted in 0.9.0 with a deprecation warning; removed in
 *   1.0.0.
 *
 * @see {@link ChangesetOptionsSchema} for the consuming options shape
 * @see {@link PackageScopeSchema} for the new per-package container
 * @see {@link https://effect.website/docs/schema/introduction | Effect Schema documentation}
 *
 * @packageDocumentation
 */

import { Schema } from "effect";

/**
 * Schema for a JSONPath expression starting with `$.`.
 *
 * @remarks
 * Supports property access (`$.foo.bar`), array wildcard (`$.foo[*].bar`),
 * and array index access (`$.foo[0].bar`). The expression must begin with
 * `$.` followed by at least one property segment.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { JsonPathSchema } from "@savvy-web/changesets";
 *
 * // Succeeds — simple property access
 * Schema.decodeUnknownSync(JsonPathSchema)("$.version");
 *
 * // Succeeds — nested property access
 * Schema.decodeUnknownSync(JsonPathSchema)("$.metadata.version");
 *
 * // Throws ParseError — missing "$." prefix
 * Schema.decodeUnknownSync(JsonPathSchema)("version");
 * ```
 *
 * @see {@link VersionFileConfigSchema} which uses this for the `paths` field
 *
 * @public
 */
export const JsonPathSchema = Schema.String.pipe(
	Schema.pattern(/^\$\.[^.]/, {
		message: () => 'JSONPath must start with "$." followed by a property (e.g., "$.version", "$.metadata.version")',
	}),
);

/**
 * Schema for a single version file configuration entry — **new shape**.
 *
 * @remarks
 * Used inside `packages[*].versionFiles` (i.e., underneath a parent
 * record key that names the owning package). Has no `package` field
 * because the parent key already supplies that information.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { VersionFileConfigSchema } from "@savvy-web/changesets";
 *
 * const entry = Schema.decodeUnknownSync(VersionFileConfigSchema)({
 *   glob: "plugin/.claude-plugin/plugin.json",
 *   paths: ["$.version"],
 * });
 * ```
 *
 * @see {@link VersionFileConfig} for the inferred TypeScript type
 * @see {@link LegacyVersionFileConfigSchema} for the deprecated shape
 *   used by the top-level `versionFiles[]` array
 * @see {@link JsonPathSchema} for JSONPath validation rules
 *
 * @public
 */
export const VersionFileConfigSchema = Schema.Struct({
	/** Glob pattern to match JSON files. */
	glob: Schema.String.pipe(Schema.minLength(1)),
	/** JSONPath expressions to locate version fields. Defaults to `["$.version"]`. */
	paths: Schema.optional(Schema.Array(JsonPathSchema)),
});

/**
 * Inferred type for {@link VersionFileConfigSchema} (new shape).
 *
 * @public
 */
export interface VersionFileConfig extends Schema.Schema.Type<typeof VersionFileConfigSchema> {}

/**
 * Schema for an array of new-shape {@link VersionFileConfigSchema} entries.
 *
 * @public
 */
export const VersionFilesSchema = Schema.Array(VersionFileConfigSchema);

/**
 * Schema for a single version file configuration entry — **legacy shape**.
 *
 * @remarks
 * DEPRECATED. Used only for parsing the top-level `versionFiles[]` array on
 * the changelog options block. Carries an optional `package` field so the
 * owning package can be named inline (alternatively, the runtime falls back
 * to longest-prefix path matching against workspace package directories).
 *
 * Accepted in 0.9.0 with a deprecation warning emitted by `ConfigInspector`
 * at config-load time. Removed in 1.0.0 — migrate to the new
 * {@link VersionFileConfigSchema} under
 * `changelog[1].packages[<name>].versionFiles`.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { LegacyVersionFileConfigSchema } from "@savvy-web/changesets";
 *
 * // Owner named inline via the `package` field
 * const entry = Schema.decodeUnknownSync(LegacyVersionFileConfigSchema)({
 *   glob: "plugin/.claude-plugin/plugin.json",
 *   paths: ["$.version"],
 *   package: "@savvy-web/changesets",
 * });
 * ```
 *
 * @see {@link VersionFileConfigSchema} for the replacement (new) shape
 * @see {@link LegacyVersionFileConfig} for the inferred TypeScript type
 *
 * @deprecated 0.9.0 — migrate to {@link VersionFileConfigSchema} inside
 *   `packages[*].versionFiles`. Removed in 1.0.0.
 * @public
 */
export const LegacyVersionFileConfigSchema = Schema.Struct({
	/** Glob pattern to match JSON files. */
	glob: Schema.String.pipe(Schema.minLength(1)),
	/** JSONPath expressions to locate version fields. Defaults to `["$.version"]`. */
	paths: Schema.optional(Schema.Array(JsonPathSchema)),
	/** Workspace package name to source the version from, bypassing path-based resolution. */
	package: Schema.optional(Schema.String.pipe(Schema.minLength(1))),
});

/**
 * Inferred type for {@link LegacyVersionFileConfigSchema} (deprecated shape).
 *
 * @deprecated 0.9.0 — migrate to {@link VersionFileConfig}. Removed in 1.0.0.
 * @public
 */
export interface LegacyVersionFileConfig extends Schema.Schema.Type<typeof LegacyVersionFileConfigSchema> {}

/**
 * Schema for an array of legacy {@link LegacyVersionFileConfigSchema}
 * entries — used by the deprecated top-level `versionFiles[]` array on
 * `ChangesetOptionsSchema`.
 *
 * @deprecated 0.9.0 — migrate to {@link VersionFilesSchema} inside
 *   `packages[*].versionFiles`. Removed in 1.0.0.
 * @public
 */
export const LegacyVersionFilesSchema = Schema.Array(LegacyVersionFileConfigSchema);
