/**
 * Integration regression test for issue #94.
 *
 * Building the same source with the same config twice must produce byte-identical
 * output. The compiled action is committed to git, so a changing identifier in the
 * bundle creates pure diff noise. The build must also not emit `*.LICENSE.txt`
 * sidecar files, which are npm-publishing niceties that are noise for committed
 * action code.
 *
 * `build.ignore` is the trigger: the builder aliases ignored modules to a stub
 * file whose path rspack embeds as the module id. A per-build `mkdtemp` directory
 * made that path — and therefore the bundle — change on every run.
 */
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { GitHubAction } from "../../src/index.js";

const sourceFixture = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/ignore-modules");

function buildOnce(cwd: string) {
	const action = GitHubAction.create({
		cwd,
		skipValidation: true,
		config: {
			// minify is off so a diff is readable; the embedded stub path is
			// non-deterministic regardless of minification.
			build: { minify: false, ignore: ["excluded-native-dep"] },
			persistLocal: { enabled: false },
		},
	});
	return action.build();
}

function firstDiffingLines(a: string, b: string, max = 6): string {
	const la = a.split("\n");
	const lb = b.split("\n");
	const out: string[] = [];
	for (let i = 0; i < Math.max(la.length, lb.length) && out.length < max; i++) {
		if (la[i] !== lb[i]) {
			out.push(`L${i + 1}:\n  - ${la[i] ?? "<eof>"}\n  + ${lb[i] ?? "<eof>"}`);
		}
	}
	return out.join("\n");
}

describe("issue #94: idempotent builds", () => {
	let first: string;
	let second: string;
	let licenseFiles: string[];

	beforeAll(async () => {
		// Build inside an isolated copy of the fixture so this never races the #81
		// ignore-modules test, which shares the same fixture's dist/.
		const work = mkdtempSync(join(tmpdir(), "gha-idempotent-"));
		cpSync(sourceFixture, work, { recursive: true });
		const mainJs = join(work, "dist", "main.js");

		const r1 = await buildOnce(work);
		if (!r1.success) {
			throw new Error(`build 1 failed: ${r1.error ?? "unknown error"}`);
		}
		first = readFileSync(mainJs, "utf8");
		licenseFiles = readdirSync(join(work, "dist")).filter((f) => f.endsWith(".LICENSE.txt"));

		const r2 = await buildOnce(work);
		if (!r2.success) {
			throw new Error(`build 2 failed: ${r2.error ?? "unknown error"}`);
		}
		second = readFileSync(mainJs, "utf8");
	}, 240_000);

	it("produces byte-identical output across builds", () => {
		if (first !== second) {
			expect.fail(`main.js differs between builds:\n${firstDiffingLines(first, second)}`);
		}
		const hash = (s: string) => createHash("sha256").update(s).digest("hex");
		expect(hash(second)).toBe(hash(first));
	});

	it("does not emit *.LICENSE.txt sidecar files", () => {
		expect(licenseFiles).toEqual([]);
	});
});
