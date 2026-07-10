/**
 * Trim trailing slashes from a string.
 *
 * @remarks
 * Trims trailing slashes with an index scan rather than `/\/+$/`. That regex is
 * unanchored at the start, so the engine retries the match from every position
 * and degrades to O(n²) on a string of many slashes (CodeQL `js/polynomial-redos`).
 * Only a trailing run of slashes is removed; interior slash runs are untouched.
 */
export const trimTrailingSlashes = (s: string): string => {
	let end = s.length;
	while (end > 0 && s[end - 1] === "/") end -= 1;
	return s.slice(0, end);
};
