/**
 * Integration regression test for issue #94 (license sidecars).
 *
 * A minified action bundle must not emit `*.LICENSE.txt` sidecar files — they are
 * an npm-publishing nicety and pure noise for a committed action. License notices
 * from bundled code must instead stay inline so attribution is still preserved.
 */
import { cpSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { GitHubAction } from "../../src/index.js";

const sourceFixture = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/license-comments");

describe("issue #94: no license sidecar files", () => {
	let distFiles: string[];
	let bundle: string;

	beforeAll(async () => {
		const work = mkdtempSync(join(tmpdir(), "gha-license-"));
		cpSync(sourceFixture, work, { recursive: true });

		const action = GitHubAction.create({
			cwd: work,
			skipValidation: true,
			config: {
				build: { minify: true },
				persistLocal: { enabled: false },
			},
		});
		const result = await action.build();
		if (!result.success) {
			throw new Error(`build failed: ${result.error ?? "unknown error"}`);
		}

		const distDir = join(work, "dist");
		distFiles = readdirSync(distDir);
		bundle = readFileSync(join(distDir, "main.js"), "utf8");
	}, 240_000);

	it("emits no *.LICENSE.txt sidecar", () => {
		expect(distFiles.filter((f) => f.endsWith(".LICENSE.txt"))).toEqual([]);
	});

	it("keeps the license notice inline in the bundle", () => {
		expect(bundle).toContain("@license MIT | example-licensed-dep");
	});
});
