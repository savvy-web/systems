import { AnalyzedWorkspace, WorkspaceAnalysis } from "@savvy-web/silk-effects";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { WorkspaceInfoAsMarkdown, WorkspaceInfoResult, toWorkspaceInfoResult } from "../../src/tools/workspace-info.js";

const fooWorkspace = AnalyzedWorkspace.make({
	name: "@scope/foo",
	version: { current: "1.2.3" },
	path: "/repo/packages/foo",
	root: false,
	publishConfig: null,
	publishable: true,
	targets: [],
	versioned: true,
	tagged: false,
	released: false,
	linked: [],
	fixed: [],
});

const analysis = WorkspaceAnalysis.make({
	root: "/repo",
	runtime: "node",
	packageManager: { type: "pnpm", version: "10.0.0" },
	workspaces: [fooWorkspace],
	changesetConfig: null,
	versioning: null,
	tagStrategy: null,
});

describe("toWorkspaceInfoResult", () => {
	it("projects WorkspaceAnalysis to the flat, non-recursive tool result", () => {
		const result = toWorkspaceInfoResult(analysis);
		expect(result.root).toBe("/repo");
		expect(result.runtime).toBe("node");
		expect(result.packageManager).toEqual({ type: "pnpm", version: "10.0.0" });
		expect(result.workspaceCount).toBe(1);
		expect(result.workspaces[0]).toMatchObject({
			name: "@scope/foo",
			version: "1.2.3",
			publishable: true,
			linked: [],
			fixed: [],
		});
	});

	it("encodes to the output schema without error", () => {
		const result = toWorkspaceInfoResult(analysis);
		const encoded = Schema.encodeUnknownSync(WorkspaceInfoResult)(result);
		expect(encoded.root).toBe("/repo");
	});

	it("collapses recursive linked/fixed workspaces to name arrays", () => {
		const barWorkspace = AnalyzedWorkspace.make({
			name: "@scope/bar",
			version: { current: "4.5.6" },
			path: "/repo/packages/bar",
			root: false,
			publishConfig: null,
			publishable: true,
			targets: [],
			versioned: true,
			tagged: false,
			released: false,
			linked: [],
			fixed: [],
		});
		const relatedWorkspace = AnalyzedWorkspace.make({
			name: "@scope/related",
			version: { current: "1.0.0" },
			path: "/repo/packages/related",
			root: false,
			publishConfig: null,
			publishable: true,
			targets: [],
			versioned: true,
			tagged: false,
			released: false,
			linked: [barWorkspace],
			fixed: [barWorkspace],
		});
		const relatedAnalysis = WorkspaceAnalysis.make({
			root: "/repo",
			runtime: "node",
			packageManager: { type: "pnpm", version: "10.0.0" },
			workspaces: [relatedWorkspace],
			changesetConfig: null,
			versioning: null,
			tagStrategy: null,
		});
		const result = toWorkspaceInfoResult(relatedAnalysis);
		expect(result.workspaces[0].linked).toEqual(["@scope/bar"]);
		expect(result.workspaces[0].fixed).toEqual(["@scope/bar"]);
	});
});

describe("WorkspaceInfoAsMarkdown", () => {
	it("renders a one-way markdown transcript", () => {
		const result = toWorkspaceInfoResult(analysis);
		const md = Schema.decodeUnknownSync(WorkspaceInfoAsMarkdown)(result);
		expect(md).toContain("# Workspace");
		expect(md).toContain("@scope/foo");
		expect(md).toContain("pnpm");
	});

	it("forbids encoding markdown back to the structured result", () => {
		expect(() => Schema.encodeUnknownSync(WorkspaceInfoAsMarkdown)("anything")).toThrow();
	});
});
