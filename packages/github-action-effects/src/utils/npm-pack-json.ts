/**
 * Shape of a single entry in `npm pack --json` / `npm publish --json` output.
 *
 * @remarks
 * `integrity` is in the `sha512-<base64>` shape the registry stores as
 * `dist.integrity`. Every field is optional except `filename`-bearing entries
 * from a real (non-dry-run) pack, because `pack --dry-run --json` omits nothing
 * but callers only consume a subset.
 *
 * @internal
 */
export interface NpmPackJsonEntry {
	readonly filename?: string;
	readonly name?: string;
	readonly version?: string;
	readonly integrity?: string;
	readonly size?: number;
	readonly unpackedSize?: number;
	readonly entryCount?: number;
}

/** An entry carries at least one of npm's per-tarball scalar fields. */
const isEntry = (value: unknown): value is NpmPackJsonEntry => {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.filename === "string" ||
		typeof candidate.entryCount === "number" ||
		typeof candidate.size === "number"
	);
};

/**
 * Parse the stdout of `npm pack --json` (or `npm publish --json`) into a flat
 * list of entries, tolerating every shape npm has emitted.
 *
 * @remarks
 * npm 12 changed `pack --json` from an array of entries to an object keyed by
 * package name — the shape `publish --json` already used — and the changelog
 * calls this out as a breaking change ("the `--json` output of `npm pack` and
 * `npm publish` have changed. They are now always consistent"). Indexing `[0]`
 * into the object yields `undefined`, which is why every publish failed with
 * "npm pack returned empty result" the day npm 12 hit the `latest` dist-tag.
 *
 * Three shapes are accepted so a pinned-npm bump never re-breaks this seam:
 *
 * - npm ≤ 11 pack: `[{ filename, entryCount, … }]`
 * - npm ≥ 12 pack, and publish on every version: `{ "<pkg-name>": { … } }`
 * - a single unwrapped entry: `{ size, unpackedSize, entryCount }`
 *
 * @param stdout - Raw stdout from the npm invocation.
 * @returns The entries npm reported, in emission order. Empty when npm packed nothing.
 * @throws If `stdout` is not JSON, or npm emitted its `{ error }` envelope.
 *
 * @internal
 */
export const parseNpmPackJson = (stdout: string): ReadonlyArray<NpmPackJsonEntry> => {
	const parsed: unknown = JSON.parse(stdout);

	if (Array.isArray(parsed)) return parsed.filter(isEntry);
	if (typeof parsed !== "object" || parsed === null) return [];

	// npm 12 reports command failures as `{ error: { code, summary, detail } }`
	// on stdout with a non-zero exit. Surface npm's own words rather than the
	// misleading "returned empty result" an unrecognized shape would produce.
	const { error } = parsed as { error?: { code?: string; summary?: string } };
	if (error !== undefined && error !== null) {
		const code = error.code ?? "UNKNOWN";
		const summary = error.summary ?? "npm reported an error with no summary";
		throw new Error(`${code}: ${summary}`);
	}

	if (isEntry(parsed)) return [parsed];
	return Object.values(parsed).filter(isEntry);
};
