#!/usr/bin/env node
// Background monitor: polls dist/<target>/issues.json artifacts and prints one
// notification line per package when its ae-*/tsdoc- count becomes non-zero or changes.
import { globSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const TSDOC_CODE = /^(ae-|tsdoc-)/;

function countTsdocIssues(issues) {
	const all = [...(issues?.warnings ?? []), ...(issues?.errors ?? [])];
	return all.filter((d) => typeof d?.code === "string" && TSDOC_CODE.test(d.code)).length;
}

async function scan() {
	const files = globSync(["**/dist/dev/issues.json", "**/dist/prod/issues.json"], {
		cwd: ROOT,
		exclude: (p) => p.includes("node_modules"),
	});
	const current = [];
	for (const rel of files) {
		const path = join(ROOT, rel);
		try {
			const issues = JSON.parse(await readFile(path, "utf8"));
			current.push({
				path,
				pkg: typeof issues?.package === "string" ? issues.package : rel,
				target: typeof issues?.target === "string" ? issues.target : "?",
				count: countTsdocIssues(issues),
			});
		} catch {
			// partial write / parse error — skip and retry on the next poll
		}
	}
	return current;
}

function diagnose(current, prev) {
	const lines = [];
	const next = new Map(prev);
	for (const c of current) {
		const before = prev.get(c.path);
		next.set(c.path, c.count);
		if (c.count > 0 && c.count !== before) {
			const plural = c.count === 1 ? "" : "s";
			lines.push(
				`tsdoc: ${c.pkg} has ${c.count} ae-*/tsdoc- issue${plural} in ${c.target} — dispatch the tsdoctor agent or /silk:tsdoc to fix`,
			);
		}
	}
	return { lines, next };
}

async function main() {
	const once = process.argv.includes("--once");
	let prev = new Map();
	const tick = async () => {
		try {
			const { lines, next } = diagnose(await scan(), prev);
			prev = next;
			for (const line of lines) console.log(line);
		} catch {
			// never crash the session
		}
	};
	await tick();
	if (!once) setInterval(tick, 2000);
}

await main();
