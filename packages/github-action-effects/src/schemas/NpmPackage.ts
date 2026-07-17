import { Schema } from "effect";

/**
 * Schema for npm package metadata.
 *
 * @public
 */
export const NpmPackageInfo = Schema.Struct({
	name: Schema.String,
	version: Schema.String,
	distTags: Schema.Record(Schema.String, Schema.String),
	integrity: Schema.UndefinedOr(Schema.String),
	tarball: Schema.UndefinedOr(Schema.String),
});
/** @public */
export type NpmPackageInfo = typeof NpmPackageInfo.Type;
