/**
 * The `--version` line.
 *
 * @packageDocumentation
 */

/**
 * Renders the `savvy --version` line: the same `<name> v<version>` shape
 * `effect/cli`'s default formatter prints, but plain even at a terminal (core's
 * default paints it). The `" via <carrier> <version>"` suffix for a bin
 * installed through a carrier such as `@savvy-web/silk` is not added here:
 * `CliRuntime.main`'s `distribution` option appends it to whatever
 * `formatVersion` is in effect.
 *
 * @internal
 */
export class VersionLine {
	private constructor() {}

	/** `savvy v1.2.3`. */
	static readonly format = (name: string, version: string): string => `${name} v${version}`;
}
