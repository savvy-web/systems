import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ChangelogTransformer } from "../../src/changesets/api/transformer.js";

const PACKAGES = join(import.meta.dirname, "../../../");
const GOLDEN = join(import.meta.dirname, "__golden__");

describe("golden: transformer over real changelogs", () => {
	// Fixtures are .txt because lint-staged runs markdownlint-cli2 --fix on staged .md files,
	// which would rewrite the goldens (table cells, bullet markers) and break byte-identity.
	for (const file of readdirSync(GOLDEN)) {
		const dir = file.replace(/\.txt$/, "");
		it(`${dir}/CHANGELOG.md transforms byte-identically`, () => {
			const input = readFileSync(join(PACKAGES, dir, "CHANGELOG.md"), "utf-8");
			const expected = readFileSync(join(GOLDEN, file), "utf-8");
			expect(ChangelogTransformer.transformContent(input)).toBe(expected);
		});
	}
});
