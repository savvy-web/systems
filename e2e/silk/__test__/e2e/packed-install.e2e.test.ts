/**
 * Proves the carrier pattern from OUTSIDE the workspace: a scratch project
 * whose only direct dependency is a packed `@savvy-web/silk` tarball ends up
 * with `node_modules/.bin/savvy` and `node_modules/.bin/savvy-mcp`, and both
 * run — under every package manager available (pnpm, npm, Yarn, bun), with no
 * hoisting help of any kind (no `publicHoistPattern`, no `.npmrc`, no pnpm
 * config dependency).
 *
 * @remarks
 * `PackedInstall.run` (`@effected/workspaces/testing`) does the packing and
 * installing: it packs silk and its runtime workspace closure, installs the
 * silk tarball into one scratch consumer per available manager, steers the
 * closure to its local tarballs through each manager's own override field,
 * and checks both bins are present and executable. The companions are
 * unpublished at the versions on this branch, which is what the overrides
 * are for; everything else (`effect`, the `@effected` kit, the peers) comes
 * from the registry, so these tests need the network and are slow. They live
 * in `@e2e/silk` so the root config serialises them.
 *
 * Packing is `packFrom: "source"`: `pnpm pack` in each SOURCE package dir,
 * which honours `publishConfig.directory` (the tarball IS `dist/dev/pkg`) and
 * rewrites `workspace:*` / `catalog:` to concrete ranges. The bundler's
 * `dist/dev/pkg` manifest keeps the protocol specifiers, so it cannot be
 * packed directly, and no `dist/prod` npm artifact exists at test time.
 *
 * The front ends declare the carrier's bin names too (`@savvy-web/cli` has
 * `savvy`, `@savvy-web/mcp` has `savvy-mcp`) — a deliberate choice, so the
 * run passes `allowSharedBins: true`. Under a flat layout (npm, bun) the
 * `.bin` slot may go to a front end's own bin, which carries no
 * `via @savvy-web/silk` suffix. So the test proves two things per manager:
 * what a user typing the bin name gets (`runBin`, with `binProvenance`
 * recording who owns the slot) and the carrier's own shim
 * (`runCarrierBin` / `carrierCommand`), which must name silk everywhere.
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, it } from "@effect/vitest";
import { McpProbe } from "@effected/mcp/testing";
import { Workspaces } from "@effected/workspaces";
import type { PackedInstallOptions } from "@effected/workspaces/testing";
import { PackedInstall } from "@effected/workspaces/testing";
import { Duration, Effect, FileSystem, Layer } from "effect";

/** Monorepo root, walked up from this harness package. */
const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..", "..");

const CARRIER = "@savvy-web/silk";

/** What `closure: "auto"` must plan: the carrier first, then its runtime workspace closure. */
const EXPECTED_CLOSURE = [
	"@savvy-web/changelog",
	"@savvy-web/cli",
	"@savvy-web/mcp",
	"@savvy-web/silk",
	"@savvy-web/silk-core",
	"@savvy-web/silk-effects",
];

/** The four packages silk declares as exact-pinned regular `dependencies`. */
const PINNED = ["@savvy-web/cli", "@savvy-web/mcp", "@savvy-web/changelog", "@savvy-web/silk-effects"] as const;

/** Which package may own each `.bin` slot: the carrier, or the front end that shares the name. */
const SLOT_OWNERS: Record<string, ReadonlyArray<string>> = {
	savvy: [CARRIER, "@savvy-web/cli"],
	"savvy-mcp": [CARRIER, "@savvy-web/mcp"],
};

const BIN_TIMEOUT = "30 seconds";

// PackedInstall is POSIX-only (it fails UnsupportedPlatform elsewhere).
const RUNNABLE = process.platform !== "win32";

const Live = Workspaces.layer({ cwd: REPO_ROOT }).pipe(Layer.provideMerge(NodeServices.layer));

/** ONE options object: `closure` plans with it, `run` installs with it. */
const RUN: PackedInstallOptions = {
	carrier: CARRIER,
	closure: "auto",
	packFrom: "source",
	managers: ["pnpm", "npm", "yarn", "bun"],
	bins: ["savvy", "savvy-mcp"],
	allowSharedBins: true,
	env: process.env,
	// A manager missing from PATH is skipped and logged, never a failure: CI
	// provisions pnpm and npm, not necessarily Yarn or bun.
	require: "any",
	installTimeout: "4 minutes",
	packTimeout: "1 minute",
};

// Module evaluation, before describe runs: vitest fixes a test's timeout when
// it is declared, so the closure is planned here with the run's own planner.
const PACKED = RUNNABLE
	? await Effect.runPromise(PackedInstall.closure(RUN.carrier, RUN).pipe(Effect.provide(Live)))
	: [];

// Each consumer: two runBins and two MCP probes, at BIN_TIMEOUT each, plus headroom.
const BUDGET = PackedInstall.timeoutBudget({
	managers: RUN.managers,
	installTimeout: RUN.installTimeout,
	packTimeout: RUN.packTimeout,
	packages: PACKED,
	perConsumer: "3 minutes",
});

/**
 * Layered over the install's scrubbed environment for every bin. The two
 * project-dir variables are removed so an agent session's own
 * `CLAUDE_PROJECT_DIR` cannot root the MCP server outside the consumer.
 */
const BIN_ENV = { NO_COLOR: "1", CLAUDE_PROJECT_DIR: undefined, SAVVY_MCP_PROJECT_DIR: undefined };

const readVersion = (dir: string): string =>
	(JSON.parse(readFileSync(join(REPO_ROOT, dir, "package.json"), "utf8")) as { version: string }).version;

/** Source versions: `pnpm pack` publishes each package at its source `version`. */
const SOURCE_VERSIONS: Record<(typeof PINNED)[number], string> = {
	"@savvy-web/cli": readVersion("packages/cli"),
	"@savvy-web/mcp": readVersion("packages/mcp"),
	"@savvy-web/changelog": readVersion("packages/changelog"),
	"@savvy-web/silk-effects": readVersion("packages/silk-effects"),
};
const SILK_VERSION = readVersion("packages/silk");

interface ServerInfo {
	readonly serverInfo: { readonly name: string; readonly version: string };
}

const CARRIER_SUFFIX = ` via @savvy-web/silk ${SILK_VERSION}`;

describe.skipIf(!RUNNABLE)("silk packed install outside the workspace", () => {
	it.effect(
		"packs the closure and runs both carrier bins under every available manager",
		() =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const result = yield* PackedInstall.run(RUN);
				if (result.unavailable.length > 0) {
					yield* Effect.logWarning(`packed-install: skipped unavailable managers: ${result.unavailable.join(", ")}`);
				}

				// The planned closure is exactly what the run packed, and it is the
				// carrier plus the five packages its exact pins reach.
				assert.deepStrictEqual(Object.keys(result.tarballs), [...PACKED]);
				assert.strictEqual(PACKED[0], CARRIER);
				assert.deepStrictEqual([...PACKED].sort(), EXPECTED_CLOSURE);
				assert.isAbove(result.consumers.length, 0);

				for (const consumer of result.consumers) {
					const pm = consumer.manager;

					// The consumer carries no hoisting configuration of any kind: the
					// only settings the kit writes are overrides and the manager pin.
					const entries = yield* fs.readDirectory(consumer.directory);
					assert.notInclude(entries, ".npmrc", `${pm}: no .npmrc`);
					const config: Array<string> = [];
					for (const file of ["package.json", "pnpm-workspace.yaml", ".yarnrc.yml"]) {
						if (entries.includes(file)) config.push(yield* fs.readFileString(join(consumer.directory, file)));
					}
					for (const forbidden of [
						"publicHoistPattern",
						"public-hoist-pattern",
						"hoistPattern",
						"configDependencies",
						"shamefully",
					]) {
						assert.notInclude(config.join("\n"), forbidden, `${pm}: no ${forbidden} in the consumer config`);
					}
					assert.isFalse(
						yield* fs.exists(join(consumer.directory, "node_modules", "@savvy-web", "pnpm-plugin-silk")),
						`${pm}: no pnpm-plugin-silk installed`,
					);

					// The installed carrier exact-pins its companions to the versions packed
					// beside it, and owns both bin names.
					const silk = JSON.parse(
						yield* fs.readFileString(join(consumer.directory, "node_modules", "@savvy-web", "silk", "package.json")),
					) as { readonly dependencies: Record<string, string>; readonly bin: unknown };
					for (const name of PINNED) {
						assert.strictEqual(silk.dependencies[name], SOURCE_VERSIONS[name], `${pm}: ${name} pin`);
					}
					assert.deepStrictEqual(silk.bin, { savvy: "bin/savvy.js", "savvy-mcp": "bin/savvy-mcp.js" });

					for (const bin of ["savvy", "savvy-mcp"]) {
						// Who owns the `.bin` slot. `undefined` is pnpm's shell shim; its
						// isolated layout links only the consumer's direct dependency.
						const provenance = yield* consumer.binProvenance(bin);
						if (provenance !== undefined) {
							assert.include(SLOT_OWNERS[bin], provenance.package, `${pm}: ${bin} slot owner`);
						}
						yield* Effect.logInfo(`packed-install: ${pm} ${bin} -> ${provenance?.package ?? "shim"}`);
					}

					// What a user typing `savvy` gets: some package's bin, exit 0.
					const typed = yield* consumer.runBin("savvy", ["--version"], { env: BIN_ENV, timeout: BIN_TIMEOUT });
					assert.strictEqual(typed.exitCode, 0, `${pm}: savvy --version\n${typed.stderr}`);
					assert.match(typed.stdout.trim(), /^savvy v\d+\.\d+\.\d+/, pm);

					// The carrier's own shim, whichever package took the slot.
					const own = yield* consumer.runCarrierBin("savvy", ["--version"], { env: BIN_ENV, timeout: BIN_TIMEOUT });
					assert.strictEqual(own.exitCode, 0, `${pm}: carrier savvy --version\n${own.stderr}`);
					assert.match(own.stdout.trim(), /^savvy v\d+\.\d+\.\d+ via @savvy-web\/silk \d+\.\d+\.\d+$/, pm);
					assert.isTrue(own.stdout.trim().endsWith(CARRIER_SUFFIX), `${pm}: ${own.stdout}`);

					// What a user's MCP client launching `savvy-mcp` gets.
					const typedMcp = yield* McpProbe.initialize(consumer.command("savvy-mcp", [], { env: BIN_ENV })).pipe(
						Effect.timeout(BIN_TIMEOUT),
					);
					assert.isUndefined(typedMcp.response.error, `${pm}: savvy-mcp initialize`);
					assert.strictEqual(typedMcp.stderr, "", `${pm}: savvy-mcp stderr`);
					assert.strictEqual(typedMcp.exitCode, 0, `${pm}: savvy-mcp exit code`);

					// The carrier's own MCP shim names silk as its distribution.
					const ownMcp = yield* McpProbe.initialize(
						yield* consumer.carrierCommand("savvy-mcp", [], { env: BIN_ENV }),
					).pipe(Effect.timeout(BIN_TIMEOUT));
					assert.isUndefined(ownMcp.response.error, `${pm}: carrier savvy-mcp initialize`);
					const info = ownMcp.response.result as ServerInfo;
					assert.strictEqual(info.serverInfo.name, "savvy-mcp");
					assert.match(info.serverInfo.version, /^\d+\.\d+\.\d+ via @savvy-web\/silk \d+\.\d+\.\d+$/, pm);
					assert.isTrue(info.serverInfo.version.endsWith(CARRIER_SUFFIX), `${pm}: ${info.serverInfo.version}`);
					assert.strictEqual(ownMcp.stderr, "", `${pm}: carrier savvy-mcp stderr`);
					assert.strictEqual(ownMcp.exitCode, 0, `${pm}: carrier savvy-mcp exit code`);
				}
			}).pipe(Effect.scoped, Effect.timeout(BUDGET), Effect.provide(Live)),
		// vitest's own guard a minute above the Effect's, so a named PackedInstallError fires first.
		Duration.toMillis(BUDGET) + 60_000,
	);
});
