// packages/bundler/src/runtime-env.ts
import { RuntimeEnv, TerminalEnv } from "@effected/env";
import type { Layer } from "effect";
import { Effect, Option, Stdio } from "effect";

/**
 * Whether the build runs under CI, by `@effected/env`'s one rule (a known provider's marker, or a truthy `CI` /
 * `CONTINUOUS_INTEGRATION`) — the same rule `@savvy-web/tsdown-plugins` and `@savvy-web/github-action-builder` use.
 *
 * @internal
 */
export const isCi = (env: Readonly<Record<string, string | undefined>> = process.env): boolean =>
	Option.isSome(RuntimeEnv.fromRecord(env).ci);

/**
 * Whether the build report must be painted without colour: `@effected/env`'s stdout colour level is `none`.
 * `FORCE_COLOR` decides alone when set, then a non-TTY stdout, `NO_COLOR` / `TERM=dumb`, and the terminal table.
 *
 * @internal
 */
export const reportNoColor: Effect.Effect<boolean, never, Stdio.Stdio> = Effect.map(
	TerminalEnv.colorLevel("stdout"),
	(level) => level === "none",
);

/**
 * The one `Stdio` fact the colour decision reads — whether `process.stdout` is a TTY — without taking a runtime
 * dependency on `@effect/platform-node`. Every other `Stdio` member is inert and never used.
 *
 * @internal
 */
export const ProcessStdoutTerminal: Layer.Layer<Stdio.Stdio> = Stdio.layerTest({
	stdoutIsTerminal: Effect.sync(() => process.stdout.isTTY === true),
});
