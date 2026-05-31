/**
 * Resolve the commitlint config path used by the husky commit-msg hook.
 *
 * The husky hook is the source of truth: `init` writes the chosen path into
 * its managed section as `--config "$ROOT/<path>"`. The post-commit verifier
 * extracts that same path so its replay matches the committed-time invocation.
 *
 * @internal
 */
import { readFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";

const CONFIG_FLAG_RE = /--config\s+(?:"([^"]+)"|'([^']+)'|(\S+))/;
// biome-ignore lint/suspicious/noTemplateCurlyInString: literal bash variable syntax
const ROOT_PREFIXES = ["$ROOT/", "${ROOT}/"];

export function parseHuskyConfigPath(huskyContent: string, root: string): string | null {
	const m = huskyContent.match(CONFIG_FLAG_RE);
	if (!m) return null;
	let raw = m[1] ?? m[2] ?? m[3] ?? "";
	if (!raw) return null;
	for (const prefix of ROOT_PREFIXES) {
		if (raw.startsWith(prefix)) {
			raw = raw.slice(prefix.length);
			break;
		}
	}
	return isAbsolute(raw) ? raw : resolve(root, raw);
}

export async function readCommitlintConfigPath(root: string): Promise<string | null> {
	try {
		const content = await readFile(join(root, ".husky/commit-msg"), "utf8");
		return parseHuskyConfigPath(content, root);
	} catch {
		return null;
	}
}
