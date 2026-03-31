import { describe, expect, it } from "vitest";
import { createWorkspace } from "../src/lib/workspace/index.js";

describe("workspace template", () => {
	it("always includes core templates", () => {
		const result = createWorkspace({
			name: "my-workspace",
			dirname: "my-workspace",
			packageManager: "pnpm",
			packageManagerVersion: "10.33.0",
			nodeVersion: "24.11.0",
		});

		const names = result.map((e) => e.name);
		expect(names).toContain("package-json");
		expect(names).toContain("tsconfig");
		expect(names).toContain("gitignore");
		expect(names).toContain("readme");
	});

	it("includes pnpm-workspace when packageManager is pnpm", () => {
		const result = createWorkspace({
			name: "my-workspace",
			dirname: "my-workspace",
			packageManager: "pnpm",
			packageManagerVersion: "10.33.0",
			nodeVersion: "24.11.0",
		});
		const names = result.map((e) => e.name);
		expect(names).toContain("pnpm-workspace");
	});

	it("excludes pnpm-workspace when packageManager is not pnpm", () => {
		const result = createWorkspace({
			name: "my-workspace",
			dirname: "my-workspace",
			packageManager: "npm",
			packageManagerVersion: "10.9.2",
			nodeVersion: "24.11.0",
		});
		const names = result.map((e) => e.name);
		expect(names).not.toContain("pnpm-workspace");
	});

	it("includes optional templates when features enabled", () => {
		const result = createWorkspace({
			name: "my-workspace",
			dirname: "my-workspace",
			packageManager: "pnpm",
			packageManagerVersion: "10.33.0",
			nodeVersion: "24.11.0",
			features: {
				biome: true,
				turbo: true,
				changesets: true,
				vscode: true,
			},
		});
		const names = result.map((e) => e.name);
		expect(names).toContain("biome");
		expect(names).toContain("turbo-root");
		expect(names).toContain("changeset");
		expect(names).toContain("vscode-settings");
		expect(names).toContain("vscode-extensions");
	});

	it("excludes optional templates when features disabled", () => {
		const result = createWorkspace({
			name: "my-workspace",
			dirname: "my-workspace",
			packageManager: "pnpm",
			packageManagerVersion: "10.33.0",
			nodeVersion: "24.11.0",
			features: {},
		});
		const names = result.map((e) => e.name);
		expect(names).not.toContain("biome");
		expect(names).not.toContain("turbo-root");
		expect(names).not.toContain("changeset");
		expect(names).not.toContain("vscode-settings");
	});

	it("configures package.json with engines and packageManager", () => {
		const result = createWorkspace({
			name: "my-workspace",
			dirname: "my-workspace",
			packageManager: "pnpm",
			packageManagerVersion: "10.33.0",
			nodeVersion: "24.11.0",
		});
		const pkgEntry = result.find((e) => e.name === "package-json")!;
		const pkg = JSON.parse(pkgEntry.content);
		expect(pkg.packageManager).toContain("pnpm@10.33.0");
		expect(pkg.engines.node).toContain("24.11.0");
	});

	it("requires all mandatory fields", () => {
		expect(() => createWorkspace({} as any)).toThrow();
		expect(() => createWorkspace({ name: "test" } as any)).toThrow();
	});
});
