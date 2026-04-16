import { Option, Schema } from "effect";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { AnalyzedWorkspace, SilkPublishConfig, WorkspaceAnalysis } from "../../src/schemas/WorkspaceAnalysisSchemas.js";

describe("SilkPublishConfig", () => {
	it("is a Schema.Class that extends PublishConfig", () => {
		const config = new SilkPublishConfig({
			access: "public",
			registry: "https://registry.npmjs.org/",
			directory: "dist/npm",
			tag: "latest",
			linkDirectory: true,
		});
		expect(config.access).toBe("public");
		expect(config.directory).toBe("dist/npm");
		expect(config.tag).toBe("latest");
		expect(config.linkDirectory).toBe(true);
	});

	it("decodes Silk targets array with shorthands", () => {
		const config = new SilkPublishConfig({
			access: "public",
			targets: ["npm", "github"],
		});
		expect(config.targets).toEqual(["npm", "github"]);
	});

	it("decodes Silk targets array with full objects", () => {
		const result = Schema.decodeUnknownSync(SilkPublishConfig)({
			access: "public",
			targets: [
				{
					protocol: "npm",
					registry: "https://npm.pkg.github.com/",
					directory: "dist/github",
					access: "public",
					provenance: true,
				},
			],
		});
		expect(result.targets).toHaveLength(1);
		expect(result.targets?.[0]).toEqual(expect.objectContaining({ registry: "https://npm.pkg.github.com/" }));
	});

	it("decodes with no fields (all optional)", () => {
		const config = new SilkPublishConfig({});
		expect(config.access).toBeUndefined();
		expect(config.targets).toBeUndefined();
	});
});

describe("AnalyzedWorkspace", () => {
	const makeWorkspace = (overrides: Partial<ConstructorParameters<typeof AnalyzedWorkspace>[0]> = {}) =>
		new AnalyzedWorkspace({
			name: "@scope/lib",
			version: { current: "1.0.0" },
			path: "/project/packages/lib",
			root: false,
			publishConfig: null,
			publishable: true,
			targets: [],
			versioned: false,
			tagged: false,
			released: false,
			linked: [],
			fixed: [],
			...overrides,
		});

	it("has correct _tag", () => {
		const ws = makeWorkspace();
		expect(ws._tag).toBe("AnalyzedWorkspace");
	});

	it("isRoot returns root field value", () => {
		expect(makeWorkspace({ root: true }).isRoot).toBe(true);
		expect(makeWorkspace({ root: false }).isRoot).toBe(false);
	});

	it("isPublishable returns publishable field value", () => {
		expect(makeWorkspace({ publishable: true }).isPublishable).toBe(true);
		expect(makeWorkspace({ publishable: false }).isPublishable).toBe(false);
	});

	it("isReleasable is versioned && tagged", () => {
		expect(makeWorkspace({ versioned: true, tagged: true, released: true }).isReleasable).toBe(true);
		expect(makeWorkspace({ versioned: true, tagged: false, released: false }).isReleasable).toBe(false);
	});

	it("isFixed returns true when fixed array is non-empty", () => {
		const other = makeWorkspace({ name: "@scope/other" });
		expect(makeWorkspace({ fixed: [other] }).isFixed).toBe(true);
		expect(makeWorkspace({ fixed: [] }).isFixed).toBe(false);
	});

	it("isLinked returns true when linked array is non-empty", () => {
		const other = makeWorkspace({ name: "@scope/other" });
		expect(makeWorkspace({ linked: [other] }).isLinked).toBe(true);
		expect(makeWorkspace({ linked: [] }).isLinked).toBe(false);
	});

	it("hasTarget checks target registries", () => {
		const ws = makeWorkspace({
			targets: [
				{
					protocol: "npm" as const,
					registry: "https://registry.npmjs.org/",
					directory: "dist/npm",
					access: "public" as const,
					provenance: false,
					tag: "latest",
					auth: "oidc" as const,
					tokenEnv: null,
				},
			],
		});
		expect(ws.hasTarget("npm")).toBe(true);
		expect(ws.hasTarget("github")).toBe(false);
	});

	it("toString returns name@version", () => {
		expect(makeWorkspace().toString()).toBe("@scope/lib@1.0.0");
	});
});

describe("WorkspaceAnalysis", () => {
	const makeAnalysis = () => {
		const ws1 = new AnalyzedWorkspace({
			name: "root",
			version: { current: "0.0.0" },
			path: "/project",
			root: true,
			publishConfig: null,
			publishable: false,
			targets: [],
			versioned: false,
			tagged: false,
			released: false,
			linked: [],
			fixed: [],
		});
		const ws2 = new AnalyzedWorkspace({
			name: "@scope/lib",
			version: { current: "1.0.0" },
			path: "/project/packages/lib",
			root: false,
			publishConfig: null,
			publishable: true,
			targets: [],
			versioned: true,
			tagged: true,
			released: true,
			linked: [],
			fixed: [],
		});
		return new WorkspaceAnalysis({
			root: "/project",
			runtime: "node",
			packageManager: { type: "pnpm" },
			workspaces: [ws1, ws2],
			changesetConfig: null,
			versioning: null,
			tagStrategy: null,
		});
	};

	it("has correct _tag", () => {
		expect(makeAnalysis()._tag).toBe("WorkspaceAnalysis");
	});

	it("rootWorkspace returns Some for analysis with a root", () => {
		const root = makeAnalysis().rootWorkspace;
		expect(Option.isSome(root)).toBe(true);
		expect(Option.getOrThrow(root).name).toBe("root");
	});

	it("findWorkspace returns Some for existing name", () => {
		const result = makeAnalysis().findWorkspace("@scope/lib");
		expect(Option.isSome(result)).toBe(true);
		expect(Option.getOrThrow(result).name).toBe("@scope/lib");
	});

	it("findWorkspace returns None for missing name", () => {
		expect(Option.isNone(makeAnalysis().findWorkspace("missing"))).toBe(true);
	});

	it("publishableWorkspaces filters correctly", () => {
		const analysis = makeAnalysis();
		expect(analysis.publishableWorkspaces).toHaveLength(1);
		expect(analysis.publishableWorkspaces[0].name).toBe("@scope/lib");
	});

	it("releasableWorkspaces filters correctly", () => {
		expect(makeAnalysis().releasableWorkspaces).toHaveLength(1);
	});

	it("hasChangesets is false when config is null", () => {
		expect(makeAnalysis().hasChangesets).toBe(false);
	});
});

describe("Pretty printing", () => {
	it("AnalyzedWorkspace.pretty produces a readable string", () => {
		const ws = new AnalyzedWorkspace({
			name: "@scope/lib",
			version: { current: "1.0.0" },
			path: "/project/packages/lib",
			root: false,
			publishConfig: null,
			publishable: true,
			targets: [],
			versioned: true,
			tagged: true,
			released: true,
			linked: [],
			fixed: [],
		});
		const output = AnalyzedWorkspace.pretty(ws);
		expect(output).toContain("AnalyzedWorkspace");
		expect(output).toContain("@scope/lib");
		expect(output).toContain("1.0.0");
	});

	it("WorkspaceAnalysis.pretty produces a readable string", () => {
		const ws = new AnalyzedWorkspace({
			name: "root",
			version: { current: "0.0.0" },
			path: "/project",
			root: true,
			publishConfig: null,
			publishable: false,
			targets: [],
			versioned: false,
			tagged: false,
			released: false,
			linked: [],
			fixed: [],
		});
		const analysis = new WorkspaceAnalysis({
			root: "/project",
			runtime: "node",
			packageManager: { type: "pnpm" },
			workspaces: [ws],
			changesetConfig: null,
			versioning: null,
			tagStrategy: null,
		});
		const output = WorkspaceAnalysis.pretty(analysis);
		expect(output).toContain("WorkspaceAnalysis");
		expect(output).toContain("/project");
		expect(output).toContain("pnpm");
	});

	it("AnalyzedWorkspace.pretty handles recursive fixed/linked refs", () => {
		const a = new AnalyzedWorkspace({
			name: "@scope/a",
			version: { current: "1.0.0" },
			path: "/project/a",
			root: false,
			publishConfig: null,
			publishable: true,
			targets: [],
			versioned: true,
			tagged: true,
			released: true,
			linked: [],
			fixed: [],
		});
		const b = new AnalyzedWorkspace({
			name: "@scope/b",
			version: { current: "1.0.0" },
			path: "/project/b",
			root: false,
			publishConfig: null,
			publishable: true,
			targets: [],
			versioned: true,
			tagged: true,
			released: true,
			linked: [],
			fixed: [a],
		});
		const output = AnalyzedWorkspace.pretty(b);
		expect(output).toContain("@scope/b");
		expect(output).toContain("@scope/a");
	});
});

describe("Arbitrary (property-based tests)", () => {
	// Build arbitraries with plain fast-check to avoid recursive Schema.suspend issues
	const arbWorkspace = fc
		.record({
			name: fc.string({ minLength: 1 }),
			version: fc.string({ minLength: 1 }).map((v) => ({ current: v })),
			path: fc.string({ minLength: 1 }).map((p) => `/project/${p}`),
			root: fc.boolean(),
			publishable: fc.boolean(),
			versioned: fc.boolean(),
			tagged: fc.boolean(),
		})
		.map(
			({ name, version, path, root, publishable, versioned, tagged }) =>
				new AnalyzedWorkspace({
					name,
					version,
					path,
					root,
					publishConfig: null,
					publishable,
					targets: [],
					versioned,
					tagged,
					released: versioned && tagged,
					linked: [],
					fixed: [],
				}),
		);

	const arbAnalysis = fc
		.tuple(
			fc.string({ minLength: 1 }),
			fc.constantFrom("node" as const, "bun" as const),
			fc.constantFrom("npm" as const, "pnpm" as const, "yarn" as const, "bun" as const),
			fc.array(arbWorkspace, { minLength: 0, maxLength: 5 }),
		)
		.map(
			([root, runtime, pmType, workspaces]) =>
				new WorkspaceAnalysis({
					root,
					runtime,
					packageManager: { type: pmType },
					workspaces,
					changesetConfig: null,
					versioning: null,
					tagStrategy: null,
				}),
		);

	it("isReleasable always equals released field", () => {
		fc.assert(
			fc.property(arbWorkspace, (ws) => {
				expect(ws.isReleasable).toBe(ws.released);
			}),
			{ numRuns: 100 },
		);
	});

	it("isRoot always equals root field", () => {
		fc.assert(
			fc.property(arbWorkspace, (ws) => {
				expect(ws.isRoot).toBe(ws.root);
			}),
			{ numRuns: 100 },
		);
	});

	it("isPublishable always equals publishable field", () => {
		fc.assert(
			fc.property(arbWorkspace, (ws) => {
				expect(ws.isPublishable).toBe(ws.publishable);
			}),
			{ numRuns: 100 },
		);
	});

	it("isFixed is true iff fixed array is non-empty", () => {
		fc.assert(
			fc.property(arbWorkspace, (ws) => {
				expect(ws.isFixed).toBe(ws.fixed.length > 0);
			}),
			{ numRuns: 100 },
		);
	});

	it("isLinked is true iff linked array is non-empty", () => {
		fc.assert(
			fc.property(arbWorkspace, (ws) => {
				expect(ws.isLinked).toBe(ws.linked.length > 0);
			}),
			{ numRuns: 100 },
		);
	});

	it("toString returns name@version.current", () => {
		fc.assert(
			fc.property(arbWorkspace, (ws) => {
				expect(ws.toString()).toBe(`${ws.name}@${ws.version.current}`);
			}),
			{ numRuns: 100 },
		);
	});

	it("publishableWorkspaces only contains publishable workspaces", () => {
		fc.assert(
			fc.property(arbAnalysis, (analysis) => {
				for (const ws of analysis.publishableWorkspaces) {
					expect(ws.publishable).toBe(true);
				}
			}),
			{ numRuns: 50 },
		);
	});

	it("releasableWorkspaces only contains released workspaces", () => {
		fc.assert(
			fc.property(arbAnalysis, (analysis) => {
				for (const ws of analysis.releasableWorkspaces) {
					expect(ws.released).toBe(true);
				}
			}),
			{ numRuns: 50 },
		);
	});

	it("findWorkspace returns Some iff name exists in workspaces", () => {
		fc.assert(
			fc.property(arbAnalysis, (analysis) => {
				for (const ws of analysis.workspaces) {
					expect(Option.isSome(analysis.findWorkspace(ws.name))).toBe(true);
				}
				expect(Option.isNone(analysis.findWorkspace("__nonexistent__"))).toBe(true);
			}),
			{ numRuns: 50 },
		);
	});

	it("AnalyzedWorkspace.publishable static filters correctly", () => {
		fc.assert(
			fc.property(arbAnalysis, (analysis) => {
				const filtered = AnalyzedWorkspace.publishable(analysis.workspaces);
				expect(filtered.length).toBe(analysis.publishableWorkspaces.length);
				for (const ws of filtered) {
					expect(ws.publishable).toBe(true);
				}
			}),
			{ numRuns: 50 },
		);
	});
});
