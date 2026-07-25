import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import type { WorkspaceDiscoveryShape } from "@effected/workspaces";
import { WorkspaceDiscovery, WorkspaceRoot } from "@effected/workspaces";
import { Effect, Layer, Option, References } from "effect";
import { detectScopes } from "../../../src/commitlint/detection/scopes.js";

/** Test layer with real workspace services for integration tests, with logs silenced. */
const TestLayer = WorkspaceDiscovery.layer().pipe(
	Layer.provide(WorkspaceRoot.layer),
	Layer.provide(NodeServices.layer),
	Layer.provide(Layer.succeed(References.MinimumLogLevel, "None")),
);

/** Stub layer that returns empty packages. */
const emptyDiscovery: WorkspaceDiscoveryShape = {
	info: () => Effect.die("not implemented"),
	listPackages: () => Effect.succeed([]),
	importerMap: () => Effect.succeed(new Map()),
	getPackage: () => Effect.die("not implemented"),
	resolveFile: () => Effect.succeed(Option.none()),
	resolveFiles: () => Effect.succeed([]),
	refresh: () => Effect.void,
};
const EmptyLayer = Layer.succeed(WorkspaceDiscovery, WorkspaceDiscovery.of(emptyDiscovery));

describe("detectScopes", () => {
	it.effect("returns an array of scopes for the current repository", () =>
		Effect.gen(function* () {
			const scopes = yield* Effect.provide(detectScopes, TestLayer);
			expect(Array.isArray(scopes)).toBe(true);
		}),
	);

	it.effect("returns scopes sorted alphabetically", () =>
		Effect.gen(function* () {
			const scopes = yield* Effect.provide(detectScopes, TestLayer);
			const sorted = [...scopes].sort();
			expect(scopes).toEqual(sorted);
		}),
	);

	it.effect("returns empty array when no workspace packages exist", () =>
		Effect.gen(function* () {
			const scopes = yield* Effect.provide(detectScopes, EmptyLayer);
			expect(scopes).toEqual([]);
		}),
	);

	it.effect("strips scope prefix from scoped package names", () =>
		Effect.gen(function* () {
			const scopes = yield* Effect.provide(detectScopes, TestLayer);
			for (const scope of scopes) {
				expect(scope).not.toMatch(/^@/);
			}
		}),
	);
});
