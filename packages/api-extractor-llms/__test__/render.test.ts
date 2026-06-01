// packages/api-extractor-llms/__test__/render.test.ts
import { describe, expect, it } from "vitest";

import { renderItem, renderPackage } from "../src/render.js";

// Minimal ApiFunction-shaped fixture. The renderer reads: kind, displayName,
// excerpt.{text,spannedTokens}, and (via tsdoc helpers) instanceof checks that
// fail gracefully → empty summary/params for a plain object.
// Note: spannedTokens mimics real API Extractor structure where the first token
// contains the full "export declare <keyword> " prefix so TypeSignatureFormatter
// can strip it in one pass.
const fn = (name: string, sig: string) => ({
	kind: "Function",
	displayName: name,
	excerpt: { text: sig, spannedTokens: [{ text: sig }] },
	members: [],
});

describe("renderItem", () => {
	it("renders an H1 and a fenced signature (no frontmatter, no crosslinks)", () => {
		const md = renderItem(fn("doThing", "export declare function doThing(): void") as never, {
			packageName: "@x/y",
		});
		expect(md).toMatch(/^# doThing/m);
		expect(md).toMatch(/```ts\nfunction doThing\(\): void\n```/);
	});
});

describe("renderPackage", () => {
	const pkg = {
		entryPoints: [{ members: [fn("doThing", "export declare function doThing(): void")] }],
	};

	it("produces one RenderedDoc per top-level member with a kind slug", () => {
		const docs = renderPackage(pkg as never, { packageName: "@x/y" });
		expect(docs).toHaveLength(1);
		expect(docs[0]).toMatchObject({ name: "doThing", kind: "function", slug: "dothing" });
		expect(docs[0].markdown).toMatch(/# doThing/);
	});

	it("prepends injected frontmatter and assembles it onto the body", () => {
		const docs = renderPackage(pkg as never, {
			packageName: "@x/y",
			frontmatter: (meta) => `---\nid: ${meta.kind}/${meta.slug}\n---\n\n`,
		});
		expect(docs[0].markdown.startsWith("---\nid: function/dothing\n---\n\n# doThing")).toBe(true);
	});
});
