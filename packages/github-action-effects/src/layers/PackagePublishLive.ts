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
import { npmCacheArgs } from "../utils/npm-cache.js";
import { parseNpmPackJson } from "../utils/npm-pack-json.js";
import { findUnresolvedSpecifiers } from "../utils/publishable-manifest.js";
import { isNpmRegistry } from "../utils/RegistryClassifier.js";

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
 * Fail when the manifest about to be packed still carries a `catalog:` or
 * `workspace:` dependency specifier.
 *
 * @remarks
 * Those protocols are resolvable only by a workspace-aware package manager. A
 * published manifest carrying one installs nowhere — npm rejects it with
 * `EUNSUPPORTEDPROTOCOL: Unsupported URL Type "catalog:"`. Reaching a registry
 * with one means an unresolved dev/workspace manifest was selected for packing,
 * so refuse before any bytes are produced.
 *
 * A missing or unreadable `package.json` is NOT an error here: `npm pack` is
 * about to fail on it anyway with a better message than this guard could give.
 *
 * @param packageDir - The directory that will be packed.
 * @param operation - The failing operation to attribute the error to.
 *
 * @internal
 */
const assertPublishableManifest = (
	packageDir: string,
	operation: "pack" | "dryRun",
): Effect.Effect<void, PackagePublishError> =>
	Effect.gen(function* () {
		const manifest = yield* Effect.try({
			try: () => JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8")) as unknown,
			catch: () => null,
		}).pipe(Effect.orElseSucceed(() => null));
		if (manifest === null) return;

		const unresolved = findUnresolvedSpecifiers(manifest);
		if (unresolved.length === 0) return;

		const rendered = unresolved.map((u) => `${u.block}.${u.name}=${u.specifier}`).join(", ");
		return yield* Effect.fail(
			new PackagePublishError({
				operation,
				reason:
					`Refusing to pack ${packageDir}: manifest carries unresolved workspace specifiers ` +
					`(${rendered}). A published package with these is uninstallable.`,
			}),
		);
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
 * The npm spec is PINNED to a major. An unpinned `pnpm dlx npm` resolves
 * `npm@latest` afresh on every run, so npm's next major lands in every
 * consumer's release pipeline on whatever day it publishes, unannounced. That
 * is exactly what happened when npm 12.0.0 took the `latest` dist-tag on
 * 2026-07-08: `pack --json` switched from an array to an object keyed by
 * package name and every publish died with "npm pack returned empty result".
 *
 * The pin stays on 11 rather than 12 because npm 12.0.0's `publish` is broken
 * outright — `libnpmpublish` declares `sigstore@^5` but the tarball does not
 * bundle it, so `provenance.js` throws `MODULE_NOT_FOUND` at require time on
 * *any* publish, provenance or not (npm/cli#9722). Move this to `npm@12` once
 * that ships fixed; {@link parseNpmPackJson} already reads both shapes, so the
 * pin bump is the only change required.
 *
 * @internal
 */
const getNpmCommand = (pm?: "npm" | "pnpm" | "yarn" | "bun"): { cmd: string; baseArgs: ReadonlyArray<string> } => {
	switch (pm) {
		case "pnpm":
			return { cmd: "pnpm", baseArgs: ["dlx", "npm@11"] };
		case "yarn":
			return { cmd: "yarn", baseArgs: ["npm"] };
		case "bun":
			return { cmd: "bun", baseArgs: ["x", "npm@11"] };
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
 * Lift npm's native trusted-publishing provenance URL out of `npm publish` output.
 *
 * When a publish runs with `--provenance` (npm's Sigstore OIDC flow), npm prints
 * `npm notice publish Provenance statement published to transparency log: <url>`.
 * We capture that URL so the release surfaces npm's own provenance alongside the
 * action's separate attestation. Returns undefined when no such line is present
 * (provenance disabled, or a non-npm registry).
 *
 * @param output - Combined stdout + stderr from the publish command.
 */
const parseProvenanceUrl = (output: string): string | undefined => {
	const match = output.match(/Provenance statement published to transparency log:\s*(\S+)/i);
	return match?.[1];
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

					pack: (packageDir: string, options?: { readonly packageManager?: "npm" | "pnpm" | "yarn" | "bun" }) =>
						Effect.gen(function* () {
							yield* Effect.logInfo(`pack: ${packageDir} start`);
							// Refuse an unresolved workspace manifest before npm produces bytes.
							yield* assertPublishableManifest(packageDir, "pack");
							// Route through the active manager's npm executor — same dispatch as
							// `publish`/`dryRun` so every phase packs with the SAME npm. `--cache`
							// dodges the runner's root-owned `~/.npm` (see `npmCacheArgs`).
							const { cmd, baseArgs } = getNpmCommand(options?.packageManager);
							const output = yield* runner
								.execCapture(cmd, [...baseArgs, "pack", "--json", ...npmCacheArgs()], { cwd: packageDir })
								.pipe(
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
								// Reads npm 11's array form and npm 12's name-keyed object form alike.
								try: () => parseNpmPackJson(output.stdout),
								catch: (error) =>
									new PackagePublishError({
										operation: "pack",
										reason: `Failed to parse npm pack JSON output: ${
											error instanceof Error ? error.message : String(error)
										} — stdout: ${output.stdout.slice(0, 200)}`,
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
							// A zero-entry tarball is never a legitimate artifact: it publishes an
							// installable-but-empty package. npm itself does not treat this as an
							// error, so catch it here rather than ship the bytes.
							if (first.entryCount === 0) {
								return yield* Effect.fail(
									new PackagePublishError({
										operation: "pack",
										reason: `npm pack produced a tarball with 0 files in ${packageDir}`,
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
							if (typeof first.filename !== "string" || first.filename === "") {
								return yield* Effect.fail(
									new PackagePublishError({
										operation: "pack",
										reason: "npm pack output missing filename field",
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
						// Dodge the runner's root-owned `~/.npm` cache (see `npmCacheArgs`).
						args.push(...npmCacheArgs());

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
							// Dodge the runner's root-owned `~/.npm` cache (see `npmCacheArgs`).
							args.push(...npmCacheArgs());
							// In tokenAuth mode, run npm with the OIDC env stripped so it uses the
							// configured `_authToken` instead of attempting trusted publishing.
							const execOptions = options.tokenAuth
								? { streaming: true as const, env: tokenAuthEnv() }
								: { streaming: true as const };
							// `execCapture` streams npm's output live (verbose notices stay visible
							// in the runner log) AND returns the captured text, so we can lift npm's
							// native trusted-publishing provenance URL out of the notice stream.
							const output = yield* runner.execCapture(cmd, args, execOptions).pipe(
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
							const provenanceUrl = parseProvenanceUrl(`${output.stdout}\n${output.stderr}`);
							yield* Effect.logInfo(
								`publishTarball: ${tarballPath} → ${options.registry} success${provenanceUrl ? ` (provenance ${provenanceUrl})` : ""}`,
							);
							return provenanceUrl !== undefined ? { provenanceUrl } : {};
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
											// Dodge the runner's root-owned `~/.npm` cache (see `npmCacheArgs`).
											args.push(...npmCacheArgs());
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
							readonly packageManager?: "npm" | "pnpm" | "yarn" | "bun";
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
						//
						// `packageManager` IS forwarded: the dry-run must dispatch through the
						// SAME npm executor as the live publish (`pnpm dlx npm`, `yarn npm`,
						// `bun x npm`, or bare `npm`) so it validates against the exact npm the
						// publish will use — a fresh dlx-fetched npm behaves differently from the
						// runner's bundled one. `--cache` dodges the root-owned `~/.npm` cache
						// (see `npmCacheArgs`); without it current npm hard-fails EACCES here.
						const { cmd, baseArgs } = getNpmCommand(options?.packageManager);
						const args = [...baseArgs, "pack", "--dry-run", "--json", ...npmCacheArgs()];

						return assertPublishableManifest(packageDir, "dryRun").pipe(
							Effect.andThen(() => runner.execCapture(cmd, args, { cwd: packageDir })),
							Effect.flatMap((output) =>
								Effect.try({
									try: () => {
										// Reads every shape npm has emitted: npm 11's array, npm 12's
										// name-keyed object, and a single unwrapped entry. Throws on
										// npm's `{ error }` envelope so its summary reaches the caller.
										const first = parseNpmPackJson(output.stdout)[0];
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
											reason: `Failed to parse npm pack --dry-run --json output: ${
												error instanceof Error ? error.message : String(error)
											} — stdout: ${output.stdout.slice(0, 200)}`,
											cause: error,
										}),
								}),
							),
							// Phase 2 must block the release PR on a zero-file package rather than
							// render "0 files" in the sticky comment and let auto-merge proceed.
							Effect.flatMap((result) =>
								result.fileCount === 0
									? Effect.fail(
											new PackagePublishError({
												operation: "dryRun",
												reason: `npm pack --dry-run reported a tarball with 0 files in ${packageDir}`,
											}),
										)
									: Effect.succeed(result),
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
