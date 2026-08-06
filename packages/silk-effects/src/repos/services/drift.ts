import { Git, Gitmodules } from "@effected/git";
import { Context, Effect, FileSystem, Layer, Option, Path, Result } from "effect";
import { REPOS_DIR } from "../constants.js";
import type { ReposConfigError } from "../errors.js";
import { GitSubmoduleError } from "../errors.js";
import { RepoDrift, ReposDriftReport } from "../schemas/drift.js";
import { ReposConfigStore } from "./config-store.js";

/**
 * The {@link ReposDrift} service shape.
 * @public
 */
export interface ReposDriftShape {
	readonly check: (root: string) => Effect.Effect<ReposDriftReport, ReposConfigError | GitSubmoduleError>;
}

/**
 * Reconciles the four authorities a vendored repo's state is spread across —
 * the manifest, `.gitmodules`, the worktree, and `git submodule status` —
 * and reports every disagreement found. Read-only: no staging, no lockdown
 * interaction, so it runs unmodified against a locked (`ReposLockdown`)
 * tree.
 * @public
 */
export class ReposDrift extends Context.Service<ReposDrift, ReposDriftShape>()("@savvy-web/silk-effects/ReposDrift") {
	/**
	 * Production implementation of {@link ReposDrift}.
	 * @public
	 */
	static readonly layer: Layer.Layer<ReposDrift, never, ReposConfigStore | Git | FileSystem.FileSystem | Path.Path> =
		Layer.effect(
			this,
			Effect.gen(function* () {
				const configStore = yield* ReposConfigStore;
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				const git = yield* Git;

				/** Map any typed `@effected/git` failure onto this module's `GitSubmoduleError`. */
				const asSubmoduleError =
					(command: string, cwd: string) =>
					(error: { readonly message: string }): GitSubmoduleError =>
						new GitSubmoduleError({ command, cwd, reason: error.message });

				const isPresent = (repoPath: string) =>
					fs.readDirectory(repoPath).pipe(
						Effect.map((files) => files.length > 0),
						Effect.orElseSucceed(() => false),
					);

				const check = (root: string) =>
					Effect.gen(function* () {
						const manifest = yield* configStore.read(root);
						const manifestEntries = Object.entries(manifest.repos);
						const gitmodulesPath = path.join(root, ".gitmodules");

						const gitmodulesText = yield* fs.readFileString(gitmodulesPath).pipe(Effect.option);

						// No `.gitmodules` at all: every manifest entry is unregistered —
						// there is nothing else to reconcile against.
						if (Option.isNone(gitmodulesText)) {
							const drifts = manifestEntries.map(([name, entry]) =>
								RepoDrift.make({
									name,
									kind: "unregisteredManifestEntry",
									detail: `manifest entry "${name}" has no corresponding .gitmodules section (.gitmodules is absent)`,
									manifestValue: entry.url,
								}),
							);
							return ReposDriftReport.make({ drifts, clean: drifts.length === 0 });
						}

						const parsed = Gitmodules.parseResult(gitmodulesText.value);
						if (Result.isFailure(parsed)) {
							// A parse failure blocks reconciliation entirely -- report it as
							// the sole drift rather than an error, and rather than guessing
							// at per-entry state from an undecodable document.
							return ReposDriftReport.make({
								drifts: [
									RepoDrift.make({
										name: ".gitmodules",
										kind: "gitmodulesUnparsable",
										detail: `.gitmodules failed to parse: ${parsed.failure.message}`,
									}),
								],
								clean: false,
							});
						}
						const gitmodules = parsed.success;

						const statuses = yield* git
							.submoduleStatus(root)
							.pipe(Effect.mapError(asSubmoduleError("git submodule status", root)));
						const statusByPath = new Map(statuses.map((status) => [status.path, status]));

						const drifts: RepoDrift[] = [];
						const matchedSectionNames = new Set<string>();

						for (const [name, entry] of manifestEntries) {
							const expectedPath = `${REPOS_DIR}/${name}`;

							// `git submodule add` derives the section's NAME (the
							// `[submodule "<name>"]` subsection) from its path at
							// creation time, so under normal use `section.name` already
							// equals `expectedPath` -- matching sections is done against
							// that canonical name, never the section's own `path` field,
							// because a differing `path` field is itself the
							// `pathMismatch` drift this loop needs to be able to report;
							// matching on `path` would hide it.
							const nameMatch = gitmodules.entries.find(
								(candidate) => candidate.name === expectedPath && !matchedSectionNames.has(candidate.name),
							);

							// Name-pairing failed: a diverged section name (e.g. a
							// manifest entry re-slugged after the `.gitmodules` section
							// was created under an older name) would otherwise degrade
							// straight to an unregistered/orphan pair and mask the
							// url/shallow comparisons below. Fall back to pairing by the
							// section's own `path` field -- the one other identifier that
							// still ties a section to this manifest entry -- as long as
							// that section hasn't already been claimed by a name match
							// for a different entry.
							const pathMatch = nameMatch
								? undefined
								: gitmodules.entries.find(
										(candidate) => candidate.path === expectedPath && !matchedSectionNames.has(candidate.name),
									);

							const section = nameMatch ?? pathMatch;
							if (!section) {
								drifts.push(
									RepoDrift.make({
										name,
										kind: "unregisteredManifestEntry",
										detail: `manifest entry "${name}" has no corresponding .gitmodules section`,
										manifestValue: entry.url,
									}),
								);
								continue;
							}
							matchedSectionNames.add(section.name);

							if (pathMatch) {
								drifts.push(
									RepoDrift.make({
										name,
										kind: "pathMismatch",
										detail: `manifest entry "${name}" paired with .gitmodules section "${pathMatch.name}" by its path "${expectedPath}" -- the section name diverges from the manifest entry name`,
										manifestValue: name,
										observedValue: pathMatch.name,
									}),
								);
							} else if (section.path !== expectedPath) {
								drifts.push(
									RepoDrift.make({
										name,
										kind: "pathMismatch",
										detail: `manifest entry "${name}" expects path "${expectedPath}" but .gitmodules records "${section.path}"`,
										manifestValue: expectedPath,
										observedValue: section.path,
									}),
								);
							}

							if (section.url !== entry.url) {
								drifts.push(
									RepoDrift.make({
										name,
										kind: "urlMismatch",
										detail: `manifest entry "${name}" expects url "${entry.url}" but .gitmodules records "${section.url}"`,
										manifestValue: entry.url,
										observedValue: section.url,
									}),
								);
							}

							if (section.shallow !== true) {
								drifts.push(
									RepoDrift.make({
										name,
										kind: "missingShallow",
										detail: `.gitmodules does not record submodule.${name}.shallow = true`,
										observedValue: section.shallow === undefined ? "unset" : String(section.shallow),
									}),
								);
							}

							const repoPath = path.join(root, section.path);
							const present = yield* isPresent(repoPath);
							const status = statusByPath.get(section.path);

							if (!present || status?.state === "uninitialized") {
								drifts.push(
									RepoDrift.make({
										name,
										kind: "missingWorktree",
										detail: `manifest entry "${name}" expects a checked-out worktree at "${section.path}" but none is present`,
									}),
								);
							} else if (status?.state === "outOfSync") {
								drifts.push(
									RepoDrift.make({
										name,
										kind: "checkoutDiverged",
										detail: `the worktree checked out at "${section.path}" no longer matches the commit recorded in the superproject index`,
									}),
								);
							} else if (status?.state === "conflict") {
								// `DriftKind` has no dedicated "conflict" literal -- report it
								// under `checkoutDiverged` (the worktree's checkout state does
								// not match a clean, reconciled commit either way) but keep
								// the detail text specific so this is never mistaken for a
								// plain out-of-sync gitlink.
								drifts.push(
									RepoDrift.make({
										name,
										kind: "checkoutDiverged",
										detail: `submodule index entry for "${section.path}" is in an unresolved merge conflict`,
									}),
								);
							}
						}

						// Any `.gitmodules` section not claimed by a manifest entry above
						// is an orphan -- registered with git but unknown to the manifest.
						for (const section of gitmodules.entries) {
							if (matchedSectionNames.has(section.name)) {
								continue;
							}
							drifts.push(
								RepoDrift.make({
									name: section.name,
									kind: "orphanGitmodulesEntry",
									detail: `.gitmodules section "${section.name}" has no corresponding manifest entry`,
									observedValue: section.path,
								}),
							);
						}

						return ReposDriftReport.make({ drifts, clean: drifts.length === 0 });
					});

				return { check };
			}),
		);
}
