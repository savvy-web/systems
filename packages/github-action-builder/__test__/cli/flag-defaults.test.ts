/**
 * Structural guard for CLI boolean flags.
 *
 * In `effect/unstable/cli`, a bare `Flag.boolean(...)` is REQUIRED — omitting it
 * on the command line aborts with "Missing required flag". Only
 * `Flag.withDefault(false)` makes it the opt-in switch it reads as. The v3 to v4
 * migration dropped those defaults and made `--quiet`, `--no-validate` and
 * `--no-persist` mandatory on `github-action-builder build`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const commandsDir = fileURLToPath(new URL("../../src/cli/commands", import.meta.url));

const sourceFiles = readdirSync(commandsDir)
	.filter((name) => name.endsWith(".ts"))
	.map((name) => ({ name, source: readFileSync(join(commandsDir, name), "utf8") }));

/**
 * Slice each `Flag.boolean("name")...;` declaration out of a source file.
 */
const booleanFlagDeclarations = (source: string): Array<{ flag: string; declaration: string }> => {
	const declarations: Array<{ flag: string; declaration: string }> = [];
	const pattern = /Flag\.boolean\(\s*"([^"]+)"\s*\)/g;
	let match = pattern.exec(source);
	while (match !== null) {
		const end = source.indexOf(";", match.index);
		declarations.push({
			flag: match[1] as string,
			declaration: source.slice(match.index, end === -1 ? source.length : end),
		});
		match = pattern.exec(source);
	}
	return declarations;
};

describe("cli boolean flags", () => {
	it("finds boolean flags to check", () => {
		const total = sourceFiles.reduce((count, file) => count + booleanFlagDeclarations(file.source).length, 0);
		expect(total).toBeGreaterThan(0);
	});

	for (const file of sourceFiles) {
		for (const { flag, declaration } of booleanFlagDeclarations(file.source)) {
			it(`--${flag} in ${file.name} declares a default so it stays optional`, () => {
				expect(declaration).toContain("Flag.withDefault(");
			});
		}
	}
});
