import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { beforeEach, describe, expect, it } from "vitest";
import { PublishConfig, PublishabilityDetector, WorkspacePackage } from "workspaces-effect";
import { ChangesetConfig } from "../../src/services/ChangesetConfig.js";
import {
	PublishabilityDetectorAdaptiveLive,
	SilkPublishabilityDetectorLive,
} from "../../src/services/SilkPublishability.js";

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
		private: opts.private ?? false,
		publishConfig: opts.publishConfig ? new PublishConfig(opts.publishConfig) : undefined,
	});

const runSilk = <A>(eff: Effect.Effect<A, never, PublishabilityDetector>): Promise<A> =>
	Effect.runPromise(eff.pipe(Effect.provide(SilkPublishabilityDetectorLive), Effect.provide(NodeContext.layer)));

const mockChangesetConfig = (mode: "silk" | "vanilla" | "none", versionPrivate = false, ignore: string[] = []) =>
	Layer.succeed(ChangesetConfig, {
		mode: () => Effect.succeed(mode),
		versionPrivate: () => Effect.succeed(versionPrivate),
		ignorePatterns: () => Effect.succeed(ignore),
		isIgnored: (name: string) => Effect.succeed(ignore.some((p) => ChangesetConfig.matches(name, p))),
		fixed: () => Effect.succeed([]),
	});

const runAdaptive = <A>(
	eff: Effect.Effect<A, never, PublishabilityDetector>,
	mode: "silk" | "vanilla" | "none",
	versionPrivate = false,
	ignore: string[] = [],
): Promise<A> =>
	Effect.runPromise(
		eff.pipe(
			Effect.provide(
				PublishabilityDetectorAdaptiveLive.pipe(Layer.provide(mockChangesetConfig(mode, versionPrivate, ignore))),
			),
			Effect.provide(NodeContext.layer),
		),
	);

// ──────────────────────────────────────────────────────────────────────────────
// SilkPublishabilityDetectorLive — silk rules (reads from disk)
// ──────────────────────────────────────────────────────────────────────────────

describe("SilkPublishabilityDetectorLive — silk rules", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "pub-"));
	});

	it("private !== true, no targets → publishable (one default target)", async () => {
		writePkg(tmpDir, { name: "x", version: "1.0.0" });
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"), tmpDir)),
		);
		expect(targets.length).toBe(1);
	});

	it("object-form targets + binding → one PublishTarget per resolved registry target", async () => {
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
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"), tmpDir)),
		);
		expect(targets.length).toBe(2);
		expect(targets.every((t) => t.directory === "dist/prod/npm/pkg")).toBe(true);
		expect(targets.map((t) => t.registry)).toEqual(["https://registry.npmjs.org", "https://npm.pkg.github.com"]);
		expect(targets.every((t) => t.access === "public")).toBe(true);
		expect(targets.every((t) => t.name === "@scope/x")).toBe(true);
	});

	it("object-form targets, no binding (pre-build) → one placeholder per declared key", async () => {
		// Before the prod build writes targets.json, publishability and the target COUNT must
		// still be correct (directory is best-effort and unused pre-build).
		writePkg(tmpDir, {
			name: "@scope/x",
			version: "1.0.0",
			private: true,
			publishConfig: { access: "public", directory: "dist/dev/pkg", targets: { npm: true, github: true } },
		});
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"), tmpDir)),
		);
		expect(targets.length).toBe(2);
		expect(targets.map((t) => t.registry).sort()).toEqual(["https://npm.pkg.github.com", "https://registry.npmjs.org"]);
	});

	it("object-form targets make a private package publishable (targets-first)", async () => {
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
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"), tmpDir)),
		);
		expect(targets.length).toBe(1);
		expect(targets[0].directory).toBe("dist/prod/npm/pkg");
	});

	it("object-form targets without access → access defaults to public", async () => {
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
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"), tmpDir)),
		);
		expect(targets.length).toBe(1);
		expect(targets[0].access).toBe("public");
	});

	it("object-form targets inherit publishConfig.access (restricted)", async () => {
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
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"), tmpDir)),
		);
		expect(targets.length).toBe(1);
		expect(targets[0].access).toBe("restricted");
	});

	it("empty targets map → falls through to the access branch", async () => {
		writePkg(tmpDir, {
			name: "x",
			version: "1.0.0",
			private: true,
			publishConfig: { access: "public", directory: "dist/dev/pkg", targets: {} },
		});
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"), tmpDir)),
		);
		expect(targets.length).toBe(1);
		expect(targets[0].directory).toBe("dist/dev/pkg");
	});

	it("private === true + publishConfig.access public, no targets → publishable", async () => {
		writePkg(tmpDir, { name: "x", version: "1.0.0", private: true, publishConfig: { access: "public" } });
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"), tmpDir)),
		);
		expect(targets.length).toBe(1);
		expect(targets[0].access).toBe("public");
	});

	it("private === true + no publishConfig → not publishable", async () => {
		writePkg(tmpDir, { name: "x", version: "1.0.0", private: true });
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"), tmpDir)),
		);
		expect(targets.length).toBe(0);
	});

	it("private === true + publishConfig with no access and no targets → not publishable", async () => {
		writePkg(tmpDir, { name: "x", version: "1.0.0", private: true, publishConfig: {} });
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"), tmpDir)),
		);
		expect(targets.length).toBe(0);
	});

	it("missing package.json → not publishable", async () => {
		// no writePkg call — tmpDir exists but no package.json
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"), tmpDir)),
		);
		expect(targets.length).toBe(0);
	});

	it("malformed package.json → not publishable", async () => {
		writeFileSync(join(tmpDir, "package.json"), "{ not valid json", "utf-8");
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"), tmpDir)),
		);
		expect(targets.length).toBe(0);
	});

	it("malformed targets.json → falls back to pre-build placeholders", async () => {
		writePkg(tmpDir, {
			name: "@scope/x",
			version: "1.0.0",
			private: true,
			publishConfig: { access: "public", targets: { npm: true } },
		});
		mkdirSync(join(tmpDir, "dist", "prod"), { recursive: true });
		writeFileSync(join(tmpDir, "dist", "prod", "targets.json"), "{ not valid json", "utf-8");
		const targets = await runSilk(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"), tmpDir)),
		);
		expect(targets.length).toBe(1);
		expect(targets[0].directory).toBe("dist/prod/npm/pkg");
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// PublishabilityDetectorAdaptiveLive — vanilla mode (reads from WorkspacePackage fields)
// ──────────────────────────────────────────────────────────────────────────────

describe("PublishabilityDetectorAdaptiveLive — vanilla mode", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "pub-"));
	});

	it("private === true + no publishConfig.access → not publishable", async () => {
		writePkg(tmpDir, { name: "x", version: "1.0.0", private: true });
		const targets = await runAdaptive(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x", { private: true }), tmpDir)),
			"vanilla",
		);
		expect(targets.length).toBe(0);
	});

	it("private === true + publishConfig.access set → publishable", async () => {
		writePkg(tmpDir, { name: "x", version: "1.0.0", private: true, publishConfig: { access: "public" } });
		// Pass publishConfig to the WorkspacePackage so the vanilla library can read it
		const targets = await runAdaptive(
			Effect.flatMap(PublishabilityDetector, (d) =>
				d.detect(makeWsPkg(tmpDir, "x", { private: true, publishConfig: { access: "public" } }), tmpDir),
			),
			"vanilla",
		);
		expect(targets.length).toBe(1);
	});

	it("private !== true → publishable", async () => {
		writePkg(tmpDir, { name: "x", version: "1.0.0" });
		const targets = await runAdaptive(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"), tmpDir)),
			"vanilla",
		);
		expect(targets.length).toBe(1);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// PublishabilityDetectorAdaptiveLive — none mode
// ──────────────────────────────────────────────────────────────────────────────

describe("PublishabilityDetectorAdaptiveLive — none mode", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "pub-"));
	});

	it("none mode treats everything as not publishable regardless of package contents", async () => {
		writePkg(tmpDir, { name: "x", version: "1.0.0" });
		const targets = await runAdaptive(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"), tmpDir)),
			"none",
		);
		expect(targets.length).toBe(0);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// PublishabilityDetectorAdaptiveLive — silk mode dispatches to silk rules
// ──────────────────────────────────────────────────────────────────────────────

describe("PublishabilityDetectorAdaptiveLive — silk mode dispatches to silk rules", () => {
	let tmpDir: string;
	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "pub-"));
	});

	it("silk mode: private + object-form targets → publishable", async () => {
		writePkg(tmpDir, {
			name: "@scope/x",
			version: "1.0.0",
			private: true,
			publishConfig: { access: "public", targets: { npm: true } },
		});
		const targets = await runAdaptive(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@scope/x"), tmpDir)),
			"silk",
		);
		expect(targets.length).toBe(1);
	});

	it("silk mode: private + no publishConfig → not publishable", async () => {
		writePkg(tmpDir, { name: "x", version: "1.0.0", private: true });
		const targets = await runAdaptive(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "x"), tmpDir)),
			"silk",
		);
		expect(targets.length).toBe(0);
	});

	it("silk mode: ignored package resolves to no targets despite publishConfig.targets", async () => {
		writePkg(tmpDir, {
			name: "@libraries/x",
			version: "1.0.0",
			private: true,
			publishConfig: { access: "public", targets: { npm: true } },
		});
		const targets = await runAdaptive(
			Effect.flatMap(PublishabilityDetector, (d) => d.detect(makeWsPkg(tmpDir, "@libraries/x"), tmpDir)),
			"silk",
			false,
			["@libraries/*"],
		);
		expect(targets.length).toBe(0);
	});
});
