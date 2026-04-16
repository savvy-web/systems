import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { SilkPublishabilityPlugin, SilkPublishabilityPluginLive } from "../../src/services/SilkPublishabilityPlugin.js";
import { TargetResolverLive } from "../../src/services/TargetResolver.js";

const detect = (pkgJson: Record<string, unknown>) =>
	Effect.gen(function* () {
		const plugin = yield* SilkPublishabilityPlugin;
		return yield* plugin.detect(pkgJson);
	}).pipe(Effect.provide(SilkPublishabilityPluginLive), Effect.provide(TargetResolverLive));

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

const runExit = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromiseExit(effect);

describe("SilkPublishabilityPlugin", () => {
	describe("not publishable", () => {
		it("returns empty array for { private: true } with no publishConfig", async () => {
			const result = await run(detect({ private: true }));
			expect(result).toHaveLength(0);
		});

		it("returns empty array for package with no publishConfig.access or targets", async () => {
			const result = await run(detect({ name: "foo" }));
			expect(result).toHaveLength(0);
		});

		it("returns empty array for publishConfig with no access and no targets", async () => {
			const result = await run(detect({ name: "foo", publishConfig: {} }));
			expect(result).toHaveLength(0);
		});
	});

	describe("publishable with default npm target", () => {
		it("detects publishable with publishConfig.access: public → resolves default npm target", async () => {
			const result = await run(detect({ name: "foo", publishConfig: { access: "public" } }));
			expect(result).toHaveLength(1);
			expect(result[0].registry).toBe("https://registry.npmjs.org/");
			expect(result[0].auth).toBe("oidc");
		});

		it("detects private package with publishConfig override (private: true + publishConfig.access: public)", async () => {
			const result = await run(detect({ name: "foo", private: true, publishConfig: { access: "public" } }));
			expect(result).toHaveLength(1);
			expect(result[0].registry).toBe("https://registry.npmjs.org/");
		});
	});

	describe("publishable with multiple targets", () => {
		it("detects publishable with publishConfig.targets: [npm, github] → resolves 2 targets", async () => {
			const result = await run(detect({ name: "foo", publishConfig: { targets: ["npm", "github"] } }));
			expect(result).toHaveLength(2);
			expect(result[0].registry).toBe("https://registry.npmjs.org/");
			expect(result[1].registry).toBe("https://npm.pkg.github.com/");
		});

		it("resolves all three shorthands when targets includes jsr", async () => {
			const result = await run(detect({ name: "foo", publishConfig: { targets: ["npm", "github", "jsr"] } }));
			expect(result).toHaveLength(3);
			expect(result[2].protocol).toBe("jsr");
		});
	});

	describe("publishable with single registry", () => {
		it("handles publishConfig.registry as single target", async () => {
			const result = await run(
				detect({ name: "foo", publishConfig: { access: "public", registry: "https://custom.registry.com/" } }),
			);
			expect(result).toHaveLength(1);
			expect(result[0].registry).toBe("https://custom.registry.com/");
			expect(result[0].auth).toBe("token");
			expect(result[0].tokenEnv).toBe("NPM_TOKEN_CUSTOM_REGISTRY_COM");
		});

		it("derives tokenEnv for a different custom https registry", async () => {
			const result = await run(
				detect({ name: "foo", publishConfig: { access: "public", registry: "https://my.private.registry.io/" } }),
			);
			expect(result).toHaveLength(1);
			expect(result[0].tokenEnv).toBe("NPM_TOKEN_MY_PRIVATE_REGISTRY_IO");
		});
	});

	describe("error cases", () => {
		it("fails when a target in targets array is invalid", async () => {
			const exit = await runExit(detect({ name: "foo", publishConfig: { targets: ["npm", 42] } }));
			expect(exit._tag).toBe("Failure");
		});
	});
});
