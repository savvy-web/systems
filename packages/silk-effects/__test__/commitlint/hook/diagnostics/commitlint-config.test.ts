import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	parseHuskyConfigPath,
	readCommitlintConfigPath,
} from "../../../../src/commitlint/hook/diagnostics/commitlint-config.js";

const husky = (line: string) => `#!/usr/bin/env sh\nROOT=$(git rev-parse --show-toplevel)\n${line}\n`;

describe("parseHuskyConfigPath", () => {
	it("extracts the path from a $ROOT-prefixed --config arg", () => {
		const content = husky('pnpm exec commitlint --config "$ROOT/lib/configs/commitlint.config.ts" --edit "$1"');
		expect(parseHuskyConfigPath(content, "/repo")).toBe("/repo/lib/configs/commitlint.config.ts");
	});

	// biome-ignore lint/suspicious/noTemplateCurlyInString: literal bash variable syntax
	it("extracts the path from a ${ROOT}-prefixed --config arg", () => {
		// biome-ignore lint/suspicious/noTemplateCurlyInString: literal bash variable syntax
		const content = husky('pnpm exec commitlint --config "${ROOT}/commitlint.config.ts" --edit "$1"');
		expect(parseHuskyConfigPath(content, "/repo")).toBe("/repo/commitlint.config.ts");
	});

	it("supports single-quoted paths", () => {
		const content = husky("pnpm exec commitlint --config '$ROOT/cl.ts' --edit \"$1\"");
		expect(parseHuskyConfigPath(content, "/repo")).toBe("/repo/cl.ts");
	});

	it("supports unquoted paths", () => {
		const content = husky('pnpm exec commitlint --config $ROOT/cl.ts --edit "$1"');
		expect(parseHuskyConfigPath(content, "/repo")).toBe("/repo/cl.ts");
	});

	it("preserves absolute paths", () => {
		const content = husky('pnpm exec commitlint --config "/etc/cl.ts" --edit "$1"');
		expect(parseHuskyConfigPath(content, "/repo")).toBe("/etc/cl.ts");
	});

	it("resolves a relative path without a $ROOT prefix", () => {
		const content = husky('pnpm exec commitlint --config "lib/configs/cl.ts" --edit "$1"');
		expect(parseHuskyConfigPath(content, "/repo")).toBe("/repo/lib/configs/cl.ts");
	});

	it("returns null when there is no --config flag", () => {
		const content = husky('pnpm exec commitlint --edit "$1"');
		expect(parseHuskyConfigPath(content, "/repo")).toBeNull();
	});
});

describe("readCommitlintConfigPath", () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "savvy-cl-"));
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it("reads the path from .husky/commit-msg", async () => {
		await mkdir(join(dir, ".husky"), { recursive: true });
		await writeFile(
			join(dir, ".husky", "commit-msg"),
			husky('pnpm exec commitlint --config "$ROOT/lib/configs/commitlint.config.ts" --edit "$1"'),
		);
		expect(await readCommitlintConfigPath(dir)).toBe(resolve(dir, "lib/configs/commitlint.config.ts"));
	});

	it("returns null when .husky/commit-msg does not exist", async () => {
		expect(await readCommitlintConfigPath(dir)).toBeNull();
	});

	it("returns null when the hook has no --config arg", async () => {
		await mkdir(join(dir, ".husky"), { recursive: true });
		await writeFile(join(dir, ".husky", "commit-msg"), husky('pnpm exec commitlint --edit "$1"'));
		expect(await readCommitlintConfigPath(dir)).toBeNull();
	});
});
