/**
 * Integration regression test for issue #79.
 *
 * A bundled CommonJS dependency that does `__importDefault(require("node:*"))`
 * must keep working at runtime. The builder has to externalize `node:` builtins
 * with CommonJS require() semantics; otherwise `require("node:stream")` resolves
 * to an ESM namespace object and downstream `instanceof` checks throw
 * `TypeError: Right-hand side of 'instanceof' is not callable`.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

import { GitHubAction } from "../../src/index.js";

const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures/cjs-node-interop");
const mainJs = join(fixtureDir, "dist", "main.js");

describe("issue #79: CJS node: builtin interop", () => {
	beforeAll(async () => {
		rmSync(join(fixtureDir, "dist"), { recursive: true, force: true });
		const action = GitHubAction.create({
			cwd: fixtureDir,
			skipValidation: true,
			config: {
				build: { minify: false },
				persistLocal: { enabled: false },
			},
		});
		const result = await action.build();
		if (!result.success) {
			throw new Error(`fixture build failed: ${result.error ?? "unknown error"}`);
		}
	}, 120_000);

	it("bundles the fixture action", () => {
		expect(existsSync(mainJs)).toBe(true);
	});

	it("runs the bundled action without an 'instanceof is not callable' TypeError", () => {
		let output: string;
		try {
			output = execFileSync("node", [mainJs], {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			});
		} catch (error) {
			const err = error as { stderr?: string; stdout?: string };
			throw new Error(`bundled action crashed at runtime:\n${err.stderr ?? err.stdout ?? String(error)}`);
		}
		expect(output.trim()).toBe("isStream=true");
	});
});
