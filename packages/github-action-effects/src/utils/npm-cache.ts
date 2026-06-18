import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * npm CLI args that redirect npm's cache to a runner-writable directory.
 *
 * @remarks
 * GitHub's macOS runner images ship a partially **root-owned** `~/.npm/_cacache`
 * (left behind by root-run global installs during image build). Current npm
 * refuses to use a cache that contains root-owned files and hard-fails with
 * `EACCES` (errno -13) *before doing any work* — so `npm pack`, `npm publish`,
 * and `npm view` all die on an otherwise healthy runner with:
 *
 * ```text
 * npm error code EACCES
 * npm error Your cache folder contains root-owned files …
 * ```
 *
 * Pointing `--cache` at a fresh directory under `RUNNER_TEMP` (or the OS temp dir
 * off-CI) sidesteps the poisoned `~/.npm` entirely. The path is stable across
 * calls within a job so npm can reuse whatever it caches; npm creates the
 * directory on demand. The flag reaches npm in every dispatch form, including
 * `pnpm dlx npm … --cache <dir>`.
 *
 * @returns The `["--cache", "<dir>"]` pair to splice into any npm arg list.
 *
 * @internal
 */
export const npmCacheArgs = (): ReadonlyArray<string> => [
	"--cache",
	join(process.env.RUNNER_TEMP ?? tmpdir(), "silk-npm-cache"),
];
