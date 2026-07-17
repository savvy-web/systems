/**
 * GPG / SSH signing diagnostic.
 *
 * @remarks
 * The `git config` reads run through `@effected/git`'s `configGet`
 * (Option-shaped: an unset key is `Option.none`). The `gpg` /
 * `gpg-connect-agent` probes are not git, so they stay hand-rolled on
 * `effect/unstable/process` `ChildProcess`; every probe degrades to its v3
 * fallback value (`keyResolves: false`, `agentResponsive: false`) on any
 * failure, and the diagnostic as a whole degrades to
 * {@link FALLBACK_DIAGNOSTIC}, preserving the never-fails contract.
 *
 * @internal
 */
import { stat } from "node:fs/promises";
import { Git } from "@effected/git";
import { Effect, Option } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

export interface SigningDiagnostic {
	format: "gpg" | "ssh" | "none";
	autoSignEnabled: boolean;
	signingKeyConfigured: boolean;
	keyResolves: boolean;
	agentResponsive: boolean;
	warnings: ReadonlyArray<string>;
}

export interface RawSigningInputs {
	gpgFormat: string | null;
	commitGpgsign: string | null;
	signingKey: string | null;
	keyResolves: boolean;
	agentResponsive: boolean;
	keyExpiry: string | null;
	sshAllowedSignersFile: string | null;
}

export function parseGpgKeyExpiry(colonsOutput: string): string | null {
	for (const line of colonsOutput.split("\n")) {
		if (!line.startsWith("sec:")) continue;
		const fields = line.split(":");
		const expires = fields[6];
		if (expires && /^\d+$/.test(expires)) {
			return new Date(Number(expires) * 1000).toISOString();
		}
	}
	return null;
}

export function buildSigningDiagnostic(raw: RawSigningInputs): SigningDiagnostic {
	const signingKeyConfigured = !!raw.signingKey;
	const format: SigningDiagnostic["format"] = !signingKeyConfigured ? "none" : raw.gpgFormat === "ssh" ? "ssh" : "gpg";
	const autoSignEnabled = raw.commitGpgsign === "true";

	const warnings: string[] = [];
	if (!autoSignEnabled) warnings.push("commits will be unsigned (commit.gpgsign is not true)");
	if (!signingKeyConfigured) warnings.push("user.signingkey is not configured");
	if (signingKeyConfigured && !raw.keyResolves)
		warnings.push("user.signingkey does not resolve to an existing key/file");
	if (raw.keyExpiry && Date.parse(raw.keyExpiry) < Date.now())
		warnings.push(`signing key has expired (expired ${raw.keyExpiry})`);
	if (format === "gpg" && !raw.agentResponsive) warnings.push("gpg-agent did not respond");
	if (format === "ssh" && !raw.sshAllowedSignersFile)
		warnings.push("gpg.ssh.allowedSignersFile is unset; signature verification will fail");

	return {
		format,
		autoSignEnabled,
		signingKeyConfigured,
		keyResolves: raw.keyResolves,
		agentResponsive: raw.agentResponsive,
		warnings,
	};
}

const FALLBACK_DIAGNOSTIC: SigningDiagnostic = {
	format: "none",
	autoSignEnabled: false,
	signingKeyConfigured: false,
	keyResolves: false,
	agentResponsive: false,
	warnings: ["signing diagnostic unavailable"],
};

/** `git config --get <key>`, degraded to null when unset or unreadable. */
const gitConfig = (key: string): Effect.Effect<string | null, never, Git> =>
	Effect.gen(function* () {
		const git = yield* Git;
		const value = yield* git.configGet(process.cwd(), key);
		return Option.getOrNull(value);
	}).pipe(Effect.orElseSucceed(() => null));

export function readSigningDiagnostic(): Effect.Effect<
	SigningDiagnostic,
	never,
	Git | ChildProcessSpawner.ChildProcessSpawner
> {
	return Effect.gen(function* () {
		const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

		const gpgFormat = yield* gitConfig("gpg.format");
		const commitGpgsign = yield* gitConfig("commit.gpgsign");
		const signingKey = yield* gitConfig("user.signingkey");
		const sshAllowedSignersFile = yield* gitConfig("gpg.ssh.allowedSignersFile");

		const isSsh = gpgFormat === "ssh";
		let keyResolves = false;
		let keyExpiry: string | null = null;

		if (signingKey) {
			if (isSsh) {
				keyResolves = yield* Effect.tryPromise(async () => {
					await stat(signingKey);
					return true;
				}).pipe(Effect.orElseSucceed(() => false));
			} else {
				// A missing gpg binary or unknown key degrades to keyResolves: false.
				const stdout = yield* spawner
					.string(ChildProcess.make("gpg", ["--list-secret-keys", "--with-colons", signingKey]))
					.pipe(Effect.orElseSucceed(() => ""));
				keyResolves = stdout.trim().length > 0;
				keyExpiry = parseGpgKeyExpiry(stdout);
			}
		}

		let agentResponsive = true;
		if (!isSsh) {
			// Mirrors the v3 `execFile("gpg-connect-agent", ["/bye"], { timeout: 1000 })`
			// probe: any non-zero exit, spawn failure, or timeout reads as unresponsive.
			agentResponsive = yield* spawner.exitCode(ChildProcess.make("gpg-connect-agent", ["/bye"])).pipe(
				Effect.timeout("1 second"),
				Effect.map((code) => code === 0),
				Effect.orElseSucceed(() => false),
			);
		}

		return buildSigningDiagnostic({
			gpgFormat,
			commitGpgsign,
			signingKey,
			keyResolves,
			agentResponsive,
			keyExpiry,
			sshAllowedSignersFile,
		});
	}).pipe(Effect.orElseSucceed(() => FALLBACK_DIAGNOSTIC));
}
