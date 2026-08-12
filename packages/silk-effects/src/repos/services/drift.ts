import { Git, Gitmodules } from "@effected/git";
import { Context, Effect, FileSystem, Layer, Option, Path, Result } from "effect";
import { REPOS_DIR } from "../constants.js";
import type { ReposConfigError } from "../errors.js";
import { GitSubmoduleError } from "../errors.js";
import { RepoDrift, ReposDriftReport } from "../schemas/drift.js";
import { ReposConfigStore } from "./config-store.js";
import { resolveModuleDir } from "./lockdown.js";

/**
 * Extracts the submodule NAME from a `submodule.<name>.<property>` config key.
 *
 * @remarks
 * A submodule's name is routinely a PATH (`git submodule add` derives the
 * section name from the path), so the name itself contains dots — which means
 * the key cannot be split on `.` and read positionally. Strip the fixed
 * `submodule.` prefix and the final `.<property>` segment instead; everything
 * between is the name, dots and all. Returns `undefined` for any key that is
 * not a `submodule.*.*` key.
 */
const submoduleNameFromKey = (key: string): string | undefined => {
	if (!key.startsWith("submodule.")) {
		return undefined;
	}
	const rest = key.slice("submodule.".length);
	const lastDot = rest.lastIndexOf(".");
	return lastDot <= 0 ? undefined : rest.slice(0, lastDot);
};

/**
 * The {@link ReposDrift} service shape.
 * @public
 */
export interface ReposDriftShape {
	readonly check: (root: string) => Effect.Effect<ReposDriftReport, ReposConfigError | GitSubmoduleError>;
}

/**
 * Reconciles the five authorities a vendored repo's state is spread across —
 * the manifest, `.gitmodules`, the worktree, `git submodule status`, and the
 * superproject's LOCAL git config — and reports every disagreement found,
 * including one level down into a vendored repo's own submodules. Read-only:
 * no staging, no lockdown interaction, so it runs unmodified against a locked
 * (`ReposLockdown`) tree.
 *
 * @remarks
 * The local config is the fifth authority because the other four can all
 * agree while a checkout is still REGISTERED under a pre-canonicalization
 * section name — a state that reads clean here while `git submodule status`
 * reports a perfectly healthy checkout as uninitialized.
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

						// Only a `NotFound`-classified read failure means "no .gitmodules
						// yet" -- `Effect.option` used to fold EVERY failure (a
						// permission-denied stat, a broken symlink, an unreadable mount)
						// into the same `None`, silently reporting a real I/O problem as
						// "every manifest entry is unregistered." Any other failure
						// propagates as `GitSubmoduleError`, the same classification
						// `ReposManager` uses for its own `.gitmodules` reads.
						const gitmodulesText = yield* fs.readFileString(gitmodulesPath).pipe(
							Effect.map(Option.some),
							Effect.catchTag("PlatformError", (error) =>
								error.reason._tag === "NotFound"
									? Effect.succeed(Option.none<string>())
									: Effect.fail(asSubmoduleError("read .gitmodules", gitmodulesPath)(error)),
							),
						);

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

						// Pairing is arbitrated in TWO PASSES over every manifest entry,
						// not one entry at a time -- entry order used to decide the
						// outcome: with a section named ".repos/A" but whose `path` field
						// reads ".repos/B", pairing B FIRST (in `Object.entries` order)
						// stole that section via the path fallback below, leaving A's own
						// correctly-named section unclaimed and A wrongly reported
						// `unregisteredManifestEntry` despite its exact-name section
						// existing. Claiming every exact-NAME match first, across ALL
						// entries, before any entry is allowed to fall back to a PATH
						// match closes that: a section already claimed by its rightful
						// name-matched entry can never be stolen by another entry's path
						// fallback, regardless of manifest iteration order.
						interface Paired {
							readonly section: (typeof gitmodules.entries)[number];
							readonly viaPath: boolean;
						}
						const pairedByName = new Map<string, Paired>();

						// Pass 1: exact-name claims, across every entry.
						for (const [name] of manifestEntries) {
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
							if (nameMatch) {
								matchedSectionNames.add(nameMatch.name);
								pairedByName.set(name, { section: nameMatch, viaPath: false });
							}
						}

						// Pass 2: path-fallback for entries STILL unmatched after pass 1,
						// against sections pass 1 (or an earlier pass-2 iteration) hasn't
						// already claimed. A diverged section name (e.g. a manifest entry
						// re-slugged after the `.gitmodules` section was created under an
						// older name) would otherwise degrade straight to an
						// unregistered/orphan pair and mask the url/shallow comparisons
						// below; pairing by the section's own `path` field is the one
						// other identifier that still ties a section to this manifest
						// entry.
						for (const [name] of manifestEntries) {
							if (pairedByName.has(name)) {
								continue;
							}
							const expectedPath = `${REPOS_DIR}/${name}`;
							const pathMatch = gitmodules.entries.find(
								(candidate) => candidate.path === expectedPath && !matchedSectionNames.has(candidate.name),
							);
							if (pathMatch) {
								matchedSectionNames.add(pathMatch.name);
								pairedByName.set(name, { section: pathMatch, viaPath: true });
							}
						}

						for (const [name, entry] of manifestEntries) {
							const expectedPath = `${REPOS_DIR}/${name}`;
							const paired = pairedByName.get(name);
							if (!paired) {
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
							const { section, viaPath } = paired;
							const pathMatch = viaPath ? section : undefined;

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
										// The config key is keyed by the `.gitmodules` SECTION
										// name (the path form git derives it from,
										// `submodule.<path>.shallow`), never the bare manifest
										// key -- `section.name` is that canonical name, exactly
										// the value paired against `name` above.
										detail: `.gitmodules does not record submodule.${section.name}.shallow = true`,
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

						// --- Fifth authority: the superproject's LOCAL git config ------
						// `.git/config`'s `submodule.<name>.*` registration is written
						// only by `submodule add`/`submodule init`, is unversioned, and
						// is keyed by section NAME. Nothing above reads it, so after a
						// section canonicalization the manifest, `.gitmodules`, the index
						// and the worktree can all agree — a clean report — while this
						// checkout is still registered under the OLD name. `git
						// submodule status` then reads a perfectly healthy entry as
						// uninitialized.
						//
						// The module GITDIR is the precise link between the two names:
						// git names `.git/modules/<dir>` after the registration name in
						// force when the submodule was created, and never renames it
						// afterwards. So the gitdir's own path, relative to
						// `.git/modules`, IS the name this checkout is really registered
						// under — no guessing required.
						const configEntries = yield* git
							.configList(root)
							.pipe(Effect.mapError(asSubmoduleError("git config --list", root)));
						const registeredNames = new Set(
							configEntries
								.map((configEntry) => submoduleNameFromKey(configEntry.key))
								.filter((registeredName): registeredName is string => registeredName !== undefined),
						);

						const modulesRoot = path.join(root, ".git", "modules");
						const canonicalNames = new Set(manifestEntries.map(([name]) => `${REPOS_DIR}/${name}`));
						const explained = new Set<string>();

						for (const [name] of manifestEntries) {
							const expectedPath = `${REPOS_DIR}/${name}`;
							const moduleDir = yield* resolveModuleDir(fs, path, root, name);
							const relativeToModules = path.relative(modulesRoot, moduleDir);
							// Not under `.git/modules` at all (a plain, non-submodule
							// checkout, or a `gitdir:` pointer that resolved elsewhere) —
							// there is no registration name to compare against.
							if (
								relativeToModules.startsWith("..") ||
								path.isAbsolute(relativeToModules) ||
								relativeToModules === ""
							) {
								continue;
							}
							if (relativeToModules === expectedPath) {
								continue;
							}
							explained.add(relativeToModules);
							drifts.push(
								RepoDrift.make({
									name,
									kind: "localRegistrationDivergence",
									detail: `manifest entry "${name}" is canonically "${expectedPath}" but this checkout's module gitdir is registered as "${relativeToModules}"${
										registeredNames.has(relativeToModules)
											? ` (local git config still carries submodule.${relativeToModules}.*)`
											: ""
									} — run \`git submodule sync\` + \`git submodule init\` to re-register it locally`,
									manifestValue: expectedPath,
									observedValue: relativeToModules,
								}),
							);
						}

						// A stale local registration whose gitdir no longer backs any
						// manifest entry: nothing above can attribute it to an entry, but
						// leaving it unreported means `git submodule status` keeps
						// listing a name the manifest has never heard of.
						for (const registeredName of registeredNames) {
							if (
								!registeredName.startsWith(`${REPOS_DIR}/`) ||
								canonicalNames.has(registeredName) ||
								explained.has(registeredName)
							) {
								continue;
							}
							drifts.push(
								RepoDrift.make({
									name: registeredName,
									kind: "localRegistrationDivergence",
									// Unlike the per-entry divergence above, the `git submodule
									// sync` + `init` remedy does NOT apply here: there is no
									// manifest entry left to re-register, so the only fix is to
									// drop the section outright. Say that, or the report names a
									// problem whose stated remedy is for a different one.
									detail: `local git config registers submodule "${registeredName}", which matches no manifest entry — a stale registration left behind by a rename or an unvendoring; clear it with \`git config --remove-section submodule.${registeredName}\``,
									observedValue: registeredName,
								}),
							);
						}

						// --- One level down: a vendored repo's OWN submodules ----------
						// Sparse-checkout governs only the parent's TRACKED files; an
						// initialized submodule's working tree belongs to its own
						// repository, so sparse cannot evict it and the manifest's
						// `sparse` list silently does not cover gitlink entries. Once
						// something has run a recursive init, the nested trees sit
						// outside every authority reconciled above — which is how a
						// vendored repo pinned at one version can present source from
						// another, the exact failure vendoring exists to prevent.
						for (const [name] of manifestEntries) {
							const repoPath = path.join(root, REPOS_DIR, name);
							if (!(yield* isPresent(repoPath))) {
								continue;
							}
							// A vendored tree with no `.gitmodules` of its own yields an
							// empty listing, not a failure. A genuine git failure here is
							// swallowed rather than propagated: this is an extra level of
							// depth on a report whose other eight kinds are already
							// computed, and a nested-status hiccup must not turn the whole
							// drift report into an error.
							const nested = yield* git.submoduleStatus(repoPath).pipe(Effect.orElseSucceed(() => []));
							for (const nestedEntry of nested) {
								if (nestedEntry.state === "current" || nestedEntry.state === "uninitialized") {
									continue;
								}
								drifts.push(
									RepoDrift.make({
										name,
										kind: "nestedSubmoduleDivergence",
										detail: `vendored repo "${name}" has its own submodule "${nestedEntry.path}" checked out at ${nestedEntry.sha}, which does not match what "${name}"'s pinned commit records — reading it would consult a stale authority; \`savvy repos restore ${name}\` deinitializes it`,
										observedValue: nestedEntry.sha,
									}),
								);
							}
						}

						return ReposDriftReport.make({ drifts, clean: drifts.length === 0 });
					});

				return { check };
			}),
		);
}
