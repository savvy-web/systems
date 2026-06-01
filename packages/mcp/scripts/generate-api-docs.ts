/**
 * Generate `source: generated` API-reference markdown into the resource corpus
 * from each target package's API Extractor model. Ephemeral: output lands under
 * content/packages/<dir>/api/** (gitignored) and is recompiled into the manifest
 * by build:catalog. Missing models are skipped with a warning so a bare install
 * (which runs `prepare: turbo run build:dev`) never fails.
 *
 * @internal
 */

import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ApiItemRef, DocMeta } from "api-extractor-llms";
import { loadApiModel, renderPackage } from "api-extractor-llms";
import type { ApiTarget } from "./api-targets.js";
import { API_TARGETS } from "./api-targets.js";

const here = dirname(fileURLToPath(import.meta.url));
const packagesRoot = join(here, "..", ".."); // packages/mcp/scripts -> packages/
const contentRoot = join(here, "..", "src", "resources", "content");

export interface GeneratedFrontMatter {
	readonly id: string;
	readonly title: string;
	readonly summary: string;
	readonly tier: "packages";
	readonly source: "generated";
	readonly tags: ReadonlyArray<string>;
	readonly priority: number;
	readonly related: ReadonlyArray<string>;
}

const truncate = (s: string, max = 160): string => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

/** Pure: derive the structured front-matter for one rendered item's metadata. */
export function frontMatterFor(
	target: ApiTarget,
	meta: Pick<DocMeta, "name" | "kind" | "slug" | "summary">,
): GeneratedFrontMatter {
	const summary = meta.summary.trim() || `${meta.kind} ${meta.name} from ${target.packageName}.`;
	return {
		id: `${target.idPrefix}/api/${meta.kind}/${meta.slug}`,
		title: `${meta.name} — ${target.dir} ${meta.kind}`,
		summary: truncate(summary),
		tier: "packages",
		source: "generated",
		tags: [target.dir, "api"],
		priority: 0.3,
		related: [],
	};
}

/** Serialize the structured front-matter to a YAML block (incl. trailing blank line). */
const toYaml = (fm: GeneratedFrontMatter): string =>
	[
		"---",
		`id: ${fm.id}`,
		`title: ${JSON.stringify(fm.title)}`,
		`summary: ${JSON.stringify(fm.summary)}`,
		`tier: ${fm.tier}`,
		`source: ${fm.source}`,
		`tags: [${fm.tags.join(", ")}]`,
		`priority: ${fm.priority}`,
		"related: []",
		"---",
		"",
		"",
	].join("\n");

/** The mcp crosslink scheme: silk:// URIs within this target's api namespace. */
const routeForTarget =
	(target: ApiTarget) =>
	(ref: ApiItemRef): string =>
		`silk://${target.idPrefix}/api/${ref.kind}/${ref.slug}`;

/** Probe dist/dev then dist/npm for a target's emitted model. */
function findModel(target: ApiTarget): string | undefined {
	for (const env of ["dev", "npm"]) {
		const candidate = join(packagesRoot, target.dir, "dist", env, target.modelBasename);
		if (existsSync(candidate)) return candidate;
	}
	return undefined;
}

async function generateTarget(target: ApiTarget): Promise<number> {
	const modelPath = findModel(target);
	const outDir = join(contentRoot, "packages", target.dir, "api");
	// Always clear stale output so a removed export does not leave an orphan doc.
	if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
	if (modelPath === undefined) {
		process.stderr.write(`[generate-api-docs] SKIP ${target.packageName}: no model (build it first)\n`);
		return 0;
	}
	const pkg = await loadApiModel(modelPath);
	// Inject the two consumer-specific services; the shared system returns docs
	// whose markdown already includes the silk front-matter and silk:// crosslinks.
	const docs = renderPackage(pkg, {
		packageName: target.packageName,
		routeFor: routeForTarget(target),
		frontmatter: (meta) => toYaml(frontMatterFor(target, meta)),
	});
	for (const doc of docs) {
		const fileDir = join(outDir, doc.kind);
		mkdirSync(fileDir, { recursive: true });
		writeFileSync(join(fileDir, `${doc.slug}.md`), doc.markdown);
	}
	process.stderr.write(`[generate-api-docs] ${target.packageName}: ${docs.length} docs\n`);
	return docs.length;
}

async function main(): Promise<void> {
	let total = 0;
	for (const target of API_TARGETS) total += await generateTarget(target);
	process.stderr.write(`[generate-api-docs] wrote ${total} generated docs\n`);
}

// Only run as a script, not when imported by tests.
if (basename(process.argv[1] ?? "") === "generate-api-docs.ts") {
	main().catch((err) => {
		process.stderr.write(`generate-api-docs: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
		process.exit(1);
	});
}
