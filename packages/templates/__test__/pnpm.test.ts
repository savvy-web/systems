import { describe, expect, it } from "@effect/vitest";
import { Yaml } from "@effected/yaml";
import { Effect } from "effect";
import { createPnpmWorkspace } from "../src/lib/pnpm/index.js";

const loadYaml = (text: string) => Effect.map(Yaml.parse(text), (v) => v as Record<string, unknown>);

describe("pnpm workspace template", () => {
	it.effect("creates pnpm-workspace.yaml with packages", () =>
		Effect.gen(function* () {
			const result = createPnpmWorkspace({
				packages: ["packages/*", "apps/*"],
			});
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("pnpm-workspace");
			expect(result[0].filename).toBe("pnpm-workspace.yaml");

			const parsed = yield* loadYaml(result[0].content);
			expect(parsed.packages).toEqual(["packages/*", "apps/*"]);
		}),
	);

	it.effect("includes autoInstallPeers", () =>
		Effect.gen(function* () {
			const result = createPnpmWorkspace({
				packages: ["packages/*"],
				autoInstallPeers: true,
			});
			const parsed = yield* loadYaml(result[0].content);
			expect(parsed.autoInstallPeers).toBe(true);
		}),
	);

	it.effect("includes catalog and catalogMode", () =>
		Effect.gen(function* () {
			const result = createPnpmWorkspace({
				packages: ["packages/*"],
				catalog: { react: "^18.0.0", typescript: "^5.0.0" },
				catalogMode: "strict",
			});
			const parsed = yield* loadYaml(result[0].content);
			expect(parsed.catalog).toEqual({ react: "^18.0.0", typescript: "^5.0.0" });
			expect(parsed.catalogMode).toBe("strict");
		}),
	);

	it.effect("omits undefined optional fields", () =>
		Effect.gen(function* () {
			const result = createPnpmWorkspace({ packages: ["packages/*"] });
			const parsed = yield* loadYaml(result[0].content);
			expect(parsed.catalog).toBeUndefined();
			expect(parsed.autoInstallPeers).toBeUndefined();
		}),
	);

	it("requires packages", () => {
		// biome-ignore lint/suspicious/noExplicitAny: intentionally passing invalid input to test schema validation
		expect(() => createPnpmWorkspace({} as any)).toThrow();
	});
});
