/**
 * Canonical markdown emit boundary for the changesets pipeline.
 *
 * @remarks
 * Every place the pipeline turns an MDAST tree back into markdown text goes
 * through {@link emitMarkdown}, which serializes via `@effected/markdown`'s
 * canonical stringifier. That canonical form is a documented stability
 * commitment of the kit package — ATX headings, `-` bullets, `*`/`**`
 * emphasis markers, `***` thematic breaks, one blank line between blocks,
 * a single trailing newline — so changing it upstream is a breaking change
 * there, never a silent drift. Byte-level assertions on emitted changelogs
 * are therefore safe against this boundary.
 *
 * Parsing stays on remark-parse/remark-gfm (see `remark-pipeline.ts`); plain
 * mdast trees cross into the kit's node classes through `Mdast.fromMdast`,
 * which synthesizes sentinel positions for synthesized nodes.
 *
 * @internal
 */

import type { Root as KitRoot } from "@effected/markdown";
import { Markdown, Mdast } from "@effected/markdown";
import { Result } from "effect";
import type { Root } from "mdast";

/**
 * Unwrap a `Result` from the kit's emit boundary, converting a typed failure
 * into a defect.
 *
 * @remarks
 * The trees this pipeline emits are either parsed by our own remark pipeline
 * or synthesized by our own plugins, so a decode or stringify failure is a
 * programmer error, not an operational condition — the sync call sites treat
 * it as a defect with the typed error preserved as `cause`.
 *
 * @internal
 */
function unwrap<A, E extends { message: string }>(result: Result.Result<A, E>, context: string): A {
	if (Result.isFailure(result)) {
		const error = result.failure;
		throw new Error(`${context}: ${error.message}`, { cause: error });
	}
	return result.success;
}

/**
 * Structural shape of a decoded node during the fence-normalization walk.
 *
 * @internal
 */
interface WalkNode {
	readonly type?: string;
	readonly lang?: string;
	readonly fenceChar?: string;
	readonly children?: readonly WalkNode[];
}

/**
 * Default `fenceChar` on language-less code nodes so they emit FENCED.
 *
 * @remarks
 * The kit's canonical form emits a code node carrying neither `lang` nor
 * `fenceChar` as an INDENTED block — and `lang: null` is exactly what
 * remark-parse produces for a ``` fence with no info string, so without this
 * pass every language-less snippet in changelog content would change shape.
 * Worse, the indented default is neighbor-dependent: the serializer takes a
 * representability escape back to a backtick fence when the indented form
 * would misparse (e.g. code immediately after a list), so the same node
 * spells differently depending on what precedes it — inconsistent raw
 * output. House policy is fenced code everywhere, so the ONE emit boundary defaults
 * the kit's own per-node fidelity field, `fenceChar`, post-decode. It has to
 * happen post-decode: `Mdast.fromMdast` drops non-mdast fields from foreign
 * trees, so a `fenceChar` set on the plain tree would never survive the
 * boundary. Nodes are copied only where a default is applied; everything
 * else is returned by reference.
 *
 * @internal
 */
function ensureFencedCode(node: WalkNode): WalkNode {
	let result = node;
	const children = node.children;
	if (children !== undefined) {
		const mapped = children.map(ensureFencedCode);
		if (mapped.some((child, index) => child !== children[index])) {
			result = { ...node, children: mapped };
		}
	}
	if (result.type === "code" && result.lang === undefined && result.fenceChar === undefined) {
		return { ...result, fenceChar: "`" };
	}
	return result;
}

/**
 * Serialize a plain MDAST tree to canonical markdown.
 *
 * @remarks
 * The single emit chokepoint for the changesets pipeline: decodes the plain
 * mdast tree into `@effected/markdown`'s node classes via
 * `Mdast.fromMdastResult` and serializes it with `Markdown.stringifyResult`.
 * Synchronous on purpose — every call site is a sync string pipeline — and
 * failures (an undecodable node type, the nesting-depth hardening guard) are
 * defects on self-built trees, so they throw rather than surface typed.
 *
 * The output always ends with exactly one trailing newline, matching the
 * kit's document-level canonical rule.
 *
 * @param tree - The plain mdast root to serialize
 * @returns Canonical markdown text
 *
 * @internal
 */
export function emitMarkdown(tree: Root): string {
	const decoded = unwrap(Mdast.fromMdastResult(tree), "markdown emit: mdast tree failed to decode");
	const fenced = ensureFencedCode(decoded as WalkNode) as KitRoot;
	return unwrap(Markdown.stringifyResult(fenced), "markdown emit: canonical stringify failed");
}
