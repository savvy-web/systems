import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTarget } from "fake-dynamic-pkg";

async function main(): Promise<void> {
	// Resolved relative to the running bundle's own location (dist/main.js),
	// not the original source file — exactly the kind of runtime-computed,
	// non-literal path a fully dynamic import(expr) has to handle for real.
	const targetPath = join(dirname(fileURLToPath(import.meta.url)), "..", "targets", "value.mjs");
	const mod = (await loadTarget(targetPath)) as { value: string };
	process.stdout.write(`value=${mod.value}\n`);
}

await main();
