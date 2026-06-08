import type { Effect } from "effect";
import type { Plugin } from "rolldown";

export interface Surface {
	/** From a bundledPackages target — its type must be INLINED into the emitted dts. */
	plugin: Plugin;
	/** From an unlisted external — its type must stay an external import reference. */
	program: Effect.Effect<number, never, never>;
}

export const label = (s: Surface): string => (s.plugin ? "ok" : "no");
