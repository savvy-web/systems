/**
 * Git-related Effect schemas for commit hashes and version bump types.
 *
 * @see {@link https://effect.website/docs/schema/introduction | Effect Schema documentation}
 *
 * @packageDocumentation
 */

import { Schema } from "effect";

/**
 * Schema for a git commit hash (at least 7 lowercase hex characters).
 *
 * @remarks
 * Accepts both abbreviated (7-character) and full (40-character) SHA-1 hashes.
 * Only lowercase hexadecimal characters are allowed; uppercase letters will
 * fail validation. This matches the output of `git rev-parse --short` and
 * `git log --format=%h`.
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { CommitHashSchema } from "@savvy-web/changesets";
 *
 * // Succeeds — abbreviated hash
 * const short = Schema.decodeUnknownSync(CommitHashSchema)("a1b2c3d");
 *
 * // Succeeds — full 40-character SHA
 * const full = Schema.decodeUnknownSync(CommitHashSchema)(
 * 	"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
 * );
 *
 * // Throws ParseError — too short
 * Schema.decodeUnknownSync(CommitHashSchema)("a1b2c3");
 *
 * // Throws ParseError — uppercase not allowed
 * Schema.decodeUnknownSync(CommitHashSchema)("A1B2C3D");
 * ```
 *
 * @see {@link ChangesetSchema} which uses this for the optional `commit` field
 *
 * @public
 */
export const CommitHashSchema = Schema.String.pipe(
	Schema.pattern(/^[a-f0-9]{7,}$/, {
		message: () =>
			'Commit hash must be 7 or more lowercase hexadecimal characters (0-9, a-f). Example: "a1b2c3d" or a full 40-character SHA like "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2". Uppercase letters are not allowed',
	}),
);

/**
 * Semantic version bump type.
 *
 * @remarks
 * Represents the four possible version bump levels used by Changesets:
 * - `"major"` -- breaking changes (e.g., 1.x.x to 2.0.0)
 * - `"minor"` -- new features (e.g., 1.1.x to 1.2.0)
 * - `"patch"` -- bug fixes (e.g., 1.1.1 to 1.1.2)
 * - `"none"` -- no version bump (internal changes only)
 *
 * @example
 * ```typescript
 * import { Schema } from "effect";
 * import { VersionTypeSchema } from "@savvy-web/changesets";
 * import type { VersionType } from "@savvy-web/changesets";
 *
 * const bump: VersionType = Schema.decodeUnknownSync(VersionTypeSchema)("minor");
 * ```
 *
 * @public
 */
export const VersionTypeSchema = Schema.Literal("major", "minor", "patch", "none");

/**
 * Inferred type for {@link VersionTypeSchema}.
 *
 * @remarks
 * One of `"major"`, `"minor"`, `"patch"`, or `"none"`.
 *
 * @public
 */
export type VersionType = typeof VersionTypeSchema.Type;
