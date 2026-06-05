import { describe, expect, it } from "vitest";
import { resolveTargets } from "../../src/targets/resolve-targets.js";

describe("resolveTargets", () => {
	it("collapses npm:true + github:true into one canonical base-name group (scoped base)", () => {
		const r = resolveTargets({ targets: { npm: true, github: true }, baseName: "@savvy-web/x" });
		expect(r.groups).toHaveLength(1);
		expect(r.groups[0]?.id).toBe("npm");
		expect(r.groups[0]?.name).toBe("@savvy-web/x");
		expect(r.groups[0]?.dir).toBe("dist/prod/npm/pkg");
		expect(r.targets.map((t) => t.id).sort()).toEqual(["github", "npm"]);
		expect(r.targets.find((t) => t.id === "github")?.registry).toBe("https://npm.pkg.github.com");
		expect(r.targets.every((t) => t.group === "npm")).toBe(true);
	});

	it("npm:true (base) + github string override produces two groups with distinct names", () => {
		const r = resolveTargets({ targets: { npm: true, github: "@spencerbeggs/x" }, baseName: "x" });
		expect(r.groups.map((g) => g.id).sort()).toEqual(["github", "npm"]);
		expect(r.groups.find((g) => g.id === "npm")?.name).toBe("x");
		expect(r.groups.find((g) => g.id === "github")?.name).toBe("@spencerbeggs/x");
		expect(r.groups.find((g) => g.id === "github")?.dir).toBe("dist/prod/github/pkg");
	});

	it("from reuses the referenced group's bytes (no new group) and sets its own registry", () => {
		const r = resolveTargets({
			targets: { npm: true, mirror: { from: "npm", registry: "https://mirror.test" } },
			baseName: "x",
		});
		expect(r.groups).toHaveLength(1);
		expect(r.groups[0]?.id).toBe("npm");
		const mirror = r.targets.find((t) => t.id === "mirror");
		expect(mirror?.group).toBe("npm");
		expect(mirror?.name).toBe("x");
		expect(mirror?.registry).toBe("https://mirror.test");
	});

	it("object name override on a custom key gets its own group and requires a registry", () => {
		const r = resolveTargets({
			targets: { npm: true, gh2: { name: "@a/x", registry: "https://r2.test" } },
			baseName: "x",
		});
		expect(r.groups.map((g) => g.id).sort()).toEqual(["gh2", "npm"]);
		expect(r.targets.find((t) => t.id === "gh2")?.name).toBe("@a/x");
	});

	it("folders the canonical group after the first true id when no npm key is present", () => {
		const r = resolveTargets({ targets: { github: true }, baseName: "@s/x" });
		expect(r.groups[0]?.id).toBe("github");
		expect(r.groups[0]?.dir).toBe("dist/prod/github/pkg");
	});

	it("throws on from+name together", () => {
		expect(() =>
			resolveTargets({
				targets: { npm: true, x: { from: "npm", name: "@a/x", registry: "https://r" } },
				baseName: "x",
			}),
		).toThrow(/mutually exclusive/);
	});

	it("throws on a dangling from", () => {
		expect(() => resolveTargets({ targets: { x: { from: "nope", registry: "https://r" } }, baseName: "x" })).toThrow(
			/dangling/,
		);
	});

	it("throws a ConfigValidationError (typed) on a dangling from", () => {
		try {
			resolveTargets({ targets: { x: { from: "nope", registry: "https://r" } }, baseName: "x" });
			expect.unreachable("should have thrown");
		} catch (e) {
			expect((e as { _tag?: string })._tag).toBe("ConfigValidationError");
		}
	});

	it("throws on chained from", () => {
		expect(() =>
			resolveTargets({
				targets: { npm: true, a: { from: "b", registry: "https://a" }, b: { from: "npm", registry: "https://b" } },
				baseName: "x",
			}),
		).toThrow(/chained/);
	});

	it("throws on a custom key with no registry", () => {
		expect(() => resolveTargets({ targets: { custom: { name: "@a/x" } }, baseName: "x" })).toThrow(/registry/);
	});

	it("throws on github:true with an unscoped base name", () => {
		expect(() => resolveTargets({ targets: { github: true }, baseName: "x" })).toThrow(/scoped/);
	});

	it("throws on an unknown registry key with value true", () => {
		expect(() => resolveTargets({ targets: { custom: true }, baseName: "x" })).toThrow(/not a known registry/);
	});

	it("throws when targets is empty", () => {
		expect(() => resolveTargets({ targets: {}, baseName: "x" })).toThrow(/at least one/);
	});

	it("permits npm:true with an unscoped base name", () => {
		const r = resolveTargets({ targets: { npm: true }, baseName: "unscoped" });
		expect(r.groups[0]?.name).toBe("unscoped");
	});

	it("throws on a self-referencing from", () => {
		expect(() => resolveTargets({ targets: { a: { from: "a", registry: "https://r" } }, baseName: "x" })).toThrow(
			/self-referencing/,
		);
	});

	it("from reuses a string-override group's bytes", () => {
		const r = resolveTargets({
			targets: { github: "@scope/x", mirror: { from: "github", registry: "https://mirror.test" } },
			baseName: "x",
		});
		expect(r.groups).toHaveLength(1);
		expect(r.groups[0]?.id).toBe("github");
		expect(r.targets.find((t) => t.id === "mirror")?.group).toBe("github");
		expect(r.targets.find((t) => t.id === "mirror")?.name).toBe("@scope/x");
	});
});
