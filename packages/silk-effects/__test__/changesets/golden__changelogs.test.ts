import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ChangelogTransformer } from "../../src/changesets/api/transformer.js";

const PACKAGES = join(import.meta.dirname, "../../../");
const GOLDEN = join(import.meta.dirname, "__golden__");

describe("golden: transformer over real changelogs", () => {
	for (const file of readdirSync(GOLDEN)) {
		const dir = file.replace(/\.md$/, "");
		it(`${dir}/CHANGELOG.md transforms byte-identically`, () => {
			const input = readFileSync(join(PACKAGES, dir, "CHANGELOG.md"), "utf-8");
			const expected = readFileSync(join(GOLDEN, file), "utf-8");
			expect(ChangelogTransformer.transformContent(input)).toBe(expected);
		});
	}
});
