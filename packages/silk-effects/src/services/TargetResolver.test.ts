import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { TargetResolver, TargetResolverLive } from "./TargetResolver.js";

const run = <A, E>(effect: Effect.Effect<A, E, TargetResolver>) =>
	Effect.runPromise(effect.pipe(Effect.provide(TargetResolverLive)));

const runExit = <A, E>(effect: Effect.Effect<A, E, TargetResolver>) =>
	Effect.runPromiseExit(effect.pipe(Effect.provide(TargetResolverLive)));

describe("TargetResolver", () => {
	describe('shorthand "npm"', () => {
		it("resolves to npmjs.org with oidc auth and null tokenEnv", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve("npm");
				}),
			);
			expect(result).toHaveLength(1);
			const [target] = result;
			expect(target.protocol).toBe("npm");
			expect(target.registry).toBe("https://registry.npmjs.org/");
			expect(target.auth).toBe("oidc");
			expect(target.tokenEnv).toBeNull();
		});

		it("applies default directory, access, provenance, and tag", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve("npm");
				}),
			);
			const [target] = result;
			expect(target.directory).toBe("dist/npm");
			expect(target.access).toBe("public");
			expect(target.provenance).toBe(false);
			expect(target.tag).toBe("latest");
		});
	});

	describe('shorthand "github"', () => {
		it("resolves to npm.pkg.github.com with token auth and GITHUB_TOKEN", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve("github");
				}),
			);
			expect(result).toHaveLength(1);
			const [target] = result;
			expect(target.protocol).toBe("npm");
			expect(target.registry).toBe("https://npm.pkg.github.com/");
			expect(target.auth).toBe("token");
			expect(target.tokenEnv).toBe("GITHUB_TOKEN");
		});
	});

	describe('shorthand "jsr"', () => {
		it("resolves with jsr protocol, null registry, and oidc auth", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve("jsr");
				}),
			);
			expect(result).toHaveLength(1);
			const [target] = result;
			expect(target.protocol).toBe("jsr");
			expect(target.registry).toBeNull();
			expect(target.auth).toBe("oidc");
			expect(target.tokenEnv).toBeNull();
		});
	});

	describe("custom URL", () => {
		it("resolves https:// URL with npm protocol, token auth, and derived tokenEnv", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve("https://custom.registry.com/");
				}),
			);
			expect(result).toHaveLength(1);
			const [target] = result;
			expect(target.protocol).toBe("npm");
			expect(target.registry).toBe("https://custom.registry.com/");
			expect(target.auth).toBe("token");
			expect(target.tokenEnv).toBe("NPM_TOKEN_CUSTOM_REGISTRY_COM");
		});

		it("derives tokenEnv by replacing dots with underscores and uppercasing", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve("https://my.private.registry.io/npm/");
				}),
			);
			const [target] = result;
			expect(target.tokenEnv).toBe("NPM_TOKEN_MY_PRIVATE_REGISTRY_IO");
		});
	});

	describe("object target", () => {
		it("applies defaults for access, provenance, and tag when omitted", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve({ protocol: "npm", registry: "https://registry.npmjs.org/" });
				}),
			);
			const [target] = result;
			expect(target.access).toBe("public");
			expect(target.provenance).toBe(false);
			expect(target.tag).toBe("latest");
			expect(target.directory).toBe("dist/npm");
		});

		it("preserves explicitly provided fields", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve({
						protocol: "npm",
						registry: "https://registry.npmjs.org/",
						access: "restricted",
						provenance: true,
						tag: "beta",
						directory: "dist/custom",
					});
				}),
			);
			const [target] = result;
			expect(target.access).toBe("restricted");
			expect(target.provenance).toBe(true);
			expect(target.tag).toBe("beta");
			expect(target.directory).toBe("dist/custom");
		});

		it("infers token auth and GITHUB_TOKEN when registry contains github.com", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve({ protocol: "npm", registry: "https://npm.pkg.github.com/" });
				}),
			);
			const [target] = result;
			expect(target.auth).toBe("token");
			expect(target.tokenEnv).toBe("GITHUB_TOKEN");
		});

		it("infers oidc auth and null tokenEnv when registry does not contain github.com", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve({ protocol: "npm", registry: "https://registry.npmjs.org/" });
				}),
			);
			const [target] = result;
			expect(target.auth).toBe("oidc");
			expect(target.tokenEnv).toBeNull();
		});

		it("infers oidc and null tokenEnv when registry is null", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve({ protocol: "jsr" });
				}),
			);
			const [target] = result;
			expect(target.protocol).toBe("jsr");
			expect(target.auth).toBe("oidc");
			expect(target.tokenEnv).toBeNull();
		});
	});

	describe("array of targets", () => {
		it("resolves an array of mixed targets into an array of resolved targets", async () => {
			const result = await run(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve(["npm", "github", "jsr"]);
				}),
			);
			expect(result).toHaveLength(3);
			expect(result[0].registry).toBe("https://registry.npmjs.org/");
			expect(result[1].registry).toBe("https://npm.pkg.github.com/");
			expect(result[2].protocol).toBe("jsr");
		});
	});

	describe("error cases", () => {
		it("fails on a numeric target", async () => {
			const exit = await runExit(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve(42);
				}),
			);
			expect(exit._tag).toBe("Failure");
		});

		it("fails on an unknown non-https string", async () => {
			const exit = await runExit(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve("pypi");
				}),
			);
			expect(exit._tag).toBe("Failure");
		});

		it("fails on an http:// (non-https) string", async () => {
			const exit = await runExit(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve("http://registry.npmjs.org/");
				}),
			);
			expect(exit._tag).toBe("Failure");
		});

		it("fails on null", async () => {
			const exit = await runExit(
				Effect.gen(function* () {
					const resolver = yield* TargetResolver;
					return yield* resolver.resolve(null);
				}),
			);
			expect(exit._tag).toBe("Failure");
		});
	});
});
