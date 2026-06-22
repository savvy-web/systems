import { Schema } from "effect";

/**
 * Git tag naming strategy for a workspace.
 *
 * @remarks
 * - `"single"` — one shared tag for the entire release (e.g. `1.2.3`).
 * - `"scoped"` — a per-package tag that includes the package name (e.g. `@my-org/pkg@1.2.3`).
 *
 * Determined by `TagStrategy.determine` based on the {@link (VersioningStrategyResult:type)}.
 *
 * @since 0.1.0
 * @public
 */
export const TagStrategyType = Schema.Literal("single", "scoped");
/**
 * @since 0.1.0
 * @public
 */
export type TagStrategyType = typeof TagStrategyType.Type;
