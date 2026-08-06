import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { Git } from "@effected/git";
import { Effect, Layer } from "effect";
import { REPOS_DIR } from "../../src/repos/constants.js";
import type { ReposManifestFile } from "../../src/repos/schemas/manifest.js";
import { ReposConfigStore } from "../../src/repos/services/config-store.js";
import { ReposDrift } from "../../src/repos/services/drift.js";

const NAME = "spec";
const URL = "https://example.com/spec.git";
const EXPECTED_PATH = `${REPOS_DIR}/${NAME}`;

/** One healthy manifest entry: url/ref/purpose matching the healthy `.gitmodules` fixture below. */
function healthyManifest(): ReposManifestFile {
	return { repos: { [NAME]: { url: URL, ref: "1.0.0", purpose: "spec authority" } } };
}

/** The `.gitmodules` text a real `git submodule add` + shallow-flag write would leave behind for a healthy entry. */
function healthyGitmodulesText(): string {
	return `[submodule "${EXPECTED_PATH}"]\n\tpath = ${EXPECTED_PATH}\n\turl = ${URL}\n\tshallow = true\n`;
}

/** Materializes a non-empty worktree directory at `.repos/<name>` (or a custom relative path) so `isPresent` reports true. */
function makeWorktree(root: string, relPath: string = EXPECTED_PATH): void {
	const dir = join(root, relPath);
	mkdirSync(dir, { recursive: true });
	writeFileSync(join(dir, "marker.txt"), "present\n");
}

type SubmoduleStatusState = "current" | "uninitialized" | "outOfSync" | "conflict";

/** A single-entry `git submodule status` stub result for `.repos/<name>`, defaulting to `current`. */
function statusEntry(path: string = EXPECTED_PATH, state: SubmoduleStatusState = "current") {
	return { state, sha: "0000000000000000000000000000000000000000", path };
}

const createdRoots: string[] = [];

function makeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "repos-drift-"));
	createdRoots.push(root);
	return root;
}

afterEach(() => {
	for (const root of createdRoots.splice(0)) {
		rmSync(root, { recursive: true, force: true });
	}
});

/**
 * Builds the layer stack `ReposDrift.check` needs, stubbing the manifest and
 * git-submodule-status authorities and running `FileSystem`/`Path` for real
 * so `.gitmodules` text and worktree presence are read off the tmp fixture.
 */
function driftLayer(manifest: ReposManifestFile, statuses: ReadonlyArray<ReturnType<typeof statusEntry>>) {
	const configStoreStub = Layer.succeed(ReposConfigStore, {
		exists: () => Effect.succeed(true),
		read: () => Effect.succeed(manifest),
		write: () => Effect.die("not stubbed"),
		update: () => Effect.die("not stubbed"),
	} as never);

	const gitStub = Layer.succeed(Git, { submoduleStatus: () => Effect.succeed(statuses) } as never);

	return ReposDrift.layer.pipe(
		Layer.provide(configStoreStub),
		Layer.provide(gitStub),
		Layer.provide(NodeServices.layer),
	);
}

describe("ReposDrift.check", () => {
	it.effect("reports clean: true, drifts: [] for a fully healthy vendored entry", () =>
		Effect.gen(function* () {
			const root = makeRoot();
			writeFileSync(join(root, ".gitmodules"), healthyGitmodulesText());
			makeWorktree(root);

			const report = yield* Effect.gen(function* () {
				const drift = yield* ReposDrift;
				return yield* drift.check(root);
			}).pipe(Effect.provide(driftLayer(healthyManifest(), [statusEntry()])));

			expect(report.clean).toBe(true);
			expect(report.drifts).toEqual([]);
		}),
	);

	it.effect("reports urlMismatch when the manifest url diverges from .gitmodules", () =>
		Effect.gen(function* () {
			const root = makeRoot();
			writeFileSync(join(root, ".gitmodules"), healthyGitmodulesText());
			makeWorktree(root);

			const manifest: ReposManifestFile = {
				repos: { [NAME]: { url: "https://example.com/spec-new.git", ref: "1.0.0", purpose: "spec authority" } },
			};

			const report = yield* Effect.gen(function* () {
				const drift = yield* ReposDrift;
				return yield* drift.check(root);
			}).pipe(Effect.provide(driftLayer(manifest, [statusEntry()])));

			expect(report.clean).toBe(false);
			expect(report.drifts).toEqual([
				expect.objectContaining({
					name: NAME,
					kind: "urlMismatch",
					manifestValue: "https://example.com/spec-new.git",
					observedValue: URL,
				}),
			]);
		}),
	);

	it.effect("reports pathMismatch when .gitmodules records a path diverging from the .repos/<name> convention", () =>
		Effect.gen(function* () {
			const root = makeRoot();
			const observedPath = `${REPOS_DIR}/${NAME}-old`;
			writeFileSync(
				join(root, ".gitmodules"),
				`[submodule "${EXPECTED_PATH}"]\n\tpath = ${observedPath}\n\turl = ${URL}\n\tshallow = true\n`,
			);
			makeWorktree(root, observedPath);

			const report = yield* Effect.gen(function* () {
				const drift = yield* ReposDrift;
				return yield* drift.check(root);
			}).pipe(Effect.provide(driftLayer(healthyManifest(), [statusEntry(observedPath)])));

			expect(report.clean).toBe(false);
			expect(report.drifts).toEqual([
				expect.objectContaining({
					name: NAME,
					kind: "pathMismatch",
					manifestValue: EXPECTED_PATH,
					observedValue: observedPath,
				}),
			]);
		}),
	);

	it.effect(
		"pairs by path when the section name diverges from the manifest entry name, reporting pathMismatch AND still detecting urlMismatch through the fallback pair",
		() =>
			Effect.gen(function* () {
				const root = makeRoot();
				// The real-world case this fallback exists for: the manifest entry
				// is named "effect" (`expectedPath` = ".repos/effect"), but the
				// `.gitmodules` section carries an older name
				// ("effect-smol") whose `path` field was updated to
				// ".repos/effect" without renaming the section itself. A
				// name-only pairing would degrade this to an
				// unregisteredManifestEntry/orphanGitmodulesEntry pair and hide the
				// url divergence asserted below.
				const divergentSectionName = `${REPOS_DIR}/effect-smol`;
				const staleUrl = "https://example.com/effect-smol.git";
				writeFileSync(
					join(root, ".gitmodules"),
					`[submodule "${divergentSectionName}"]\n\tpath = ${EXPECTED_PATH}\n\turl = ${staleUrl}\n\tshallow = true\n`,
				);
				makeWorktree(root);

				const report = yield* Effect.gen(function* () {
					const drift = yield* ReposDrift;
					return yield* drift.check(root);
				}).pipe(Effect.provide(driftLayer(healthyManifest(), [statusEntry()])));

				expect(report.clean).toBe(false);
				expect(report.drifts).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							name: NAME,
							kind: "pathMismatch",
							manifestValue: NAME,
							observedValue: divergentSectionName,
						}),
						expect.objectContaining({
							name: NAME,
							kind: "urlMismatch",
							manifestValue: URL,
							observedValue: staleUrl,
						}),
					]),
				);
				// Exactly these two drifts -- a duplicate-paired section (claimed by both a
				// name and a path match) would append extras past this count.
				expect(report.drifts).toHaveLength(2);
				// Both pairings hit -- no unregistered/orphan pair should appear for this entry/section.
				expect(report.drifts.some((d) => d.kind === "unregisteredManifestEntry")).toBe(false);
				expect(report.drifts.some((d) => d.kind === "orphanGitmodulesEntry")).toBe(false);
			}),
	);

	it.effect("reports unregisteredManifestEntry when the manifest names an entry with no .gitmodules section", () =>
		Effect.gen(function* () {
			const root = makeRoot();
			// A present-but-empty `.gitmodules` -- parses cleanly to zero sections,
			// isolating the "manifest entry, no section" branch from the
			// "file absent" branch (same drift kind, different code path).
			writeFileSync(join(root, ".gitmodules"), "");

			const manifest: ReposManifestFile = {
				repos: { orphan: { url: "https://example.com/orphan.git", ref: "1.0.0", purpose: "never registered" } },
			};

			const report = yield* Effect.gen(function* () {
				const drift = yield* ReposDrift;
				return yield* drift.check(root);
			}).pipe(Effect.provide(driftLayer(manifest, [])));

			expect(report.clean).toBe(false);
			expect(report.drifts).toEqual([
				expect.objectContaining({
					name: "orphan",
					kind: "unregisteredManifestEntry",
					manifestValue: "https://example.com/orphan.git",
				}),
			]);
		}),
	);

	it.effect("reports orphanGitmodulesEntry for a .gitmodules section with no manifest entry", () =>
		Effect.gen(function* () {
			const root = makeRoot();
			const ghostPath = `${REPOS_DIR}/ghost`;
			writeFileSync(
				join(root, ".gitmodules"),
				`[submodule "${ghostPath}"]\n\tpath = ${ghostPath}\n\turl = https://example.com/ghost.git\n`,
			);

			const report = yield* Effect.gen(function* () {
				const drift = yield* ReposDrift;
				return yield* drift.check(root);
			}).pipe(Effect.provide(driftLayer({ repos: {} }, [])));

			expect(report.clean).toBe(false);
			expect(report.drifts).toEqual([
				expect.objectContaining({ name: ghostPath, kind: "orphanGitmodulesEntry", observedValue: ghostPath }),
			]);
		}),
	);

	it.effect("reports missingWorktree when the worktree is absent and submoduleStatus reports uninitialized", () =>
		Effect.gen(function* () {
			const root = makeRoot();
			writeFileSync(join(root, ".gitmodules"), healthyGitmodulesText());
			// Deliberately no `makeWorktree` -- the worktree directory never existed.

			const report = yield* Effect.gen(function* () {
				const drift = yield* ReposDrift;
				return yield* drift.check(root);
			}).pipe(Effect.provide(driftLayer(healthyManifest(), [statusEntry(EXPECTED_PATH, "uninitialized")])));

			expect(report.clean).toBe(false);
			expect(report.drifts).toEqual([expect.objectContaining({ name: NAME, kind: "missingWorktree" })]);
		}),
	);

	it.effect("reports checkoutDiverged when submoduleStatus reports outOfSync", () =>
		Effect.gen(function* () {
			const root = makeRoot();
			writeFileSync(join(root, ".gitmodules"), healthyGitmodulesText());
			makeWorktree(root);

			const report = yield* Effect.gen(function* () {
				const drift = yield* ReposDrift;
				return yield* drift.check(root);
			}).pipe(Effect.provide(driftLayer(healthyManifest(), [statusEntry(EXPECTED_PATH, "outOfSync")])));

			expect(report.clean).toBe(false);
			expect(report.drifts).toEqual([expect.objectContaining({ name: NAME, kind: "checkoutDiverged" })]);
		}),
	);

	it.effect("reports checkoutDiverged when submoduleStatus reports an unresolved conflict", () =>
		Effect.gen(function* () {
			const root = makeRoot();
			writeFileSync(join(root, ".gitmodules"), healthyGitmodulesText());
			makeWorktree(root);

			const report = yield* Effect.gen(function* () {
				const drift = yield* ReposDrift;
				return yield* drift.check(root);
			}).pipe(Effect.provide(driftLayer(healthyManifest(), [statusEntry(EXPECTED_PATH, "conflict")])));

			expect(report.clean).toBe(false);
			expect(report.drifts).toEqual([expect.objectContaining({ name: NAME, kind: "checkoutDiverged" })]);
			expect(report.drifts).toHaveLength(1);
		}),
	);

	it.effect("reports missingShallow when .gitmodules omits submodule.<name>.shallow", () =>
		Effect.gen(function* () {
			const root = makeRoot();
			writeFileSync(
				join(root, ".gitmodules"),
				`[submodule "${EXPECTED_PATH}"]\n\tpath = ${EXPECTED_PATH}\n\turl = ${URL}\n`,
			);
			makeWorktree(root);

			const report = yield* Effect.gen(function* () {
				const drift = yield* ReposDrift;
				return yield* drift.check(root);
			}).pipe(Effect.provide(driftLayer(healthyManifest(), [statusEntry()])));

			expect(report.clean).toBe(false);
			expect(report.drifts).toEqual([
				expect.objectContaining({ name: NAME, kind: "missingShallow", observedValue: "unset" }),
			]);
		}),
	);

	it.effect(
		"reports one gitmodulesUnparsable drift, never calling git.submoduleStatus, on invalid .gitmodules text",
		() =>
			Effect.gen(function* () {
				const root = makeRoot();
				// Unterminated section header -- `GitConfig.parseResult` fails typed.
				writeFileSync(join(root, ".gitmodules"), `[submodule "${EXPECTED_PATH}"`);

				const configStoreStub = Layer.succeed(ReposConfigStore, {
					exists: () => Effect.succeed(true),
					read: () => Effect.succeed(healthyManifest()),
					write: () => Effect.die("not stubbed"),
					update: () => Effect.die("not stubbed"),
				} as never);
				const gitStub = Layer.succeed(Git, {
					submoduleStatus: () => Effect.die("submoduleStatus must not be called on an unparsable .gitmodules"),
				} as never);
				const layer = ReposDrift.layer.pipe(
					Layer.provide(configStoreStub),
					Layer.provide(gitStub),
					Layer.provide(NodeServices.layer),
				);

				const report = yield* Effect.gen(function* () {
					const drift = yield* ReposDrift;
					return yield* drift.check(root);
				}).pipe(Effect.provide(layer));

				expect(report.clean).toBe(false);
				expect(report.drifts).toEqual([expect.objectContaining({ name: ".gitmodules", kind: "gitmodulesUnparsable" })]);
			}),
	);
});
