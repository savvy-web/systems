import { describe, expect, it } from "vitest";
import { createTurboRoot, createTurboWorkspace } from "../src/lib/turbo/index.js";

describe("turbo root template", () => {
	it("creates root turbo.json with schema and tasks", () => {
		const result = createTurboRoot({
			tasks: {
				build: { dependsOn: ["^build"], outputs: ["dist/**"] },
			},
		});
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("turbo-root");
		expect(result[0].filename).toBe("turbo.json");

		const parsed = JSON.parse(result[0].content);
		expect(parsed.$schema).toBe("https://turborepo.com/schema.v2.json");
		expect(parsed.tasks.build.dependsOn).toEqual(["^build"]);
	});

	it("includes optional global fields", () => {
		const result = createTurboRoot({
			tasks: {},
			globalPassThroughEnv: ["CI", "GITHUB_ACTIONS"],
			globalDependencies: ["tsconfig.json"],
			ui: "stream",
		});
		const parsed = JSON.parse(result[0].content);
		expect(parsed.globalPassThroughEnv).toEqual(["CI", "GITHUB_ACTIONS"]);
		expect(parsed.globalDependencies).toEqual(["tsconfig.json"]);
		expect(parsed.ui).toBe("stream");
	});

	it("omits empty optional fields", () => {
		const result = createTurboRoot({ tasks: {} });
		const parsed = JSON.parse(result[0].content);
		expect(parsed.globalDependencies).toBeUndefined();
		expect(parsed.globalEnv).toBeUndefined();
		expect(parsed.ui).toBeUndefined();
	});

	it("requires tasks", () => {
		// biome-ignore lint/suspicious/noExplicitAny: intentionally passing invalid input to test schema validation
		expect(() => createTurboRoot({} as any)).toThrow();
	});
});

describe("turbo workspace template", () => {
	it("creates workspace turbo.json with extends", () => {
		const result = createTurboWorkspace({});
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("turbo-workspace");
		expect(result[0].filename).toBe("turbo.json");

		const parsed = JSON.parse(result[0].content);
		expect(parsed.extends).toEqual(["//"]);
	});

	it("includes task overrides", () => {
		const result = createTurboWorkspace({
			tasks: {
				"build:dev": { cache: true, dependsOn: ["types:check"] },
			},
		});
		const parsed = JSON.parse(result[0].content);
		expect(parsed.tasks["build:dev"].cache).toBe(true);
	});
});
