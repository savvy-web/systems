/**
 * How a reported file path is shown.
 *
 * @packageDocumentation
 */

import { isAbsolute, relative, resolve, sep } from "node:path";

/**
 * The one rule for showing a finding's file in a report or a GitHub Actions
 * annotation.
 *
 * @internal
 */
export class DisplayPath {
	private constructor() {}

	/**
	 * `file` relative to `cwd` when it lies strictly under it (what a GitHub
	 * Actions annotation resolves against the workspace), else `file` exactly
	 * as given — a path outside `cwd`, on another drive, or `cwd` itself.
	 */
	static readonly under = (cwd: string, file: string): string => {
		const rel = relative(resolve(cwd), resolve(file));
		const outside = rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
		return outside ? file : rel;
	};
}
