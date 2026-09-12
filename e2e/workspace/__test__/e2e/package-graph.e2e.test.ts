import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

type DependencyField = "dependencies" | "devDependencies" | "peerDependencies";

interface Edge {
	readonly from: string;
	readonly to: string;
	readonly field: DependencyField;
}

interface LayersConfig {
	readonly layers: readonly (readonly string[])[];
	readonly tooling: readonly string[];
	readonly harness: readonly string[];
}

interface PackageManifest {
	readonly name: string;
	readonly dependencies?: Record<string, string>;
	readonly devDependencies?: Record<string, string>;
	readonly peerDependencies?: Record<string, string>;
}

type Classification =
	| { readonly kind: "app"; readonly layerIndex: number }
	| { readonly kind: "tooling" }
	| { readonly kind: "harness" }
	| { readonly kind: "unknown" };

const REPO_ROOT = resolve(import.meta.dirname, "../../../..");
const DEPENDENCY_FIELDS: readonly DependencyField[] = ["dependencies", "devDependencies", "peerDependencies"];

function readManifest(dir: string): PackageManifest {
	return JSON.parse(readFileSync(join(dir, "package.json"), "utf-8")) as PackageManifest;
}

// Reads every packages/* and e2e/* manifest directly off disk (rather than the
// declared layers.json) so the live workspace graph is what gets checked.
function discoverWorkspaceManifests(): PackageManifest[] {
	const manifests: PackageManifest[] = [];
	for (const group of ["packages", "e2e"]) {
		const groupDir = join(REPO_ROOT, group);
		for (const entry of readdirSync(groupDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			manifests.push(readManifest(join(groupDir, entry.name)));
		}
	}
	return manifests;
}

function extractWorkspaceEdges(manifests: readonly PackageManifest[]): Edge[] {
	const edges: Edge[] = [];
	for (const manifest of manifests) {
		for (const field of DEPENDENCY_FIELDS) {
			const deps = manifest[field];
			if (!deps) continue;
			for (const [depName, spec] of Object.entries(deps)) {
				if (spec.startsWith("workspace:")) {
					edges.push({ from: manifest.name, to: depName, field });
				}
			}
		}
	}
	return edges;
}

function classify(layers: LayersConfig, name: string): Classification {
	for (const [layerIndex, members] of layers.layers.entries()) {
		if (members.includes(name)) return { kind: "app", layerIndex };
	}
	if (layers.tooling.includes(name)) return { kind: "tooling" };
	if (name.startsWith("@e2e/")) return { kind: "harness" };
	return { kind: "unknown" };
}

// Rules (a)-(e) from the design doc: every app-layer package sits in exactly
// one layer, an edge out of layer i lands in layer j > i or in tooling, two
// packages in the same layer never reference each other, tooling never
// reaches into the app layers, and @e2e/* is unconstrained.
function findOffenders(layers: LayersConfig, edges: readonly Edge[]): string[] {
	const offenders: string[] = [];
	for (const edge of edges) {
		const from = classify(layers, edge.from);
		const to = classify(layers, edge.to);
		const label = `${edge.from} -> ${edge.to} (${edge.field})`;

		if (from.kind === "harness") continue;

		if (from.kind === "tooling") {
			if (to.kind === "app") offenders.push(label);
			continue;
		}

		if (from.kind === "app") {
			if (to.kind === "tooling") continue;
			if (to.kind === "app" && to.layerIndex > from.layerIndex) continue;
			offenders.push(label);
			continue;
		}

		// A workspace package that isn't classified anywhere in layers.json is
		// itself a layering violation waiting to happen.
		offenders.push(label);
	}
	return offenders;
}

// Standard three-color DFS cycle check; returns false the moment a back edge
// (a gray-to-gray traversal) proves the graph is not a DAG.
function topoSortSucceeds(nodes: readonly string[], edges: readonly Edge[]): boolean {
	const adjacency = new Map<string, string[]>();
	for (const node of nodes) adjacency.set(node, []);
	for (const edge of edges) {
		if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
		if (!adjacency.has(edge.to)) adjacency.set(edge.to, []);
		adjacency.get(edge.from)?.push(edge.to);
	}

	const WHITE = 0;
	const GRAY = 1;
	const BLACK = 2;
	const color = new Map<string, number>();
	for (const node of adjacency.keys()) color.set(node, WHITE);

	function visit(node: string): boolean {
		color.set(node, GRAY);
		for (const next of adjacency.get(node) ?? []) {
			const state = color.get(next) ?? WHITE;
			if (state === GRAY) return false;
			if (state === WHITE && !visit(next)) return false;
		}
		color.set(node, BLACK);
		return true;
	}

	for (const node of adjacency.keys()) {
		if (color.get(node) === WHITE && !visit(node)) return false;
	}
	return true;
}

describe("e2e: package graph respects the declared layering", () => {
	const layers = JSON.parse(readFileSync(join(REPO_ROOT, "e2e/workspace/layers.json"), "utf-8")) as LayersConfig;

	it("every app-layer package appears in exactly one layer", () => {
		const seen = new Map<string, number>();
		for (const members of layers.layers) {
			for (const name of members) seen.set(name, (seen.get(name) ?? 0) + 1);
		}
		const duplicates = [...seen.entries()].filter(([, count]) => count > 1).map(([name]) => name);
		expect(duplicates).toEqual([]);
	});

	it("the live workspace graph has no layering offenders", () => {
		const manifests = discoverWorkspaceManifests();
		const discoveredNames = new Set(manifests.map((manifest) => manifest.name));

		// Non-vacuity control (a): every name layers.json declares must actually
		// have been discovered on disk, or an empty/short-circuited discovery
		// would let the offenders assertion below pass for the wrong reason.
		const declaredNames = [...layers.layers.flat(), ...layers.tooling];
		const missingDeclaredNames = declaredNames.filter((name) => !discoveredNames.has(name));
		expect(missingDeclaredNames).toEqual([]);

		const edges = extractWorkspaceEdges(manifests);

		// Non-vacuity control (c): the edge extraction must have actually found
		// edges, or a broken glob/field-name typo would leave `edges` empty and
		// the offenders assertion below would pass vacuously.
		expect(edges.length, `expected to discover workspace:* edges, found ${edges.length}`).toBeGreaterThan(0);

		// Non-vacuity control (b): a handful of known load-bearing edges must be
		// present, so a discovery bug that drops real edges (but not all of
		// them) still fails loudly instead of slipping through control (c).
		const edgeLabels = new Set(edges.map((edge) => `${edge.from} -> ${edge.to} (${edge.field})`));
		const loadBearingEdges = [
			"@savvy-web/silk-effects -> @savvy-web/silk-core (dependencies)",
			"@savvy-web/cli -> @savvy-web/silk-effects (dependencies)",
			"@savvy-web/silk -> @savvy-web/cli (dependencies)",
		];
		const missingLoadBearingEdges = loadBearingEdges.filter((label) => !edgeLabels.has(label));
		expect(missingLoadBearingEdges).toEqual([]);

		expect(findOffenders(layers, edges)).toEqual([]);
	});

	it("a topological sort of the whole workspace graph succeeds", () => {
		const manifests = discoverWorkspaceManifests();
		const nodes = manifests.map((manifest) => manifest.name);
		const edges = extractWorkspaceEdges(manifests);
		expect(topoSortSucceeds(nodes, edges)).toBe(true);
	});

	it("flags exactly one offender for a hand-built sideways L3 edge", () => {
		// Positive control: a fixture graph, not the live workspace. L3 gets a
		// second fabricated member and one edge points sideways back at it.
		const fixtureLayers: LayersConfig = {
			layers: [["@fixture/l0"], ["@fixture/l1"], ["@fixture/l2"], ["@fixture/l3-a", "@fixture/l3-b"]],
			tooling: ["@fixture/tool"],
			harness: ["@e2e/*"],
		};
		const fixtureEdges: Edge[] = [
			{ from: "@fixture/l0", to: "@fixture/l1", field: "dependencies" },
			{ from: "@fixture/l1", to: "@fixture/l2", field: "dependencies" },
			{ from: "@fixture/l2", to: "@fixture/l3-a", field: "dependencies" },
			{ from: "@fixture/l3-a", to: "@fixture/tool", field: "devDependencies" },
			{ from: "@fixture/l3-b", to: "@fixture/l3-a", field: "dependencies" },
		];
		expect(findOffenders(fixtureLayers, fixtureEdges)).toEqual(["@fixture/l3-b -> @fixture/l3-a (dependencies)"]);
	});

	it("detects a cycle in a hand-built fixture graph", () => {
		// Second positive control: a fixture graph with a genuine cycle, not the
		// live workspace (which is asserted acyclic above).
		const fixtureNodes = ["@fixture/a", "@fixture/b", "@fixture/c"];
		const fixtureEdges: Edge[] = [
			{ from: "@fixture/a", to: "@fixture/b", field: "dependencies" },
			{ from: "@fixture/b", to: "@fixture/c", field: "dependencies" },
			{ from: "@fixture/c", to: "@fixture/a", field: "dependencies" },
		];
		expect(topoSortSucceeds(fixtureNodes, fixtureEdges)).toBe(false);
	});
});
