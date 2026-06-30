import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "@savvy-web/bundler";

// Deterministic optimistic rewrite seam: the test writes next-versions.json into the
// fixture before spawning; absent file -> no optimistic rewrite.
const nvPath = join(import.meta.dirname, "next-versions.json");
let resolveNextVersions: undefined | (() => Promise<{ root: string; versions: Map<string, string> }>);
try {
	const entries = JSON.parse(readFileSync(nvPath, "utf-8")) as Record<string, string>;
	resolveNextVersions = async () => ({ root: import.meta.dirname, versions: new Map(Object.entries(entries)) });
} catch {
	resolveNextVersions = undefined;
}

await build({ meta: { localPaths: ["models"], optimistic: true } }, resolveNextVersions ? { resolveNextVersions } : {});
