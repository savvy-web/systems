import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineBuild } from "../../src/config.js";
import { runBuild } from "../../src/run.js";

const FIX = join(import.meta.dirname, "fixtures", "multitarget");

describe("multi-target build (real, renamed variants + from reuse)", () => {
	it("--target prod emits one byte-variant folder per distinct name plus the binding", async () => {
		rmSync(join(FIX, "dist"), { recursive: true, force: true });
		await runBuild(defineBuild({ meta: false }), { cwd: FIX, argv: ["--target", "prod"], writeOutput: () => {} });

		// npm group -> base name (unscoped)
		const npmPkg = JSON.parse(readFileSync(join(FIX, "dist/prod/npm/pkg/package.json"), "utf-8")) as {
			name: string;
			private?: boolean;
			publishConfig?: unknown;
		};
		expect(npmPkg.name).toBe("multitarget-base");
		expect(npmPkg.private).toBe(false);
		// github group -> scoped override
		const ghPkg = JSON.parse(readFileSync(join(FIX, "dist/prod/github/pkg/package.json"), "utf-8")) as { name: string };
		expect(ghPkg.name).toBe("@scope/multitarget-base");
		// mirror reuses the npm group, so NO third byte-variant folder
		expect(existsSync(join(FIX, "dist/prod/mirror"))).toBe(false);

		// binding
		const binding = JSON.parse(readFileSync(join(FIX, "dist/prod/targets.json"), "utf-8")) as {
			groups: Array<{ id: string }>;
			targets: Array<{ id: string; group: string; registry: string }>;
		};
		expect(binding.groups.map((g) => g.id).sort()).toEqual(["github", "npm"]);
		expect(binding.targets.find((t) => t.id === "mirror")?.group).toBe("npm");
		expect(binding.targets.find((t) => t.id === "mirror")?.registry).toBe("https://mirror.test");
		// publishConfig (incl. targets) is stripped from emitted manifests
		expect(npmPkg.publishConfig).toBeUndefined();
	}, 60_000);
});
