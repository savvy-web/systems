import { NodeContext } from "@effect/platform-node";
import { Effect, Layer, LogLevel, Logger } from "effect";
import { describe, expect, it } from "vitest";
import { WorkspaceDiscovery, WorkspaceDiscoveryLive, WorkspaceRootLive } from "workspaces-effect";
import { detectScopes } from "../../../src/commitlint/detection/scopes.js";

/** Test layer with real workspace services for integration tests, with logs silenced. */
const TestLayer = WorkspaceDiscoveryLive.pipe(
	Layer.provideMerge(WorkspaceRootLive),
	Layer.provideMerge(NodeContext.layer),
	Layer.provide(Logger.minimumLogLevel(LogLevel.None)),
);

/** Stub layer that returns empty packages. */
const EmptyLayer = Layer.succeed(
	WorkspaceDiscovery,
	WorkspaceDiscovery.of({
		listPackages: () => Effect.succeed([]),
		getPackage: () => Effect.die("not implemented"),
		importerMap: () => Effect.succeed(new Map()),
		refresh: () => Effect.void,
	}),
);

describe("detectScopes", () => {
	it("returns an array of scopes for the current repository", async () => {
		const scopes = await Effect.runPromise(Effect.provide(detectScopes, TestLayer));
		expect(Array.isArray(scopes)).toBe(true);
	});

	it("returns scopes sorted alphabetically", async () => {
		const scopes = await Effect.runPromise(Effect.provide(detectScopes, TestLayer));
		const sorted = [...scopes].sort();
		expect(scopes).toEqual(sorted);
	});

	it("returns empty array when no workspace packages exist", async () => {
		const scopes = await Effect.runPromise(Effect.provide(detectScopes, EmptyLayer));
		expect(scopes).toEqual([]);
	});

	it("strips scope prefix from scoped package names", async () => {
		const scopes = await Effect.runPromise(Effect.provide(detectScopes, TestLayer));
		for (const scope of scopes) {
			expect(scope).not.toMatch(/^@/);
		}
	});
});
