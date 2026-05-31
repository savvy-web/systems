import { describe, expect, it } from "vitest";
import { buildSigningDiagnostic, parseGpgKeyExpiry } from "../../../../src/commitlint/hook/diagnostics/signing.js";

describe("parseGpgKeyExpiry", () => {
	it("returns null when --with-colons output has no expiry", () => {
		const out =
			"sec:u:4096:1:ABCDEF1234567890:1700000000::u:::scESC:::::::::\n" +
			"fpr:::::::::ABCDEF1234567890ABCDEF1234567890ABCDEF12:\n";
		expect(parseGpgKeyExpiry(out)).toBeNull();
	});

	it("returns the expiry timestamp when present", () => {
		// sec:<trust>:<size>:<algo>:<keyid>:<created>:<expires>:...
		const out = "sec:u:4096:1:ABCDEF1234567890:1700000000:1900000000:u:::scESC:::::::::\n";
		expect(parseGpgKeyExpiry(out)).toBe(new Date(1900000000 * 1000).toISOString());
	});
});

describe("buildSigningDiagnostic (pure builder)", () => {
	it("marks unsigned when commit.gpgsign is false", () => {
		const d = buildSigningDiagnostic({
			gpgFormat: "gpg",
			commitGpgsign: "false",
			signingKey: "ABCDEF",
			keyResolves: true,
			agentResponsive: true,
			keyExpiry: null,
			sshAllowedSignersFile: null,
		});
		expect(d.autoSignEnabled).toBe(false);
		expect(d.warnings).toContain("commits will be unsigned (commit.gpgsign is not true)");
	});

	it("warns about expired GPG key", () => {
		const d = buildSigningDiagnostic({
			gpgFormat: "gpg",
			commitGpgsign: "true",
			signingKey: "ABCDEF",
			keyResolves: true,
			agentResponsive: true,
			keyExpiry: new Date(Date.now() - 86_400_000).toISOString(),
			sshAllowedSignersFile: null,
		});
		expect(d.warnings.some((w) => w.includes("expired"))).toBe(true);
	});

	it("warns when SSH allowedSignersFile is unset", () => {
		const d = buildSigningDiagnostic({
			gpgFormat: "ssh",
			commitGpgsign: "true",
			signingKey: "/Users/x/.ssh/id_ed25519.pub",
			keyResolves: true,
			agentResponsive: true,
			keyExpiry: null,
			sshAllowedSignersFile: null,
		});
		expect(d.warnings.some((w) => w.includes("allowedSignersFile"))).toBe(true);
	});

	it("clean state has no warnings", () => {
		const d = buildSigningDiagnostic({
			gpgFormat: "gpg",
			commitGpgsign: "true",
			signingKey: "ABCDEF",
			keyResolves: true,
			agentResponsive: true,
			keyExpiry: null,
			sshAllowedSignersFile: null,
		});
		expect(d.warnings).toEqual([]);
	});

	it("warns when gpg-agent is unresponsive", () => {
		const d = buildSigningDiagnostic({
			gpgFormat: "gpg",
			commitGpgsign: "true",
			signingKey: "ABCDEF",
			keyResolves: true,
			agentResponsive: false,
			keyExpiry: null,
			sshAllowedSignersFile: null,
		});
		expect(d.warnings).toContain("gpg-agent did not respond");
	});

	it("warns when key does not resolve", () => {
		const d = buildSigningDiagnostic({
			gpgFormat: "gpg",
			commitGpgsign: "true",
			signingKey: "ABCDEF",
			keyResolves: false,
			agentResponsive: true,
			keyExpiry: null,
			sshAllowedSignersFile: null,
		});
		expect(d.warnings).toContain("user.signingkey does not resolve to an existing key/file");
	});

	it("reports format=none when no signing key configured", () => {
		const d = buildSigningDiagnostic({
			gpgFormat: null,
			commitGpgsign: "false",
			signingKey: null,
			keyResolves: false,
			agentResponsive: false,
			keyExpiry: null,
			sshAllowedSignersFile: null,
		});
		expect(d.format).toBe("none");
		expect(d.signingKeyConfigured).toBe(false);
		expect(d.warnings).toContain("user.signingkey is not configured");
	});
});
