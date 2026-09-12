/**
 * `@savvy-web/silk-core` — the platform-free domain core of the Silk Suite.
 *
 * @remarks
 * Layer 1 of the Silk package graph: schemas, tagged errors, and the PR-body
 * contract, with no `node:*`, `@effect/platform*`, or `process` access. Every
 * service that needs a filesystem, a clock, or a subprocess lives one layer up
 * in `@savvy-web/silk-effects`, which re-exports this package's surface under
 * the same names. Versioning and tag classification are `@effected/workspaces`
 * value classes, imported from the kit directly rather than re-exported here.
 *
 * @packageDocumentation
 */

// ── Errors ─────────────────────────────────────────────────────
export { BiomeSyncError } from "./errors/BiomeSyncError.js";
export { ChangesetConfigError } from "./errors/ChangesetConfigError.js";
export { ConfigNotFoundError } from "./errors/ConfigNotFoundError.js";
export { PublishTargetBindingError } from "./errors/PublishTargetBindingError.js";
export { WorkspaceAnalysisError } from "./errors/WorkspaceAnalysisError.js";
/**
 * The shared PR-body contract: the frozen `silk-release` marker grammar,
 * managed-region carry-through, and the two closing-reference spellings —
 * extracted from `silk-release-action` so independent writers agree on one
 * implementation (savvy-web/systems#419).
 *
 * @public
 */
export * as PrBody from "./pr-body/index.js";
// ── Schemas ────────────────────────────────────────────────────
export { BiomeSyncOptions, BiomeSyncResult } from "./schemas/BiomeConfig.js";
export { ConfigDiscoveryOptions, ConfigLocation, ConfigSource } from "./schemas/ConfigDiscoverySchemas.js";
export type { SavvyInstallHook } from "./schemas/SavvyInstallSection.js";
export {
	LIFECYCLE_SCRIPTS_CONFIG_KEY,
	SavvyInstallSection,
	publishesBuiltLinkDirectory,
	savvyInstallBlock,
	savvyInstallDeps,
} from "./schemas/SavvyInstallSection.js";
export {
	SavvyBaseSection,
	SavvyHooksSection,
	SavvyToolchainSection,
	savvyBasePreamble,
	savvyHooksHygiene,
	savvyToolSection,
	savvyToolchainCheck,
} from "./schemas/SavvySections.js";
export { ChangesetConfigFile, SilkChangesetConfigFile } from "./schemas/VersioningSchemas.js";
export { AnalyzedWorkspace, SilkPublishConfig, WorkspaceAnalysis } from "./schemas/WorkspaceAnalysisSchemas.js";
// ── Utilities ──────────────────────────────────────────────────
export { trimTrailingSlashes } from "./utils/TrailingSlash.js";
