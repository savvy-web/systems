import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Effect, Layer, Redacted } from "effect";
import { PackagePublishError } from "../errors/PackagePublishError.js";
import { ActionOutputs } from "../services/ActionOutputs.js";
import { CommandRunner } from "../services/CommandRunner.js";
import { NpmRegistry } from "../services/NpmRegistry.js";
import type { DryRunResult, IdempotentPublishInput, PackResult } from "../services/PackagePublish.js";
import { PackagePublish } from "../services/PackagePublish.js";
import { isNpmRegistry } from "../utils/RegistryClassifier.js";

/**
 * The size-bearing fields of npm's `--json` dry-run output.
 *
 * `npm publish --dry-run --json` emits one such object;
 * `npm pack --dry-run --json` emits an array of them. Only the fields
 * consumed by {@link DryRunResult} are modelled.
 */
interface PackedJson {
	readonly size?: number;
	readonly unpackedSize?: number;
	readonly entryCount?: number;
}

/**
 * Shape of an entry in `npm pack --json` output.
 *
 * @remarks
 * `npm pack --json` emits an array of objects, one per packed tarball.
 * Each object carries the fields modelled below; `integrity` is in the
 * `sha512-<base64>` shape the registry stores as `dist.integrity`.
 *
 * @internal
 */
interface NpmPackJsonEntry {
	readonly filename: string;
	readonly name?: string;
	readonly version?: string;
	readonly integrity?: string;
	readonly size?: number;
	readonly unpackedSize?: number;
	readonly entryCount?: number;
}

/**
 * Build npm's `_authToken` config key for a registry.
 *
 * npm derives a registry's auth-config key by stripping the URL scheme and
 * keeping a leading `//` — e.g. `https://npm.pkg.github.com/` becomes
 * `//npm.pkg.github.com/:_authToken`. The `registry` argument may be a full
 * URL or a bare host; both normalize to the same key. Writing the key with the
 * scheme still attached (`//https://…`) produces a key npm never matches, so
 * the publish is treated as unauthenticated.
 */
const authTokenKey = (registry: string): string => {
	const withoutScheme = registry.replace(/^https?:\/\//, "");
	const prefixed = withoutScheme.startsWith("//") ? withoutScheme : `//${withoutScheme}`;
	// npm nerf-darts a registry WITH a trailing slash (`//host/:_authToken`) — registry
	// URLs are normalized to end in `/` before the token is looked up. A key written
	// without the slash (`//host:_authToken`) is never matched, so the publish goes out
	// unauthenticated and fails ENEEDAUTH even though a token was configured. The bundler's
	// `dist/prod/targets.json` binding emits registries WITHOUT a trailing slash, so
	// normalize one in here.
	const withSlash = prefixed.endsWith("/") ? prefixed : `${prefixed}/`;
	return `${withSlash}:_authToken`;
};

/**
 * Resolve the user-level `.npmrc` path that `npm config set` and `npm publish`
 * read. Honors `NPM_CONFIG_USERCONFIG` (the override `npm` itself respects),
 * falling back to `~/.npmrc`.
 *
 * @internal
 */
const userNpmrcPath = (): string => process.env.NPM_CONFIG_USERCONFIG ?? join(homedir(), ".npmrc");

/**
 * Write a registry auth-token line to the user `.npmrc` WITHOUT passing the
 * token as a command argument.
 *
 * @remarks
 * The previous implementation ran `npm config set <key> <token>`, which placed
 * the token in `args`; on failure `CommandRunnerError.message` rendered the
 * args and leaked the token. Writing the `_authToken=<token>` line directly to
 * the same `.npmrc` `npm config set` would have written (the userconfig) keeps
 * the wire bytes identical while removing the secret from any argv/error.
 * Unwrap the `Redacted` token only here, at the file-write boundary.
 *
 * @internal
 */
const writeAuthToken = (registry: string, token: Redacted.Redacted<string>): Effect.Effect<void, PackagePublishError> =>
	Effect.try({
		try: () => {
			appendFileSync(userNpmrcPath(), `${authTokenKey(registry)}=${Redacted.value(token)}\n`);
		},
		catch: (error) =>
			new PackagePublishError({
				operation: "setupAuth",
				registry,
				reason: error instanceof Error ? error.message : String(error),
				cause: error,
			}),
	});

/**
 * Resolve the command + base args used to invoke `npm` under each supported
 * package manager.
 *
 * @remarks
 * Critically, `pnpm dlx npm`, `yarn npm`, and `bun x npm` each fetch a fresh
 * `npm` rather than using the one bundled with the runner's Node. The runner's
 * bundled `npm` lags Node by several minor versions — Node 24 ships npm 10.x,
 * which has no support for npm trusted publishing (the OIDC token-exchange
 * step that lets `npm publish --provenance` run without an `NPM_TOKEN`).
 * Routing through the package manager's executor fetches npm 11.5.1+, which
 * supports the exchange. `"npm"` keeps the bundled `npm` and is the safe
 * default for callers that have ensured an adequate version themselves.
 *
 * @internal
 */
const getNpmCommand = (pm?: "npm" | "pnpm" | "yarn" | "bun"): { cmd: string; baseArgs: ReadonlyArray<string> } => {
	switch (pm) {
		case "pnpm":
			return { cmd: "pnpm", baseArgs: ["dlx", "npm"] };
		case "yarn":
			return { cmd: "yarn", baseArgs: ["npm"] };
		case "bun":
			return { cmd: "bun", baseArgs: ["x", "npm"] };
		default:
			return { cmd: "npm", baseArgs: [] };
	}
};

/**
 * The GitHub Actions OIDC environment variables. When present, npm 11.5+ AUTO-attempts
 * tokenless trusted publishing (the `/-/npm/v1/oidc/token/exchange` POST) on every publish —
 * regardless of `--provenance` — and does NOT fall back to a configured `_authToken` when the
 * exchange fails. GitHub Packages never supports that exchange (404), and an npm-public package
 * with no trusted publisher configured 404s too. {@link tokenAuthEnv} strips these so npm uses
 * the `_authToken` instead.
 */
const OIDC_ENV_VARS = ["ACTIONS_ID_TOKEN_REQUEST_URL", "ACTIONS_ID_TOKEN_REQUEST_TOKEN"] as const;

/**
 * Build a child environment that inherits the current process env MINUS the GitHub Actions
 * OIDC variables, forcing npm onto classic `_authToken` auth (no trusted-publishing attempt).
 * `CommandRunner` replaces the child env with the value passed, so this returns the full env.
 */
const tokenAuthEnv = (): Record<string, string> => {
	const env: Record<string, string> = {};
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined) env[key] = value;
	}
	for (const key of OIDC_ENV_VARS) delete env[key];
	return env;
};

/**
 * Extract a concise, actionable summary from npm's stderr — the `npm error`/`npm warn`
 * lines and any auth/OIDC markers — so a publish failure surfaces the real cause
 * (ENEEDAUTH, E404, OIDC exchange) instead of the opaque "Command exited with code 1".
 * Returns undefined when there is nothing useful to add (the caller falls back to the
 * generic reason).
 */
const npmErrorSummary = (stderr: string | undefined): string | undefined => {
	if (!stderr) return undefined;
	const lines = stderr
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => /^npm (error|warn)\b/i.test(line) || /ENEEDAUTH|E40\d|need auth|oidc/i.test(line));
	const summary = [...new Set(lines)].slice(0, 6).join(" | ");
	return summary.length > 0 ? summary : undefined;
};

/**
 * Live PackagePublish layer using CommandRunner and NpmRegistry.
 *
 * @public
 */
export const PackagePublishLive: Layer.Layer<PackagePublish, never, CommandRunner | NpmRegistry | ActionOutputs> =
	Layer.effect(
		PackagePublish,
		Effect.all([CommandRunner, NpmRegistry, ActionOutputs]).pipe(
			Effect.map(([runner, registry, outputs]) => {
				const service: typeof PackagePublish.Service = {
					setupAuth: (registryUrl: string, token: Redacted.Redacted<string>) =>
						// Mask the token in the runner log first, then write it to
						// `.npmrc` off-argv (never as a command argument). Log the resolved
						// auth-config KEY and target `.npmrc` (never the token) so a registry /
						// nerf-dart mismatch — the cause of a token-present ENEEDAUTH — is
						// visible in the run without leaking the secret.
						outputs.setSecret(Redacted.value(token)).pipe(
							Effect.flatMap(() => writeAuthToken(registryUrl, token)),
							Effect.tap(() =>
								Effect.logInfo(`setupAuth: ${registryUrl} → wrote ${authTokenKey(registryUrl)} to ${userNpmrcPath()}`),
							),
						),

					pack: (packageDir: string) =>
						Effect.gen(function* () {
							yield* Effect.logInfo(`pack: ${packageDir} start`);
							const output = yield* runner.execCapture("npm", ["pack", "--json"], { cwd: packageDir }).pipe(
								Effect.mapError(
									(error) =>
										new PackagePublishError({
											operation: "pack",
											reason: error.reason,
											cause: error,
										}),
								),
							);
							const entries = yield* Effect.try({
								try: () => JSON.parse(output.stdout) as ReadonlyArray<NpmPackJsonEntry>,
								catch: (error) =>
									new PackagePublishError({
										operation: "pack",
										reason: `Failed to parse npm pack JSON output: ${output.stdout.slice(0, 200)}`,
										cause: error,
									}),
							});
							const first = entries[0];
							if (!first) {
								return yield* Effect.fail(
									new PackagePublishError({
										operation: "pack",
										reason: "npm pack returned empty result",
									}),
								);
							}
							if (typeof first.integrity !== "string" || first.integrity === "") {
								return yield* Effect.fail(
									new PackagePublishError({
										operation: "pack",
										reason: "npm pack output missing integrity field",
									}),
								);
							}
							// Compute sha256-hex of the tarball alongside npm's sha512-base64
							// integrity. The two are used for different downstream APIs:
							// `digest` (sha512-base64) compares against `dist.integrity` from
							// the registry (the recovery decision); `sha256Hex` is the format
							// GitHub's artifact-metadata and attestation APIs accept as the
							// subject digest. The two are NOT interchangeable — different
							// algorithm, different encoding.
							const tarballPath = join(packageDir, first.filename);
							const sha256Hex = yield* Effect.try({
								try: () => createHash("sha256").update(readFileSync(tarballPath)).digest("hex"),
								catch: (error) =>
									new PackagePublishError({
										operation: "pack",
										reason: `Failed to compute sha256 of tarball at ${tarballPath}`,
										cause: error,
									}),
							});
							const result: PackResult = {
								tarballPath,
								digest: first.integrity,
								sha256Hex,
								name: typeof first.name === "string" ? first.name : "",
								version: typeof first.version === "string" ? first.version : "",
								packedSize: typeof first.size === "number" ? first.size : 0,
								unpackedSize: typeof first.unpackedSize === "number" ? first.unpackedSize : 0,
								fileCount: typeof first.entryCount === "number" ? first.entryCount : 0,
							};
							yield* Effect.logInfo(
								`pack: ${result.name}@${result.version} packed; tarball=${result.tarballPath}; digest=${result.digest}; sha256=${result.sha256Hex}; packedSize=${result.packedSize}; files=${result.fileCount}`,
							);
							return result;
						}),

					publish: (
						packageDir: string,
						options?: {
							readonly registry?: string;
							readonly tag?: string;
							readonly access?: "public" | "restricted";
							readonly provenance?: boolean;
							readonly packageManager?: "npm" | "pnpm" | "yarn" | "bun";
						},
					) => {
						const { cmd, baseArgs } = getNpmCommand(options?.packageManager);
						const args = [...baseArgs, "publish"];
						if (options?.registry) args.push("--registry", options.registry);
						if (options?.tag) args.push("--tag", options.tag);
						if (options?.access) args.push("--access", options.access);
						// Only npm's public registry supports `--provenance` (Sigstore OIDC
						// trusted publishing). An undefined registry means npm's default
						// (the public registry); a set registry must be npm. GitHub Packages
						// 404s the OIDC exchange — its provenance is the GitHub artifact
						// attestation, not this flag.
						if (options?.provenance && (options.registry === undefined || isNpmRegistry(options.registry)))
							args.push("--provenance");
						// `--loglevel verbose` makes npm log its HTTP requests,
						// including the OIDC trusted-publisher exchange against
						// `<registry>/-/npm/v1/oidc/token/exchange` and the upstream
						// PUT. Without this the exchange step is invisible — npm
						// silently falls back to anonymous auth on exchange failure
						// and the registry returns a 404 that reads like "package
						// not found" but is actually "publisher not authorized."
						// Verbose only affects publish (not validation/dry-run);
						// safe to enable unconditionally.
						args.push("--loglevel", "verbose");

						// `streaming: true` tees npm's stdout and stderr to the
						// host process's stdout/stderr so the GitHub Actions runner
						// log captures the full output live. The captured strings
						// still flow into the error (when one occurs) — streaming
						// is additive. Without this, npm's output reached the
						// runner log only via the truncated error.message, hiding
						// the actual cause of a publish failure.
						return runner.exec(cmd, args, { cwd: packageDir, streaming: true }).pipe(
							Effect.asVoid,
							Effect.mapError(
								(error) =>
									new PackagePublishError({
										operation: "publish",
										...(options?.registry !== undefined ? { registry: options.registry } : {}),
										reason: error.reason,
										cause: error,
									}),
							),
						);
					},

					publishTarball: (
						tarballPath: string,
						options: {
							readonly registry: string;
							readonly access?: "public" | "restricted";
							readonly provenance?: boolean;
							readonly tag?: string;
							readonly packageManager?: "npm" | "pnpm" | "yarn" | "bun";
							/**
							 * Force classic `_authToken` auth by stripping the OIDC env so npm does
							 * not attempt (and fail) trusted publishing. Required for GitHub
							 * Packages (never supports the exchange) and as the bootstrap path for
							 * npm packages with no trusted publisher configured yet.
							 */
							readonly tokenAuth?: boolean;
						},
					) =>
						Effect.gen(function* () {
							yield* Effect.logInfo(
								`publishTarball: ${tarballPath} → ${options.registry} (access=${options.access ?? "default"}, provenance=${options.provenance === true}, tokenAuth=${options.tokenAuth === true})`,
							);
							const { cmd, baseArgs } = getNpmCommand(options.packageManager);
							const args = [...baseArgs, "publish", tarballPath, "--registry", options.registry];
							if (options.access) args.push("--access", options.access);
							// `--provenance` runs npm's Sigstore OIDC trusted-publishing token
							// exchange, which only the npm public registry supports. GitHub
							// Packages (and custom registries) 404 the OIDC endpoint and then
							// fail ENEEDAUTH even with a valid _authToken, so only pass the flag
							// for npm. GitHub Packages provenance is the separate GitHub artifact
							// attestation handled by the attest step.
							if (options.provenance && isNpmRegistry(options.registry)) args.push("--provenance");
							if (options.tag) args.push("--tag", options.tag);
							// See `publish` above for why verbose + streaming.
							// `cwd` is intentionally absent — the tarball path is
							// absolute, so npm resolves it without help.
							args.push("--loglevel", "verbose");
							// In tokenAuth mode, run npm with the OIDC env stripped so it uses the
							// configured `_authToken` instead of attempting trusted publishing.
							const execOptions = options.tokenAuth
								? { streaming: true as const, env: tokenAuthEnv() }
								: { streaming: true as const };
							yield* runner.exec(cmd, args, execOptions).pipe(
								Effect.asVoid,
								Effect.mapError(
									(error) =>
										new PackagePublishError({
											operation: "publishTarball",
											registry: options.registry,
											// Surface npm's actual failure (e.g. ENEEDAUTH / 404) instead of the
											// opaque "Command exited with code 1", so the action's failure log
											// is actionable without re-reading the streamed npm output.
											reason: npmErrorSummary(error.stderr) ?? error.reason,
											cause: error,
										}),
								),
							);
							yield* Effect.logInfo(`publishTarball: ${tarballPath} → ${options.registry} success`);
						}),

					verifyIntegrity: (packageName: string, version: string, expectedDigest: string) =>
						registry.getPackageInfo(packageName, version).pipe(
							Effect.map((info) => info.integrity === expectedDigest),
							Effect.mapError(
								(error) =>
									new PackagePublishError({
										operation: "verifyIntegrity",
										pkg: packageName,
										reason: error.reason,
										cause: error,
									}),
							),
						),

					publishToRegistries: (
						packageDir: string,
						registries: Array<{
							readonly registry: string;
							readonly token: Redacted.Redacted<string>;
							readonly tag?: string;
							readonly access?: "public" | "restricted";
							readonly packageManager?: "npm" | "pnpm" | "yarn" | "bun";
						}>,
					) =>
						Effect.forEach(
							registries,
							(target) =>
								// Mask + write the auth token to `.npmrc` off-argv; the
								// bundled npm reads `.npmrc` regardless of which manager
								// runs the publish.
								outputs
									.setSecret(Redacted.value(target.token))
									.pipe(Effect.flatMap(() => writeAuthToken(target.registry, target.token)))
									.pipe(
										Effect.flatMap(() => {
											// Route the publish through the active manager's npm
											// executor — same dispatch as `publish` / `publishTarball`
											// so a caller publishing through `publishToRegistries`
											// still gets the fresh-npm OIDC fix.
											const { cmd, baseArgs } = getNpmCommand(target.packageManager);
											const args = [...baseArgs, "publish"];
											args.push("--registry", target.registry);
											if (target.tag) args.push("--tag", target.tag);
											if (target.access) args.push("--access", target.access);
											args.push("--loglevel", "verbose");
											// See the `publish` method above — stream npm output
											// to the runner log so failures are diagnosable, and
											// verbose surfaces npm's OIDC exchange and HTTP requests.
											return runner.exec(cmd, args, { cwd: packageDir, streaming: true }).pipe(Effect.asVoid);
										}),
									),
							{ discard: true },
						).pipe(
							Effect.mapError(
								(error) =>
									new PackagePublishError({
										operation: "publishToRegistries",
										reason:
											typeof error === "object" && error !== null && "reason" in error
												? String(error.reason)
												: String(error),
										cause: error,
									}),
							),
						),

					dryRun: (
						packageDir: string,
						options?: {
							readonly registry?: string;
							readonly tag?: string;
							readonly access?: "public" | "restricted";
							readonly provenance?: boolean;
						},
					) => {
						// Size the package via `npm pack --dry-run --json`, not `npm publish
						// --dry-run --json`: current npm does not emit the size/unpackedSize/
						// entryCount fields from `publish --dry-run --json`, so packed sizes came
						// back undefined. `npm pack --dry-run --json` reliably emits them (as an
						// array, which the parser below already tolerates) and skips writing the
						// tarball. The tarball is identical across registries, so the publish-only
						// options (registry/tag/access/provenance) do not affect pack output and
						// are intentionally not forwarded.
						void options;
						const args = ["pack", "--dry-run", "--json"];

						return runner.execCapture("npm", args, { cwd: packageDir }).pipe(
							Effect.flatMap((output) =>
								Effect.try({
									try: () => {
										// `npm publish --dry-run --json` emits a single JSON object.
										// `npm pack --dry-run --json` emits an array of such objects.
										// Tolerate both so this parser is robust to either form.
										const parsed = JSON.parse(output.stdout) as PackedJson | ReadonlyArray<PackedJson>;
										const first: PackedJson | undefined = Array.isArray(parsed) ? parsed[0] : parsed;
										const result: DryRunResult = {
											ok: true,
											output: output.stdout,
											...(first?.size !== undefined ? { packedSize: first.size } : {}),
											...(first?.unpackedSize !== undefined ? { unpackedSize: first.unpackedSize } : {}),
											...(first?.entryCount !== undefined ? { fileCount: first.entryCount } : {}),
										};
										return result;
									},
									catch: (error) =>
										new PackagePublishError({
											operation: "dryRun",
											reason: `Failed to parse npm publish --dry-run --json output: ${output.stdout.slice(0, 200)}`,
											cause: error,
										}),
								}),
							),
							Effect.catchTag(
								"CommandRunnerError",
								(error): Effect.Effect<DryRunResult, PackagePublishError> =>
									Effect.succeed({ ok: false, output: error.stderr ?? error.reason }),
							),
						);
					},

					publishIdempotent: (input: IdempotentPublishInput) =>
						Effect.gen(function* () {
							const versions = yield* registry.getVersions(input.packageName).pipe(
								Effect.mapError(
									(error) =>
										new PackagePublishError({
											operation: "publishIdempotent",
											pkg: input.packageName,
											reason: error.reason,
											cause: error,
										}),
								),
							);
							if (versions.includes(input.version)) {
								const identical = yield* service.verifyIntegrity(input.packageName, input.version, input.digest).pipe(
									Effect.mapError(
										(error) =>
											new PackagePublishError({
												operation: "publishIdempotent",
												pkg: input.packageName,
												reason: error.reason,
												cause: error,
											}),
									),
								);
								if (identical) {
									return {
										status: "skipped" as const,
										packageName: input.packageName,
										version: input.version,
										skipReason: "already-published-identical" as const,
									};
								}
								return yield* Effect.fail(
									new PackagePublishError({
										operation: "publishIdempotent",
										pkg: input.packageName,
										reason: `Published ${input.packageName}@${input.version} has a different integrity hash than the local build; refusing to republish.`,
									}),
								);
							}
							yield* service.publish(input.packageDir, input.options);
							return {
								status: "published" as const,
								packageName: input.packageName,
								version: input.version,
							};
						}),
				};
				return service;
			}),
		),
	);
