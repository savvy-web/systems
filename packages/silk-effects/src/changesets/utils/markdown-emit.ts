/**
 * Canonical markdown emit boundary for the changesets pipeline.
 *
 * @remarks
 * Every place the pipeline turns a markdown tree back into text goes through
 * {@link emitKitMarkdown}, which serializes via `@effected/markdown`'s
 * canonical stringifier. That canonical form is a documented stability
 * commitment of the kit package — ATX headings, `-` bullets, `*`/`**`
 * emphasis markers, `***` thematic breaks, one blank line between blocks,
 * a single trailing newline — so changing it upstream is a breaking change
 * there, never a silent drift. Byte-level assertions on emitted changelogs
 * are therefore safe against this boundary.
 *
 * Input is parsed straight into the kit's node classes with
 * {@link parseKitMarkdown}, which canonicalizes author spellings; the
 * changelog renderer, transforms and lint rules all work on those trees.
 *
 * @internal
 */

import type { FlowContent, Root as KitRoot } from "@effected/markdown";
import { Code, Markdown, MarkdownTransform, Mdast } from "@effected/markdown";
import { Result } from "effect";

/**
 * Unwrap a `Result` from the kit's emit boundary, converting a typed failure
 * into a defect.
 *
 * @remarks
 * The trees this pipeline emits are either parsed by our own parser or
 * synthesized by our own transforms, so a decode or stringify failure is a
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
 * Default `fenceChar` on language-less code nodes so they emit FENCED.
 *
 * @remarks
 * The kit's canonical form emits a code node carrying neither `lang` nor
 * `fenceChar` as an INDENTED block — and that is exactly what a ``` fence with
 * no info string becomes once {@link parseKitMarkdown}'s mdast round trip
 * strips fidelity fields, so without this pass every language-less snippet in
 * changelog content would change shape.
 * Worse, the indented default is neighbor-dependent: the serializer takes a
 * representability escape back to a backtick fence when the indented form
 * would misparse (e.g. code immediately after a list), so the same node
 * spells differently depending on what precedes it — inconsistent raw
 * output. House policy is fenced code everywhere, so the ONE emit boundary defaults
 * the kit's own per-node fidelity field, `fenceChar`, at emit time.
 * `MarkdownTransform.map` rebuilds only the paths to a changed
 * code node; every other subtree is returned by reference.
 *
 * @internal
 */
function ensureFencedCode<N extends KitRoot | FlowContent>(node: N): N {
	return MarkdownTransform.map(node, {
		code: (code) =>
			code.lang === undefined && code.fenceChar === undefined ? new Code({ ...code, fenceChar: "`" }) : code,
	});
}

/**
 * Parse markdown text straight into `@effected/markdown`'s node classes (GFM
 * dialect, frontmatter capture off).
 *
 * @remarks
 * Synchronous because every call site is a sync string pipeline; the kit's parser
 * is total over text, so a failure here is a defect (the nesting-depth
 * hardening guard), not an operational condition.
 *
 * @param text - The markdown source
 * @returns The parsed kit root
 *
 * @internal
 */
export function parseKitMarkdown(text: string): KitRoot {
	const parsed = unwrap(Markdown.parseResult(text), "markdown parse: canonical parse failed");
	// The kit parser records author spellings (`*`/`+` bullets, `1)`
	// delimiters, `~~~` fences, `_` emphasis, `---` breaks, setext headings)
	// as fidelity fields that the emitter honours; the mdast round trip strips
	// them so output stays canonical.
	return unwrap(Mdast.fromMdastResult(Mdast.toMdast(parsed)), "markdown parse: fidelity strip failed");
}

/**
 * Serialize a kit root, or a single kit block node, to canonical markdown.
 *
 * @remarks
 * Applies the fence normalization, then `Markdown.stringifyResult`. A lone block node emits byte-identically
 * to a one-child root, trailing newline included.
 *
 * @param node - The kit root or block node to serialize
 * @returns Canonical markdown text
 *
 * @internal
 */
export function emitKitMarkdown(node: KitRoot | FlowContent): string {
	return unwrap(Markdown.stringifyResult(ensureFencedCode(node)), "markdown emit: canonical stringify failed");
}
