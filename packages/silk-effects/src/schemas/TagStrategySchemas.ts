import { Schema } from "effect";

/**
 * Git tag naming strategy for a workspace.
 *
 * @remarks
 * - `"single"` — one shared tag for the entire release (e.g. `1.2.3`).
 * - `"scoped"` — a per-package tag that includes the package name (e.g. `@my-org/pkg@1.2.3`).
 *
 * Determined by {@link TagStrategy.determine} based on the {@link VersioningStrategyResult}.
 *
 * @since 0.1.0
 */
export const TagStrategyType = Schema.Literal("single", "scoped");
/** @since 0.1.0 */
export type TagStrategyType = typeof TagStrategyType.Type;
