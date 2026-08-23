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
// usage/read errors. Network access is action-time and explicit (`npm view`),
// invoked by --init/--adopt per the skill — never from the background monitor.
//
// usage: override-audit.mjs [path/to/pnpm-workspace.yaml]

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
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

// Ask the registry whether any published version satisfies the range. `npm
// view '<pkg>@<range>' version --json` does the semver math server-side: empty
// output means no published version satisfies; a 404 means the package is not
// on the registry at all. Both are "the override is doing real work".
function registryVersionSatisfying(packageName, range) {
	let stdout;
	try {
		stdout = execFileSync("npm", ["view", `${packageName}@${range}`, "version", "--json"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
	} catch {
		return undefined;
	}
	if (stdout.trim() === "") return undefined;
	try {
		const parsed = JSON.parse(stdout);
		if (typeof parsed === "string") return parsed;
		if (Array.isArray(parsed) && parsed.length > 0) return parsed[parsed.length - 1];
	} catch {
		return undefined;
	}
	return undefined;
}

const overrides = parseLocalOverrides(readFileSync(workspaceYamlPath, "utf8"));
if (overrides.length === 0) {
	console.log("override-audit: no file:/link: overrides in the overrides: block — nothing to audit");
	process.exit(0);
}

let warnings = 0;
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
	for (const range of ranges) {
		const satisfied = registryVersionSatisfying(name, range);
		if (satisfied !== undefined) {
			console.log(
				`override-audit: WARNING — ${name} is overridden to ${override} (local artifact ${localVersion}), but the registry already serves ${satisfied} satisfying the declared range '${range}'. If this entry was not a deliberate link, it is redirecting every reference in the tree to a possibly-stale local build.`,
			);
			warnings += 1;
		}
	}
}

console.log(`override-audit: ${overrides.length} override(s) audited, ${warnings} warning(s)`);
process.exit(0);
