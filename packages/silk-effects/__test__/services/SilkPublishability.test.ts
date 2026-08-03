import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { beforeEach, describe, expect, it } from "@effect/vitest";
import { PublishConfig, PublishabilityDetector, WorkspacePackage, WorkspaceRoot } from "@effected/workspaces";
import { Effect, Layer } from "effect";
import { ChangesetConfig } from "../../src/services/ChangesetConfig.js";
import { SilkPublishability } from "../../src/services/SilkPublishability.js";

const writePkg = (dir: string, content: unknown): void => {
	writeFileSync(join(dir, "package.json"), JSON.stringify(content), "utf-8");
};

/** Write a `dist/prod/targets.json` binding (the bundler's prod-build artifact). */
const writeBinding = (dir: string, binding: unknown): void => {
	const prod = join(dir, "dist", "prod");
	mkdirSync(prod, { recursive: true });
	writeFileSync(join(prod, "targets.json"), JSON.stringify(binding), "utf-8");
};

/** The canonical `npm: true, github: true` binding: one scoped-name group, two registry targets. */
const dualRegistryBinding = (name: string) => ({
	groups: [{ id: "npm", name, dir: "dist/prod/npm/pkg" }],
	targets: [
		{ id: "npm", group: "npm", name, registry: "https://registry.npmjs.org" },
		{ id: "github", group: "npm", name, registry: "https://npm.pkg.github.com" },
	],
});

const makeWsPkg = (
	dir: string,
	name = "test-pkg",
	opts: { private?: boolean; publishConfig?: ConstructorParameters<typeof PublishConfig>[0] } = {},
): WorkspacePackage =>
	new WorkspacePackage({
		name,
		version: "1.0.0",
		path: dir,
		packageJsonPath: join(dir, "package.json"),
		relativePath: ".",
		workspaceRoot: dir,
		private: opts.private ?? false,
		// Conditional spread: v4 constructors validate, and `publishConfig` is an
		// exact-optional key — never pass explicit undefined.
		...(opts.publishConfig ? { publishConfig: new PublishConfig(opts.publishConfig) } : {}),
	});

// This layer IS constant, so a suite-boundary `layer(...)` block would type-check — but it is
// deliberately left as a per-test provide. Every sibling helper in this file (`runAdaptive`,
// `runResolve`) genuinely varies per test, and a half-collapsed file would leave two different
// service lifetimes side by side for a marginal build saving. Keep the shapes uniform.
const runSilk = <A>(eff: Effect.Effect<A, never, PublishabilityDetector>): Effect.Effect<A> =>
	eff.pipe(Effect.provide(SilkPublishability.layer), Effect.provide(NodeServices.layer));

const mockChangesetConfig = (mode: "silk" | "vanilla" | "none", versionPrivate = false, ignore: string[] = []) =>
	Layer.succeed(ChangesetConfig, {
		mode: () => Effect.succeed(mode),
		versionPrivate: () => Effect.succeed(versionPrivate),
		ignorePatterns: () => Effect.succeed(ignore),
		isIgnored: (name: string) => Effect.succeed(ignore.some((p) => ChangesetConfig.matches(name, p))),
		fixed: () => Effect.succeed([]),
		refresh: () => Effect.void,
	});

// The adaptive detector resolves the changeset root per package via
// WorkspaceRoot (the kit detect contract lost its root param). The tmpdir
// fixtures carry no workspace markers, so stub find as a passthrough — the
// mocked ChangesetConfig ignores the root argument anyway.
const mockWorkspaceRoot = Layer.succeed(WorkspaceRoot, {
	find: (cwd: string) => Effect.succeed(cwd),
});

// Per-test provide is REQUIRED here: `mode`/`versionPrivate`/`ignore` are baked into the
// mocked ChangesetConfig, so the layer genuinely varies test by test.
const runAdaptive = <A>(
	eff: Effect.Effect<A, never, PublishabilityDetector>,
	mode: "silk" | "vanilla" | "none",
	versionPrivate = false,
	ignore: string[] = [],
): Effect.Effect<A> =>
	eff.pipe(
		Effect.provide(
			SilkPublishability.layerAdaptive.pipe(
				Layer.provide(Layer.merge(mockChangesetConfig(mode, versionPrivate, ignore), mockWorkspaceRoot)),
			),
		),
		Effect.provide(NodeServices.layer),
	);

// ──────────────────────────────────────────────────────────────────────────────
// SilkPublishability.layer — silk rules (reads from disk)
// ──────────────────────────────────────────────────────────────────────────────

describe("SilkPublishability.layer — silk rules", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "pub-"));
	});

	it.effect("private !== true, no targets → publishable (one default target)", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, { name: "x", version: "1.0.0" });
			const targets = yield* runSilk(Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"))));
			expect(targets.length).toBe(1);
		}),
	);

	it.effect("object-form targets + binding → one PublishTarget per resolved registry target", () =>
		Effect.gen(function* () {
			// The canonical bundler shape: `npm: true, github: true` collapse into one scoped-name
			// byte group deployed to two registries. The directory is the bound group's prod dir,
			// NOT the dev/link `directory` field.
			writePkg(tmpDir, {
				name: "@scope/x",
				version: "1.0.0",
				private: true,
				publishConfig: { access: "public", directory: "dist/dev/pkg", targets: { npm: true, github: true } },
			});
			writeBinding(tmpDir, dualRegistryBinding("@scope/x"));
			const targets = yield* runSilk(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"))),
			);
			expect(targets.length).toBe(2);
			expect(targets.every((t) => t.directory === "dist/prod/npm/pkg")).toBe(true);
			expect(targets.map((t) => t.registry)).toEqual(["https://registry.npmjs.org", "https://npm.pkg.github.com"]);
			expect(targets.every((t) => t.access === "public")).toBe(true);
			expect(targets.every((t) => t.name === "@scope/x")).toBe(true);
			// npm + GitHub Packages both opt into provenance — this is what gates the release
			// action's attestation step. A false here leaves the publish-summary Provenance column empty.
			expect(targets.every((t) => t.provenance === true)).toBe(true);
		}),
	);

	it.effect("object-form targets, no binding (pre-build) → one placeholder per declared key", () =>
		Effect.gen(function* () {
			// Before the prod build writes targets.json, publishability and the target COUNT must
			// still be correct (directory is best-effort and unused pre-build).
			writePkg(tmpDir, {
				name: "@scope/x",
				version: "1.0.0",
				private: true,
				publishConfig: { access: "public", directory: "dist/dev/pkg", targets: { npm: true, github: true } },
			});
			const targets = yield* runSilk(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"))),
			);
			expect(targets.length).toBe(2);
			expect(targets.map((t) => t.registry).sort()).toEqual([
				"https://npm.pkg.github.com",
				"https://registry.npmjs.org",
			]);
			// Provenance defaults must hold pre-build too, so Phase-2 validation reports it correctly.
			expect(targets.every((t) => t.provenance === true)).toBe(true);
		}),
	);

	it.effect("custom (non-npm/github) registry target → provenance defaults to false", () =>
		Effect.gen(function* () {
			// Only the npm public registry and GitHub Packages participate in npm-style
			// provenance; a custom registry target must not be marked provenance-ready.
			writePkg(tmpDir, {
				name: "@scope/x",
				version: "1.0.0",
				private: true,
				publishConfig: { access: "public", targets: { corp: { registry: "https://npm.corp.example.com" } } },
			});
			writeBinding(tmpDir, {
				groups: [{ id: "corp", name: "@scope/x", dir: "dist/prod/corp/pkg" }],
				targets: [{ id: "corp", group: "corp", name: "@scope/x", registry: "https://npm.corp.example.com" }],
			});
			const targets = yield* runSilk(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"))),
			);
			expect(targets.length).toBe(1);
			expect(targets[0].registry).toBe("https://npm.corp.example.com");
			expect(targets[0].provenance).toBe(false);
		}),
	);

	it.effect(
		"custom registry target, no binding (pre-build) → placeholder keeps the custom registry, provenance false",
		() =>
			Effect.gen(function* () {
				// The pre-build placeholder must read the object-form target's own registry, not fall back to
				// the npm default — otherwise a custom-registry target reports the wrong registry (and provenance)
				// before targets.json exists.
				writePkg(tmpDir, {
					name: "@scope/x",
					version: "1.0.0",
					private: true,
					publishConfig: { access: "public", targets: { corp: { registry: "https://npm.corp.example.com" } } },
				});
				const targets = yield* runSilk(
					Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"))),
				);
				expect(targets.length).toBe(1);
				expect(targets[0].registry).toBe("https://npm.corp.example.com");
				expect(targets[0].provenance).toBe(false);
			}),
	);

	it.effect(
		"a registry that only contains a well-known host as a substring does not opt into provenance (CWE-20 guard)",
		() =>
			Effect.gen(function* () {
				// A substring check would wrongly mark these provenance-capable; matching is by exact hostname.
				// A crafted URL with the well-known host in its path, or as a subdomain prefix, must stay false —
				// otherwise the provenance gate (which drives the release action's attestation) is bypassable.
				writePkg(tmpDir, {
					name: "@scope/x",
					version: "1.0.0",
					private: true,
					publishConfig: { access: "public", targets: { a: true, b: true } },
				});
				writeBinding(tmpDir, {
					groups: [
						{ id: "a", name: "@scope/x", dir: "dist/prod/a/pkg" },
						{ id: "b", name: "@scope/x", dir: "dist/prod/b/pkg" },
					],
					targets: [
						{ id: "a", group: "a", name: "@scope/x", registry: "https://evil.example/registry.npmjs.org" },
						{ id: "b", group: "b", name: "@scope/x", registry: "https://registry.npmjs.org.attacker.com" },
					],
				});
				const targets = yield* runSilk(
					Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"))),
				);
				expect(targets.length).toBe(2);
				expect(targets.every((t) => t.provenance === false)).toBe(true);
			}),
	);

	it.effect("object-form targets make a private package publishable (targets-first)", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, {
				name: "@scope/x",
				version: "1.0.0",
				private: true,
				publishConfig: { access: "public", targets: { npm: true } },
			});
			writeBinding(tmpDir, {
				groups: [{ id: "npm", name: "@scope/x", dir: "dist/prod/npm/pkg" }],
				targets: [{ id: "npm", group: "npm", name: "@scope/x", registry: "https://registry.npmjs.org" }],
			});
			const targets = yield* runSilk(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"))),
			);
			expect(targets.length).toBe(1);
			expect(targets[0].directory).toBe("dist/prod/npm/pkg");
		}),
	);

	it.effect("object-form targets without access → access defaults to public", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, {
				name: "@scope/x",
				version: "1.0.0",
				private: true,
				publishConfig: { targets: { npm: true } },
			});
			writeBinding(tmpDir, {
				groups: [{ id: "npm", name: "@scope/x", dir: "dist/prod/npm/pkg" }],
				targets: [{ id: "npm", group: "npm", name: "@scope/x", registry: "https://registry.npmjs.org" }],
			});
			const targets = yield* runSilk(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"))),
			);
			expect(targets.length).toBe(1);
			expect(targets[0].access).toBe("public");
		}),
	);

	it.effect("object-form targets inherit publishConfig.access (restricted)", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, {
				name: "@scope/x",
				version: "1.0.0",
				private: true,
				publishConfig: { access: "restricted", targets: { npm: true } },
			});
			writeBinding(tmpDir, {
				groups: [{ id: "npm", name: "@scope/x", dir: "dist/prod/npm/pkg" }],
				targets: [{ id: "npm", group: "npm", name: "@scope/x", registry: "https://registry.npmjs.org" }],
			});
			const targets = yield* runSilk(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"))),
			);
			expect(targets.length).toBe(1);
			expect(targets[0].access).toBe("restricted");
		}),
	);

	it.effect("empty targets map → falls through to the access branch", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, {
				name: "x",
				version: "1.0.0",
				private: true,
				publishConfig: { access: "public", directory: "dist/dev/pkg", targets: {} },
			});
			const targets = yield* runSilk(Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"))));
			expect(targets.length).toBe(1);
			expect(targets[0].directory).toBe("dist/dev/pkg");
		}),
	);

	it.effect("private === true + publishConfig.access public, no targets → publishable", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, { name: "x", version: "1.0.0", private: true, publishConfig: { access: "public" } });
			const targets = yield* runSilk(Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"))));
			expect(targets.length).toBe(1);
			expect(targets[0].access).toBe("public");
		}),
	);

	it.effect("private === true + no publishConfig → not publishable", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, { name: "x", version: "1.0.0", private: true });
			const targets = yield* runSilk(Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"))));
			expect(targets.length).toBe(0);
		}),
	);

	it.effect("private === true + publishConfig with no access and no targets → not publishable", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, { name: "x", version: "1.0.0", private: true, publishConfig: {} });
			const targets = yield* runSilk(Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"))));
			expect(targets.length).toBe(0);
		}),
	);

	it.effect("missing package.json → not publishable", () =>
		Effect.gen(function* () {
			// no writePkg call — tmpDir exists but no package.json
			const targets = yield* runSilk(Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"))));
			expect(targets.length).toBe(0);
		}),
	);

	it.effect("malformed package.json → not publishable", () =>
		Effect.gen(function* () {
			writeFileSync(join(tmpDir, "package.json"), "{ not valid json", "utf-8");
			const targets = yield* runSilk(Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"))));
			expect(targets.length).toBe(0);
		}),
	);

	it.effect("malformed targets.json → falls back to pre-build placeholders", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, {
				name: "@scope/x",
				version: "1.0.0",
				private: true,
				publishConfig: { access: "public", targets: { npm: true } },
			});
			mkdirSync(join(tmpDir, "dist", "prod"), { recursive: true });
			writeFileSync(join(tmpDir, "dist", "prod", "targets.json"), "{ not valid json", "utf-8");
			const targets = yield* runSilk(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"))),
			);
			expect(targets.length).toBe(1);
			expect(targets[0].directory).toBe("dist/prod/npm/pkg");
		}),
	);
});

// ──────────────────────────────────────────────────────────────────────────────
// SilkPublishability.layerAdaptive — vanilla mode (reads from WorkspacePackage fields)
// ──────────────────────────────────────────────────────────────────────────────

describe("SilkPublishability.layerAdaptive — vanilla mode", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "pub-"));
	});

	it.effect("private === true + no publishConfig.access → not publishable", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, { name: "x", version: "1.0.0", private: true });
			const targets = yield* runAdaptive(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x", { private: true }))),
				"vanilla",
			);
			expect(targets.length).toBe(0);
		}),
	);

	it.effect("private === true + publishConfig.access set → publishable", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, { name: "x", version: "1.0.0", private: true, publishConfig: { access: "public" } });
			// Pass publishConfig to the WorkspacePackage so the vanilla library can read it
			const targets = yield* runAdaptive(
				Effect.flatMap(PublishabilityDetector, (d) =>
					d.detect(makeWsPkg(tmpDir, "x", { private: true, publishConfig: { access: "public" } })),
				),
				"vanilla",
			);
			expect(targets.length).toBe(1);
		}),
	);

	it.effect("private !== true → publishable", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, { name: "x", version: "1.0.0" });
			const targets = yield* runAdaptive(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"))),
				"vanilla",
			);
			expect(targets.length).toBe(1);
		}),
	);
});

// ──────────────────────────────────────────────────────────────────────────────
// SilkPublishability.layerAdaptive — none mode
// ──────────────────────────────────────────────────────────────────────────────

describe("SilkPublishability.layerAdaptive — none mode", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "pub-"));
	});

	it.effect("none mode treats everything as not publishable regardless of package contents", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, { name: "x", version: "1.0.0" });
			const targets = yield* runAdaptive(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"))),
				"none",
			);
			expect(targets.length).toBe(0);
		}),
	);
});

// ──────────────────────────────────────────────────────────────────────────────
// SilkPublishability.layerAdaptive — silk mode dispatches to silk rules
// ──────────────────────────────────────────────────────────────────────────────

describe("SilkPublishability.layerAdaptive — silk mode dispatches to silk rules", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "pub-"));
	});

	it.effect("silk mode: private + object-form targets → publishable", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, {
				name: "@scope/x",
				version: "1.0.0",
				private: true,
				publishConfig: { access: "public", targets: { npm: true } },
			});
			const targets = yield* runAdaptive(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"))),
				"silk",
			);
			expect(targets.length).toBe(1);
		}),
	);

	it.effect("silk mode: private + no publishConfig → not publishable", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, { name: "x", version: "1.0.0", private: true });
			const targets = yield* runAdaptive(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"))),
				"silk",
			);
			expect(targets.length).toBe(0);
		}),
	);

	it.effect("silk mode: ignored package resolves to no targets despite publishConfig.targets", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, {
				name: "@libraries/x",
				version: "1.0.0",
				private: true,
				publishConfig: { access: "public", targets: { npm: true } },
			});
			const targets = yield* runAdaptive(
				Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@libraries/x"))),
				"silk",
				false,
				["@libraries/*"],
			);
			expect(targets.length).toBe(0);
		}),
	);
});

// ──────────────────────────────────────────────────────────────────────────────
// SilkPublishability.resolveTargets — prod-binding guard (issue #144, guard 2)
// ──────────────────────────────────────────────────────────────────────────────

describe("SilkPublishability.resolveTargets — prod-binding guard", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "pub-bind-"));
	});

	// Per-test provide: `pkg`/`root` are per-test tmpdir fixtures, so the effect under test is
	// rebuilt each time. Kept as an Exit so both the failure and success branches stay checkable.
	const runResolve = (pkg: WorkspacePackage, root: string) =>
		Effect.exit(
			SilkPublishability.resolveTargets(pkg, root).pipe(
				Effect.provide(SilkPublishability.layer),
				Effect.provide(NodeServices.layer),
			),
		);

	it.effect("fails when a prod binding exists but detection selected a directory outside it (#143 shape)", () =>
		Effect.gen(function* () {
			// The #143 failure: silk mode was misdetected, detection fell through to the
			// vanilla `publishConfig.directory` branch and selected the DEV build dir,
			// while the prod binding says the bytes live in dist/prod/npm/pkg. The dev
			// manifest still carried `catalog:` deps, so the published tarball was
			// uninstallable.
			writePkg(tmpDir, {
				name: "yaml-effect",
				version: "0.7.1",
				publishConfig: { access: "public", directory: "dist/dev/pkg" },
			});
			writeBinding(tmpDir, dualRegistryBinding("yaml-effect"));

			const exit = yield* runResolve(makeWsPkg(tmpDir, "yaml-effect"), tmpDir);

			expect(exit._tag).toBe("Failure");
			const rendered = JSON.stringify(exit);
			expect(rendered).toContain("dist/dev/pkg");
			expect(rendered).toContain("dist/prod/npm/pkg");
			expect(rendered).toContain("yaml-effect");
		}),
	);

	it.effect("succeeds when the detected directory is one of the binding's group dirs", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, {
				name: "yaml-effect",
				version: "0.7.1",
				publishConfig: { access: "public", targets: { npm: true, github: true } },
			});
			writeBinding(tmpDir, dualRegistryBinding("yaml-effect"));

			const exit = yield* runResolve(makeWsPkg(tmpDir, "yaml-effect"), tmpDir);

			expect(exit._tag).toBe("Success");
			if (exit._tag === "Success") {
				expect(exit.value).toHaveLength(2);
				for (const t of exit.value) expect(t.directory).toBe("dist/prod/npm/pkg");
			}
		}),
	);

	it.effect("matches a binding dir written with a ./ prefix and a trailing slash", () =>
		Effect.gen(function* () {
			// The binding is bundler-written but hand-editable, so compare on normalized
			// paths rather than raw strings.
			writePkg(tmpDir, {
				name: "yaml-effect",
				version: "0.7.1",
				publishConfig: { access: "public", targets: { npm: true, github: true } },
			});
			writeBinding(tmpDir, {
				groups: [{ id: "npm", name: "yaml-effect", dir: "./dist/prod/npm/pkg/" }],
				targets: [
					{ id: "npm", group: "npm", name: "yaml-effect", registry: "https://registry.npmjs.org" },
					{ id: "github", group: "npm", name: "yaml-effect", registry: "https://npm.pkg.github.com" },
				],
			});

			const exit = yield* runResolve(makeWsPkg(tmpDir, "yaml-effect"), tmpDir);

			expect(exit._tag).toBe("Success");
		}),
	);

	it.effect("normalizes a pathological run of slashes without quadratic backtracking", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, {
				name: "yaml-effect",
				version: "0.7.1",
				publishConfig: { access: "public", targets: { npm: true, github: true } },
			});
			writeBinding(tmpDir, {
				groups: [{ id: "npm", name: "yaml-effect", dir: `dist/prod/npm/pkg${"/".repeat(50_000)}` }],
				targets: [{ id: "npm", group: "npm", name: "yaml-effect", registry: "https://registry.npmjs.org" }],
			});

			const started = performance.now();
			const exit = yield* runResolve(makeWsPkg(tmpDir, "yaml-effect"), tmpDir);
			const elapsed = performance.now() - started;

			expect(exit._tag).toBe("Success");
			expect(elapsed).toBeLessThan(2_000);
		}),
	);

	it.effect("succeeds with no binding on disk (pre-build), leaving placeholders untouched", () =>
		Effect.gen(function* () {
			writePkg(tmpDir, {
				name: "pre-build",
				version: "1.0.0",
				publishConfig: { access: "public", directory: "dist/dev/pkg" },
			});

			const exit = yield* runResolve(makeWsPkg(tmpDir, "pre-build"), tmpDir);

			expect(exit._tag).toBe("Success");
		}),
	);
});
