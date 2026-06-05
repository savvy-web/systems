import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeTargetsBinding } from "../../src/targets/binding.js";

describe("writeTargetsBinding", () => {
	it("writes dist/prod/targets.json with groups and targets", () => {
		const cwd = mkdtempSync(join(tmpdir(), "bind-"));
		const path = writeTargetsBinding(cwd, {
			groups: [{ id: "npm", name: "x", dir: "dist/prod/npm/pkg" }],
			targets: [
				{ id: "npm", group: "npm", name: "x", registry: "https://registry.npmjs.org" },
				{ id: "mirror", group: "npm", name: "x", registry: "https://mirror.test" },
			],
		});
		expect(path).toBe(join(cwd, "dist", "prod", "targets.json"));
		const parsed = JSON.parse(readFileSync(path, "utf-8")) as {
			groups: Array<{ id: string }>;
			targets: Array<{ id: string; group: string }>;
		};
		expect(parsed.groups.map((g) => g.id)).toEqual(["npm"]);
		expect(parsed.targets.find((t) => t.id === "mirror")?.group).toBe("npm");
	});
});
