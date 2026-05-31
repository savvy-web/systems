/**
 * GPG / SSH signing diagnostic.
 *
 * @internal
 */
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";
import { Effect } from "effect";

const execFileP = promisify(execFile);

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

async function gitConfig(key: string): Promise<string | null> {
	try {
		const { stdout } = await execFileP("git", ["config", "--get", key]);
		const v = stdout.trim();
		return v.length > 0 ? v : null;
	} catch {
		return null;
	}
}

const FALLBACK_DIAGNOSTIC: SigningDiagnostic = {
	format: "none",
	autoSignEnabled: false,
	signingKeyConfigured: false,
	keyResolves: false,
	agentResponsive: false,
	warnings: ["signing diagnostic unavailable"],
};

export function readSigningDiagnostic(): Effect.Effect<SigningDiagnostic> {
	return Effect.tryPromise(async () => {
		const gpgFormat = await gitConfig("gpg.format");
		const commitGpgsign = await gitConfig("commit.gpgsign");
		const signingKey = await gitConfig("user.signingkey");
		const sshAllowedSignersFile = await gitConfig("gpg.ssh.allowedSignersFile");

		const isSsh = gpgFormat === "ssh";
		let keyResolves = false;
		let keyExpiry: string | null = null;

		if (signingKey) {
			if (isSsh) {
				try {
					await stat(signingKey);
					keyResolves = true;
				} catch {
					keyResolves = false;
				}
			} else {
				try {
					const { stdout } = await execFileP("gpg", ["--list-secret-keys", "--with-colons", signingKey]);
					keyResolves = stdout.trim().length > 0;
					keyExpiry = parseGpgKeyExpiry(stdout);
				} catch {
					keyResolves = false;
				}
			}
		}

		let agentResponsive = true;
		if (!isSsh) {
			try {
				await execFileP("gpg-connect-agent", ["/bye"], { timeout: 1000 });
			} catch {
				agentResponsive = false;
			}
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
