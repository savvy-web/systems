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

	it.effect(
		"contention arbitration is order-independent: an exact-name match always wins the section, regardless of manifest key order",
		() =>
			Effect.gen(function* () {
				// The half-finished-rename shape this detector exists for: ONE
				// .gitmodules section named ".repos/A" but whose `path` field reads
				// ".repos/B". Two manifest entries compete for it -- "A" (the
				// section's rightful, exact-name owner) and "B" (which can only ever
				// reach it via the path fallback). A single-pass, one-entry-at-a-
				// time arbitration flips outcomes on `Object.entries` iteration
				// order: A-first correctly pairs A by name and leaves B unregistered;
				// B-first lets B steal the section via the path fallback BEFORE A
				// ever gets a chance to claim it by name, so A is wrongly reported
				// unregistered despite its exact-name section existing. Both orders
				// below must produce the IDENTICAL result: A paired (no drift beyond
				// what the fixture itself introduces), B unregistered.
				const root = makeRoot();
				const pathA = `${REPOS_DIR}/A`;
				const pathB = `${REPOS_DIR}/B`;
				writeFileSync(
					join(root, ".gitmodules"),
					`[submodule "${pathA}"]\n\tpath = ${pathB}\n\turl = https://example.com/a.git\n\tshallow = true\n`,
				);
				makeWorktree(root, pathB);

				const entryA = { url: "https://example.com/a.git", ref: "1.0.0", purpose: "a" };
				const entryB = { url: "https://example.com/b.git", ref: "1.0.0", purpose: "b" };

				const manifestAFirst: ReposManifestFile = { repos: { A: entryA, B: entryB } };
				const manifestBFirst: ReposManifestFile = { repos: { B: entryB, A: entryA } };

				const reportAFirst = yield* Effect.gen(function* () {
					const drift = yield* ReposDrift;
					return yield* drift.check(root);
				}).pipe(Effect.provide(driftLayer(manifestAFirst, [statusEntry(pathB)])));

				const reportBFirst = yield* Effect.gen(function* () {
					const drift = yield* ReposDrift;
					return yield* drift.check(root);
				}).pipe(Effect.provide(driftLayer(manifestBFirst, [statusEntry(pathB)])));

				for (const report of [reportAFirst, reportBFirst]) {
					expect(report.drifts.some((d) => d.name === "B" && d.kind === "unregisteredManifestEntry")).toBe(true);
					expect(report.drifts.some((d) => d.name === "A" && d.kind === "unregisteredManifestEntry")).toBe(false);
					// A is paired by name to a section whose `path` diverges from A's
					// own expected path -- that's a genuine pathMismatch for A (the
					// plain "expects path X but records Y" phrasing, not the "paired by
					// path" fallback phrasing, since A won by NAME).
					expect(
						report.drifts.some((d) => d.name === "A" && d.kind === "pathMismatch" && d.observedValue === pathB),
					).toBe(true);
				}

				// The two orders produce the identical drift set (same kinds/names),
				// not merely "B is unregistered in both" -- sort by name+kind since
				// object key order can otherwise still perturb array order.
				const normalize = (report: typeof reportAFirst) =>
					report.drifts
						.map((d) => `${d.name}:${d.kind}`)
						.slice()
						.sort();
				expect(normalize(reportAFirst)).toEqual(normalize(reportBFirst));
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

	it.effect("reports every manifest entry as unregisteredManifestEntry when .gitmodules itself is absent", () =>
		Effect.gen(function* () {
			const root = makeRoot();
			// No `.gitmodules` written at all -- this is the "absent .gitmodules
			// entirely" branch (drift.ts's `Option.isNone(gitmodulesText)` early
			// return), distinct from the "present but empty" branch the sibling
			// test above isolates. Two manifest entries prove EVERY entry is
			// reported, not just the first.
			const manifest: ReposManifestFile = {
				repos: {
					first: { url: "https://example.com/first.git", ref: "1.0.0", purpose: "first" },
					second: { url: "https://example.com/second.git", ref: "1.0.0", purpose: "second" },
				},
			};

			const report = yield* Effect.gen(function* () {
				const drift = yield* ReposDrift;
				return yield* drift.check(root);
			}).pipe(Effect.provide(driftLayer(manifest, [])));

			expect(report.clean).toBe(false);
			expect(report.drifts).toHaveLength(2);
			expect(report.drifts.every((d) => d.kind === "unregisteredManifestEntry")).toBe(true);
			expect(report.drifts.map((d) => d.name).sort()).toEqual(["first", "second"]);
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
