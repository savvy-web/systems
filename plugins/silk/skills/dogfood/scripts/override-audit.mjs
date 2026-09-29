#!/usr/bin/env node
// Warns when a dogfood `file:`/`link:` override's target package would have
// resolved fine from the registry anyway (savvy-web/systems#519, deferred from
// #425).
//
// An over-derived closure is silent and wider than the loop: pnpm overrides
// are GLOBAL, so one unnecessary entry redirects every reference to that
// package across the whole tree — including packages belonging to unrelated
// in-flight work — and substitutes whatever stale build happens to sit in the
// sibling's dist/prod. This audit makes the accidental case visible at the two
// moments the closure is being decided (--init step 3, --adopt after a closure
// change), while a wrong entry is still cheap to remove.
//
// Warn, never fail: a deliberate override of a package that also exists on the
// registry is the normal mid-loop state once the upstream has published an
// older version. Exit 0 whether or not warnings were printed; exit 2 only for
// usage/read errors. Network access is action-time and explicit (the repo package manager's view command),
// invoked by --init/--adopt per the skill — never from the background monitor.
//
// usage: override-audit.mjs [path/to/pnpm-workspace.yaml]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const PRUNED_DIRS = new Set([".claude", ".git", ".repos", "dist", "node_modules"]);

const workspaceYamlPath = resolve(process.argv[2] ?? "pnpm-workspace.yaml");
if (!existsSync(workspaceYamlPath)) {
	console.error(`override-audit: ${workspaceYamlPath} not found`);
	process.exit(2);
}
const workspaceDir = dirname(workspaceYamlPath);

// Extract `file:`/`link:` entries from the top-level `overrides:` block. The
// block's entries are written by this protocol (`"@scope/name": "file:<path>"`),
// so a line-oriented scan over that controlled shape beats a YAML dependency
// this script cannot have. Commented-out entries are skipped on purpose —
// --exit tolerates commenting instead of deleting, and a commented entry is
// inert.
function parseLocalOverrides(yamlText) {
	const entries = [];
	const lines = yamlText.split("\n");
	let inBlock = false;
	for (const line of lines) {
		if (/^overrides:\s*(#.*)?$/.test(line)) {
			inBlock = true;
			continue;
		}
		if (inBlock) {
			if (/^\S/.test(line)) break; // dedent back to top level ends the block
			const trimmed = line.trim();
			if (trimmed === "" || trimmed.startsWith("#")) continue;
			const match = trimmed.match(/^["']?([^"':\s]+)["']?\s*:\s*["']?((?:file|link):[^"'\n]+?)["']?\s*(?:#.*)?$/);
			if (match) entries.push({ name: match[1], override: match[2] });
		}
	}
	return entries;
}

// Registry-shaped ranges the workspace's own manifests declare for a package —
// the ranges pnpm would consult if the override were absent. Protocol-shaped
// specifiers (workspace:/file:/link:/catalog:) are not registry ranges and are
// skipped.
function collectDeclaredRanges(dir, packageName, ranges) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!PRUNED_DIRS.has(entry.name)) collectDeclaredRanges(join(dir, entry.name), packageName, ranges);
			continue;
		}
		if (entry.name !== "package.json") continue;
		let manifest;
		try {
			manifest = JSON.parse(readFileSync(join(dir, entry.name), "utf8"));
		} catch {
			continue;
		}
		for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
			const range = manifest[field]?.[packageName];
			if (typeof range === "string" && !/^(workspace|file|link|catalog):/.test(range)) ranges.add(range);
		}
	}
}

// Which package manager the audited repo uses. The probe asks the registry
// through THAT manager's own view command, not a bare `npm view`: npm 11
// enforces `devEngines.packageManager` and fails every probe inside a pnpm repo
// with EBADDEVENGINES (savvy-web/systems#713). Order: devEngines, then the
// `packageManager` field, then a lockfile, then npm.
const KNOWN_MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);
function detectPackageManager(dir) {
	let manifest = {};
	try {
		manifest = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
	} catch {
		// no readable root manifest — fall through to the lockfile check
	}
	const devEngine = manifest.devEngines?.packageManager;
	for (const entry of Array.isArray(devEngine) ? devEngine : [devEngine]) {
		if (KNOWN_MANAGERS.has(entry?.name)) return { name: entry.name, source: "devEngines.packageManager" };
	}
	if (typeof manifest.packageManager === "string") {
		const name = manifest.packageManager.split("@")[0];
		if (KNOWN_MANAGERS.has(name)) return { name, source: "packageManager field" };
	}
	for (const [file, name] of [
		["pnpm-lock.yaml", "pnpm"],
		["yarn.lock", "yarn"],
		["bun.lock", "bun"],
		["bun.lockb", "bun"],
		["package-lock.json", "npm"],
	]) {
		if (existsSync(join(dir, file))) return { name, source: file };
	}
	return { name: "npm", source: "default" };
}
const packageManager = detectPackageManager(workspaceDir);

function run(command, args, cwd) {
	try {
		const stdout = execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], cwd });
		return { ok: true, stdout };
	} catch (error) {
		const text = (value) => (typeof value === "string" ? value : (value?.toString?.() ?? ""));
		// pnpm and bun print their JSON error on stdout, so judge both streams.
		return { ok: false, missing: error?.code === "ENOENT", output: `${text(error?.stdout)}\n${text(error?.stderr)}` };
	}
}

// Probe commands per manager. pnpm and bun run from the repo (bun needs a
// package.json; each is the repo's own manager, so nothing is enforced against
// it). Yarn Berry's `yarn npm info` does NOT resolve semver ranges (an
// unsatisfiable range still answers with the latest version), so it is unusable
// as an oracle; yarn repos probe through npm from outside the repo, the same
// route as the fallback. npm runs from the repo only when npm IS the repo's
// manager, so a project `.npmrc` (a private registry for a scope) still applies;
// otherwise it runs from the OS tmpdir, out of reach of the repo's devEngines.
function probeCommand(manager, spec, repoDir) {
	if (manager === "pnpm") return { command: "pnpm", args: ["view", spec, "version", "--json"], cwd: repoDir };
	if (manager === "bun") return { command: "bun", args: ["info", spec, "version", "--json"], cwd: repoDir };
	const cwd = packageManager.name === "npm" ? repoDir : tmpdir();
	return { command: "npm", args: ["view", spec, "version", "--json"], cwd };
}

// Ask the registry whether any published version satisfies the range. The
// manager's view command does the semver math server-side: empty output or a
// "no matching version" answer means no published version satisfies, and a
// 404 means the package is not on the registry at all — both are definitive
// "the override is doing real work" answers ({ status: "none" }). Any other
// failure (binary missing, DNS, registry outage) is NOT an answer: it comes back
// as { status: "unavailable", cause, attempts } so the audit reports the probe
// as unverified instead of claiming a clean result it never obtained. When the
// detected manager's binary is missing or its probe fails, npm from the tmpdir
// is tried before giving up.
function registryVersionSatisfying(packageName, range) {
	const spec = `${packageName}@${range}`;
	const managers =
		packageManager.name === "pnpm" || packageManager.name === "bun" ? [packageManager.name, "npm"] : ["npm"];
	const attempts = [];
	let last;
	for (const manager of managers) {
		const { command, args, cwd } = probeCommand(manager, spec, workspaceDir);
		const result = run(command, args, cwd);
		attempts.push(`${command} ${args.join(" ")}`);
		if (result.ok) return interpret(result.stdout);
		if (
			/E404|404 Not Found|ERR_PNPM_FETCH_404|ERR_PNPM_PACKAGE_NOT_FOUND|No matching version found/i.test(result.output)
		) {
			return { status: "none" };
		}
		let cause = "other";
		if (/EBADDEVENGINES/.test(result.output)) cause = "devengines";
		else if (result.missing) cause = "binary-missing";
		last = { status: "unavailable", cause, attempts };
	}
	return last;
}

function interpret(stdout) {
	if (stdout.trim() === "") return { status: "none" };
	try {
		const parsed = JSON.parse(stdout);
		if (typeof parsed === "string") return { status: "found", version: parsed };
		if (Array.isArray(parsed) && parsed.length > 0) return { status: "found", version: parsed[parsed.length - 1] };
	} catch {
		return { status: "unavailable", cause: "other", attempts: [] };
	}
	return { status: "none" };
}

const overrides = parseLocalOverrides(readFileSync(workspaceYamlPath, "utf8"));
if (overrides.length === 0) {
	console.log("override-audit: no file:/link: overrides in the overrides: block — nothing to audit");
	process.exit(0);
}

let warnings = 0;
let unverified = 0;
for (const { name, override } of overrides) {
	const linkPath = resolve(workspaceDir, override.replace(/^(?:file|link):/, ""));
	let localVersion = "unreadable";
	try {
		localVersion = JSON.parse(readFileSync(join(linkPath, "package.json"), "utf8")).version ?? "unversioned";
	} catch {
		console.log(
			`override-audit: WARNING — ${name} links ${override} but no manifest is readable there (stale or never-built artifact?)`,
		);
		warnings += 1;
	}
	const ranges = new Set();
	collectDeclaredRanges(workspaceDir, name, ranges);
	const probes = [...ranges].map((range) => ({ range, result: registryVersionSatisfying(name, range) }));

	// A pnpm override is GLOBAL: one consumer resolving from the registry does
	// not make the override unnecessary while another consumer's range still
	// needs the linked build. Warn only when EVERY declared range has a
	// satisfying published version — and a failed probe forfeits the claim
	// entirely, because "unverified" is not "satisfied".
	const causes = {
		devengines: "EBADDEVENGINES — a devEngines.packageManager constraint is being enforced against npm",
		"binary-missing": "the package manager binary was not found on PATH",
		other: "network or registry error",
	};
	for (const { range, result } of probes) {
		if (result.status === "unavailable") {
			const tried =
				result.attempts.length > 0 ? result.attempts.map((c) => `\`${c}\``).join(", then ") : "the registry probe";
			console.log(
				`override-audit: UNVERIFIED — could not probe the registry for ${name}@${range} (repo package manager: ${packageManager.name} via ${packageManager.source}; tried ${tried}: ${causes[result.cause] ?? causes.other}). This is not a clean audit result for ${name}.`,
			);
			unverified += 1;
		}
	}
	if (probes.length > 0 && probes.every(({ result }) => result.status === "found")) {
		const pairs = probes.map(({ range, result }) => `${result.version} satisfying '${range}'`).join(", ");
		console.log(
			`override-audit: WARNING — ${name} is overridden to ${override} (local artifact ${localVersion}), but the registry already serves ${pairs} — every range its consumers declare. If this entry was not a deliberate link, it is redirecting every reference in the tree to a possibly-stale local build.`,
		);
		warnings += 1;
	}
}

console.log(
	`override-audit: ${overrides.length} override(s) audited, ${warnings} warning(s), ${unverified} unverified probe(s)`,
);
process.exit(0);
