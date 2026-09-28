import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { VERSION_RE, VersionOrEmptySchema } from "../src/changesets/schemas/dependency-table.js";
import { CommitHashSchema } from "../src/changesets/schemas/git.js";
import { UsernameSchema } from "../src/changesets/schemas/github.js";
import { RepoSchema } from "../src/changesets/schemas/options.js";
import { JsonPathSchema } from "../src/changesets/schemas/version-files.js";
import { RepoName } from "../src/repos/schemas/manifest.js";

/**
 * Since effect rc.118, `Schema.isPattern` exports its regex as JSON Schema
 * `pattern` only when the RegExp carries the `u` flag; without it the
 * constraint is silently dropped and the exported schema accepts any string.
 */
describe("pattern-checked string schemas keep their pattern in JSON Schema", () => {
	it.each([
		["VersionOrEmptySchema", VersionOrEmptySchema, VERSION_RE.source],
		["CommitHashSchema", CommitHashSchema, "^[a-f0-9]{7,}$"],
		["UsernameSchema", UsernameSchema, "^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$"],
		["RepoSchema", RepoSchema, "^[a-zA-Z0-9._-]+\\/[a-zA-Z0-9._-]+$"],
		["JsonPathSchema", JsonPathSchema, "^\\$\\.[^.]"],
		["RepoName", RepoName, "^(?!\\.{1,2}$)[A-Za-z0-9][A-Za-z0-9._-]*$"],
	] as const)("%s", (_name, schema, pattern) => {
		const document = Schema.toJsonSchemaDocument(schema);
		// An identifier-annotated schema is emitted as a $ref into definitions.
		const ref = (document.schema as { readonly $ref?: string }).$ref;
		const resolved = ref === undefined ? document.schema : document.definitions[ref.replace("#/$defs/", "")];
		expect(resolved).toMatchObject({ type: "string", pattern });
	});
});
