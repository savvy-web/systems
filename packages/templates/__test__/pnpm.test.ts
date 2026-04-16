import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { createPnpmWorkspace } from "../src/lib/pnpm/index.js";

describe("pnpm workspace template", () => {
	it("creates pnpm-workspace.yaml with packages", () => {
		const result = createPnpmWorkspace({
			packages: ["packages/*", "apps/*"],
		});
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("pnpm-workspace");
		expect(result[0].filename).toBe("pnpm-workspace.yaml");

		const parsed = yaml.load(result[0].content) as Record<string, unknown>;
		expect(parsed.packages).toEqual(["packages/*", "apps/*"]);
	});

	it("includes autoInstallPeers", () => {
		const result = createPnpmWorkspace({
			packages: ["packages/*"],
			autoInstallPeers: true,
		});
		const parsed = yaml.load(result[0].content) as Record<string, unknown>;
		expect(parsed.autoInstallPeers).toBe(true);
	});

	it("includes catalog and catalogMode", () => {
		const result = createPnpmWorkspace({
			packages: ["packages/*"],
			catalog: { react: "^18.0.0", typescript: "^5.0.0" },
			catalogMode: "strict",
		});
		const parsed = yaml.load(result[0].content) as Record<string, unknown>;
		expect(parsed.catalog).toEqual({ react: "^18.0.0", typescript: "^5.0.0" });
		expect(parsed.catalogMode).toBe("strict");
	});

	it("omits undefined optional fields", () => {
		const result = createPnpmWorkspace({ packages: ["packages/*"] });
		const parsed = yaml.load(result[0].content) as Record<string, unknown>;
		expect(parsed.catalog).toBeUndefined();
		expect(parsed.autoInstallPeers).toBeUndefined();
	});

	it("requires packages", () => {
		// biome-ignore lint/suspicious/noExplicitAny: intentionally passing invalid input to test schema validation
		expect(() => createPnpmWorkspace({} as any)).toThrow();
	});
});
