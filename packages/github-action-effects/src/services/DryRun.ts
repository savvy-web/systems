import type { Effect } from "effect";
import { Context } from "effect";

/**
 * Service shape for {@link DryRun}.
 *
 * @public
 */
export interface DryRunShape {
	readonly isDryRun: Effect.Effect<boolean>;
	readonly guard: <A, E, R>(label: string, effect: Effect.Effect<A, E, R>, fallback: A) => Effect.Effect<A, E, R>;
}

/**
 * Service for dry-run mutation interception.
 *
 * @public
 */
export class DryRun extends Context.Service<DryRun, DryRunShape>()("github-action-effects/DryRun") {}
