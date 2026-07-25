/**
 * Tests for {@link listPublishablePackageNames}.
 *
 * The function delegates to whatever {@link PublishabilityDetector} layer is
 * provided: a package is "publishable" when the detector returns at least one
 * {@link PublishTarget} for it. A mock detector layer keyed off package name
 * drives the behavior so the test stays focused on the name-collection logic
 * (filtering, dedup-by-Set) without touching the filesystem.
 *
 * v4/kit note: `@effected/workspaces`' detector contract is
 * `detect(pkg)` — the project root is no longer threaded through (the
 * ignore/mode-aware adaptive detector resolves it per package via
 * `WorkspaceRoot`). The former "same root for every package" regression
 * guard is structurally unexpressable now; the per-package delegation is
 * asserted instead.
 */

import { describe, expect, it } from "@effect/vitest";
import type { PublishTarget, WorkspacePackage } from "@effected/workspaces";
import { PublishabilityDetector } from "@effected/workspaces";
import { Effect, Layer } from "effect";

import { listPublishablePackageNames } from "../../src/changesets/utils/publishability.js";

const PROJECT_ROOT = "/repo";

const pkg = (name: string): WorkspacePackage => ({ name, path: `/repo/${name}` }) as unknown as WorkspacePackage;

const target = (): PublishTarget =>
	({
		name: "npm",
		registry: "https://registry.npmjs.org/",
		directory: "dist",
		access: "public",
		provenance: false,
	}) as unknown as PublishTarget;

/**
 * Build a mock detector layer that returns one target for every package whose
 * name is in `publishable`, and an empty array otherwise. Every package it is
 * called with is pushed onto `packagesSeen`.
 */
const mockDetector = (
	publishable: ReadonlySet<string>,
	packagesSeen: string[] = [],
): Layer.Layer<PublishabilityDetector> =>
	Layer.succeed(PublishabilityDetector, {
		// `Effect.suspend` so the recorder fires when the effect RUNS, not when
		// `detect(p)` is merely called. The eager form would log a package whose
		// detect effect was constructed but never executed, which is exactly what
		// the "exactly once per package" assertion below exists to catch.
		detect: (p: WorkspacePackage) =>
			Effect.suspend(() => {
				packagesSeen.push(p.name);
				return Effect.succeed(publishable.has(p.name) ? [target()] : []);
			}),
	});

// The layer is built per call from `publishable`, so it varies per test and
// cannot move to a suite-boundary `layer(...)` — which also means the recorder
// cannot accumulate across tests and needs no `beforeEach` reset.
const provide = (
	packages: ReadonlyArray<WorkspacePackage>,
	publishable: ReadonlySet<string>,
	root: string = PROJECT_ROOT,
): Effect.Effect<ReadonlySet<string>> =>
	listPublishablePackageNames(packages, root).pipe(Effect.provide(mockDetector(publishable)));

describe("listPublishablePackageNames", () => {
	it.effect("returns only the names the detector reports as publishable", () =>
		Effect.gen(function* () {
			const packages = [pkg("@scope/foo"), pkg("@scope/bar"), pkg("root")];
			const result = yield* provide(packages, new Set(["@scope/foo", "@scope/bar"]));

			expect(result).toEqual(new Set(["@scope/foo", "@scope/bar"]));
			expect(result.has("root")).toBe(false);
		}),
	);

	it.effect("returns an empty set when no package is publishable", () =>
		Effect.gen(function* () {
			const packages = [pkg("@scope/foo"), pkg("root")];
			const result = yield* provide(packages, new Set());

			expect(result.size).toBe(0);
		}),
	);

	it.effect("returns an empty set for an empty package list", () =>
		Effect.gen(function* () {
			const result = yield* provide([], new Set(["@scope/foo"]));

			expect(result.size).toBe(0);
		}),
	);

	it.effect("includes every package when all are publishable", () =>
		Effect.gen(function* () {
			const packages = [pkg("@scope/a"), pkg("@scope/b")];
			const result = yield* provide(packages, new Set(["@scope/a", "@scope/b"]));

			expect(result).toEqual(new Set(["@scope/a", "@scope/b"]));
		}),
	);

	it.effect("consults the detector exactly once per package, in order", () =>
		Effect.gen(function* () {
			const packages = [pkg("@scope/a"), pkg("@scope/b")];
			const packagesSeen: string[] = [];
			yield* listPublishablePackageNames(packages, PROJECT_ROOT).pipe(
				Effect.provide(mockDetector(new Set(["@scope/a", "@scope/b"]), packagesSeen)),
			);

			expect(packagesSeen).toEqual(["@scope/a", "@scope/b"]);
		}),
	);
});
