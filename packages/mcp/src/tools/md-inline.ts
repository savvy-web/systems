/**
 * Render a repo-derived value as an inert markdown code span. Backslash
 * escaping does NOT work inside code spans (CommonMark treats backslashes
 * literally there), so this uses the delimiter-run rule instead: wrap the
 * value in a backtick run strictly longer than any backtick run it contains,
 * padding with spaces when the value starts or ends with a backtick. This
 * keeps vendored-repo content (names, refs, purposes, orientation values,
 * commit messages, note text) — the definition of untrusted input — from
 * injecting markdown structure into the transcript an agent reads.
 *
 * Shared by every tool that interpolates untrusted repo content into a
 * markdown transcript so the escaping rule has exactly one implementation.
 */
export const mdInline = (value: string): string => {
	const runs = value.match(/`+/g) ?? [];
	const delimiter = "`".repeat(Math.max(1, ...runs.map((run) => run.length + 1)));
	const body = value.startsWith("`") || value.endsWith("`") ? ` ${value} ` : value;
	return `${delimiter}${body}${delimiter}`;
};
