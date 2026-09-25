/**
 * The `--version` line, carrier-aware.
 *
 * @packageDocumentation
 */

import type { Distribution } from "@effected/engine";
import { distributionSuffix } from "@effected/engine";
import type { Option } from "effect";

/**
 * Renders the `savvy --version` line: the same `<name> v<version>` shape
 * `effect/unstable/cli`'s default formatter prints, plus the
 * `" via <carrier> <version>"` suffix when the bin was installed through a
 * carrier such as `@savvy-web/silk`.
 *
 * @internal
 */
export class VersionLine {
	private constructor() {}

	/** `savvy v1.2.3`, or `savvy v1.2.3 via @savvy-web/silk 4.5.6`. */
	static readonly format = (name: string, version: string, distribution: Option.Option<Distribution>): string =>
		`${name} v${version}${distributionSuffix(distribution)}`;
}
