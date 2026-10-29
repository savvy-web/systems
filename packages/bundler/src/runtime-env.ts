// packages/bundler/src/runtime-env.ts
import { RuntimeEnv, TerminalEnv } from "@effected/env";
import { Option } from "effect";

/**
 * Whether the build runs under CI, by `@effected/env`'s one rule (a known provider's marker, or a truthy `CI` /
 * `CONTINUOUS_INTEGRATION`) — the same rule `@savvy-web/tsdown-plugins` and `@savvy-web/github-action-builder` use.
 *
 * @internal
 */
export const isCi = (env: Readonly<Record<string, string | undefined>> = process.env): boolean =>
	Option.isSome(RuntimeEnv.fromRecord(env).ci);

/**
 * Whether the build report must be painted without colour: `@effected/env`'s colour level for stdout is `none`.
 * `FORCE_COLOR` decides alone when set, then a non-TTY stdout, `NO_COLOR` / `TERM=dumb`, and the terminal table.
 *
 * @internal
 */
export const reportNoColor = (
	env: Readonly<Record<string, string | undefined>> = process.env,
	isTTY: boolean = process.stdout.isTTY === true,
): boolean => TerminalEnv.colorLevelFrom(env, isTTY) === "none";
