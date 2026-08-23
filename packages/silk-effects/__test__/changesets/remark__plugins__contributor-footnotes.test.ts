import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";

import { ContributorFootnotesPlugin } from "../../src/changesets/remark/plugins/contributor-footnotes.js";
import { SilkChangesetTransformPreset } from "../../src/changesets/remark/presets.js";

function transform(md: string): string {
	return String(
		unified().use(remarkParse).use(remarkGfm).use(ContributorFootnotesPlugin).use(remarkStringify).processSync(md),
	);
}

function transformFull(md: string): string {
	const processor = unified().use(remarkParse).use(remarkGfm);
	for (const plugin of SilkChangesetTransformPreset) {
		processor.use(plugin);
	}
	return String(processor.use(remarkStringify).processSync(md));
}

describe("contributor-footnotes", () => {
	it("is a no-op when no attributions exist", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X\n";
		const result = transform(md);
		expect(result).not.toContain("Thanks to");
		expect(result).not.toContain("contributions");
	});

	it("extracts a single contributor with link", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X Thanks [@alice](https://github.com/alice)!\n";
		const result = transform(md);
		expect(result).toContain("Thanks to");
		expect(result).toContain("@alice");
		expect(result).toContain("contributions");
		// Attribution should be removed from the list item
		expect(result).not.toMatch(/Thanks \[@alice\]/);
	});

	it("extracts a single contributor without link", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X Thanks @bob!\n";
		const result = transform(md);
		expect(result).toContain("Thanks to");
		expect(result).toContain("@bob");
		expect(result).toContain("contributions");
	});

	it("deduplicates the same contributor from multiple items", () => {
		const md =
			"## 1.0.0\n\n### Features\n\n- Added X Thanks [@alice](https://github.com/alice)!\n- Added Y Thanks [@alice](https://github.com/alice)!\n";
		const result = transform(md);
		// @alice should appear only once in the contributors paragraph
		const thanksSection = result.slice(result.indexOf("Thanks to"));
		const aliceCount = (thanksSection.match(/@alice/g) || []).length;
		expect(aliceCount).toBe(1);
	});

	it("aggregates multiple contributors", () => {
		const md =
			"## 1.0.0\n\n### Features\n\n- Added X Thanks [@alice](https://github.com/alice)!\n- Fixed Y Thanks [@bob](https://github.com/bob)!\n";
		const result = transform(md);
		expect(result).toContain("@alice");
		expect(result).toContain("@bob");
		expect(result).toContain("and");
	});

	it("handles multiple version blocks with different contributors", () => {
		const md =
			"## 2.0.0\n\n### Features\n\n- A Thanks [@alice](https://github.com/alice)!\n\n## 1.0.0\n\n### Features\n\n- B Thanks [@bob](https://github.com/bob)!\n";
		const result = transform(md);
		// Both contributors should appear in their respective blocks
		expect(result).toContain("@alice");
		expect(result).toContain("@bob");
	});

	it("only matches attribution at end of text", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Thanks @alice! Added X for fun\n";
		const result = transform(md);
		// This attribution is NOT at the end, so it should not be extracted
		expect(result).not.toContain("contributions");
	});

	it("removes attribution text from list items", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added login Thanks [@alice](https://github.com/alice)!\n";
		const result = transform(md);
		// The list item should still have "Added login" but not the attribution
		expect(result).toContain("Added login");
	});

	it("handles three or more contributors with Oxford comma", () => {
		const md =
			"## 1.0.0\n\n### Features\n\n- A Thanks [@alice](https://github.com/alice)!\n- B Thanks [@bob](https://github.com/bob)!\n- C Thanks [@carol](https://github.com/carol)!\n";
		const result = transform(md);
		expect(result).toContain("@alice");
		expect(result).toContain("@bob");
		expect(result).toContain("@carol");
	});

	it("handles empty document gracefully", () => {
		const result = transform("");
		expect(result.trim()).toBe("");
	});

	it("emits the aggregate as a ### Thanks section", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X Thanks [@alice](https://github.com/alice)!\n";
		const result = transform(md);
		expect(result).toContain("### Thanks");
		// heading precedes the summary paragraph
		expect(result.indexOf("### Thanks")).toBeLessThan(result.indexOf("Thanks to"));
	});

	it("extracts a standalone attribution paragraph outside any list", () => {
		const md = [
			"## 1.0.0",
			"",
			"### Dependencies",
			"",
			"| Dependency | Type | Action | From | To |",
			"| --- | --- | --- | --- | --- |",
			"| effect | dependency | updated | 4.0.0 | 4.1.0 |",
			"",
			"[#42](https://github.com/o/r/pull/42) Thanks [@bot](https://github.com/bot)!",
			"",
		].join("\n");
		const result = transform(md);
		expect(result).toContain("### Thanks");
		expect(result).toContain("@bot");
		expect(result).not.toMatch(/Thanks \[@bot\]/);
	});

	it("is idempotent: a second run leaves the Thanks section unchanged", () => {
		const md = "## 1.0.0\n\n### Features\n\n- A Thanks [@alice](https://github.com/alice)!\n- B Thanks @bob!\n";
		const once = transform(md);
		const twice = transform(once);
		expect(twice).toBe(once);
		expect((twice.match(/### Thanks/g) ?? []).length).toBe(1);
	});

	it("keeps ### Patch Changes when an existing Thanks section holds a plain attribution paragraph", () => {
		const md = "## 1.0.0\n\n### Thanks\n\nThanks @alice!\n\n### Patch Changes\n\n- Fixed a bug\n";
		const result = transform(md);
		expect(result).toContain("### Patch Changes");
		expect(result).toContain("Fixed a bug");
		expect(result).toContain("@alice");
		expect((result.match(/### Thanks/g) ?? []).length).toBe(1);
	});

	it("keeps ### Patch Changes when an existing Thanks section holds a linked attribution paragraph", () => {
		const md =
			"## 1.0.0\n\n### Thanks\n\nThanks [@alice](https://github.com/alice)!\n\n### Patch Changes\n\n- Fixed a bug\n";
		const result = transform(md);
		expect(result).toContain("### Patch Changes");
		expect(result).toContain("Fixed a bug");
		expect(result).toContain("@alice");
		expect((result.match(/### Thanks/g) ?? []).length).toBe(1);
	});

	it("is idempotent when the Thanks section precedes another h3 section", () => {
		const md = "## 1.0.0\n\n### Thanks\n\nThanks @alice!\n\n### Patch Changes\n\n- Fixed a bug\n";
		const once = transform(md);
		const twice = transform(once);
		expect(twice).toBe(once);
		expect(twice).toContain("### Patch Changes");
	});

	it("removes a list item that held ONLY an attribution, instead of leaving an empty bullet", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X\n- Thanks [@alice](https://github.com/alice)!\n";
		const result = transform(md);
		expect(result).toContain("Added X");
		expect(result).toContain("Thanks to");
		// No `- ` husk survives where the attribution-only bullet was.
		expect(result).not.toMatch(/^[-*][ \t]*$/m);
	});

	it("removes a list emptied entirely by stripping attribution-only bullets", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Thanks @bob!\n";
		const result = transform(md);
		expect(result).toContain("Thanks to");
		expect(result).toContain("@bob");
		expect(result).not.toMatch(/^[-*][ \t]*$/m);
	});

	it("thanks: false also removes list items emptied by stripping", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X\n- Thanks [@alice](https://github.com/alice)!\n";
		const result = String(
			unified()
				.use(remarkParse)
				.use(remarkGfm)
				.use(ContributorFootnotesPlugin, { thanks: false })
				.use(remarkStringify)
				.processSync(md),
		);
		expect(result).toContain("Added X");
		expect(result).not.toContain("@alice");
		expect(result).not.toMatch(/^[-*][ \t]*$/m);
	});

	it("thanks: false strips inline attributions and emits no Thanks section", () => {
		const md = "## 1.0.0\n\n### Features\n\n- Added X Thanks [@alice](https://github.com/alice)!\n";
		const result = String(
			unified()
				.use(remarkParse)
				.use(remarkGfm)
				.use(ContributorFootnotesPlugin, { thanks: false })
				.use(remarkStringify)
				.processSync(md),
		);
		expect(result).toContain("Added X");
		expect(result).not.toContain("Thanks");
		expect(result).not.toContain("@alice");
	});

	it("thanks: false removes an existing ### Thanks section", () => {
		const md =
			"## 1.0.0\n\n### Features\n\n- Added X\n\n### Thanks\n\nThanks to [@alice](https://github.com/alice) for their contributions!\n";
		const result = String(
			unified()
				.use(remarkParse)
				.use(remarkGfm)
				.use(ContributorFootnotesPlugin, { thanks: false })
				.use(remarkStringify)
				.processSync(md),
		);
		expect(result).toContain("Added X");
		expect(result).not.toContain("Thanks");
		expect(result).not.toContain("@alice");
	});

	describe("foreign (hand-authored) Thanks section content", () => {
		it("round-trips a Thanks section whose body is a hand-authored prose paragraph", () => {
			const md = "## 1.0.0\n\n### Thanks\n\nSpecial thanks to the docs team for the review pass.\n";
			const result = transform(md);
			expect(result).toContain("### Thanks");
			expect(result).toContain("Special thanks to the docs team for the review pass.");
			// Nothing harvested, nothing to emit: transform is a pass-through.
			expect(transform(result)).toBe(result);
		});

		it("round-trips a Thanks section whose body is a plain-name list", () => {
			const md = "## 1.0.0\n\n### Thanks\n\n- Alice Smith\n- Bob Jones\n";
			const result = transform(md);
			expect(result).toContain("### Thanks");
			expect(result).toContain("Alice Smith");
			expect(result).toContain("Bob Jones");
			expect(transform(result)).toBe(result);
		});

		it("round-trips a Thanks section whose body is a code block", () => {
			const md = "## 1.0.0\n\n### Thanks\n\n```\nteam credits roll here\n```\n";
			const result = transform(md);
			expect(result).toContain("### Thanks");
			expect(result).toContain("team credits roll here");
			expect(transform(result)).toBe(result);
		});

		it("preserves a mixed prose+mention paragraph untouched and does not double-credit its mention", () => {
			const md = [
				"## 1.0.0",
				"",
				"### Features",
				"",
				"- Added X Thanks @bob!",
				"",
				"### Thanks",
				"",
				"Huge effort on the infra migration Thanks @alice!",
				"",
			].join("\n");
			const result = transform(md);
			// The mixed paragraph survives verbatim (mention included, not stripped).
			expect(result).toContain("Huge effort on the infra migration Thanks @alice!");
			// The merged paragraph credits only the inline attribution's @bob.
			expect(result).toContain("Thanks to @bob for their contributions!");
			// @alice is not mined into the merged paragraph (one credit, in the prose).
			expect((result.match(/@alice/g) ?? []).length).toBe(1);
		});

		it("appends the merged paragraph into a surviving Thanks section (one section, heading kept in place)", () => {
			const md = [
				"## 1.0.0",
				"",
				"### Features",
				"",
				"- Added X Thanks @bob!",
				"",
				"### Thanks",
				"",
				"Special thanks to the docs team.",
				"",
			].join("\n");
			const result = transform(md);
			expect((result.match(/### Thanks/g) ?? []).length).toBe(1);
			// Preserved prose first, merged paragraph after it, inside the section.
			const prose = result.indexOf("Special thanks to the docs team.");
			const merged = result.indexOf("Thanks to @bob for their contributions!");
			expect(prose).toBeGreaterThan(-1);
			expect(merged).toBeGreaterThan(prose);
		});

		it("still harvests and merges a pure-attribution Thanks body with inline attributions", () => {
			const md = [
				"## 1.0.0",
				"",
				"### Features",
				"",
				"- Added X Thanks @bob!",
				"",
				"### Thanks",
				"",
				"Thanks @alice!",
				"",
			].join("\n");
			const result = transform(md);
			expect((result.match(/### Thanks/g) ?? []).length).toBe(1);
			expect(result).toContain("Thanks to @alice and @bob for their contributions!");
		});

		it("is idempotent over a foreign-shaped changelog with a hand-authored Thanks section", () => {
			const md = [
				"## 1.0.0",
				"",
				"### Features",
				"",
				"- Added X Thanks @bob!",
				"",
				"### Thanks",
				"",
				"Special thanks to the docs team.",
				"",
			].join("\n");
			const once = transform(md);
			const twice = transform(once);
			expect(twice).toBe(once);
			expect((twice.match(/### Thanks/g) ?? []).length).toBe(1);
		});

		it("thanks: false leaves hand-authored Thanks content (and its heading) in place", () => {
			const md = "## 1.0.0\n\n### Thanks\n\nSpecial thanks to the docs team.\n\n### Patch Changes\n\n- Fixed a bug\n";
			const result = String(
				unified()
					.use(remarkParse)
					.use(remarkGfm)
					.use(ContributorFootnotesPlugin, { thanks: false })
					.use(remarkStringify)
					.processSync(md),
			);
			expect(result).toContain("### Thanks");
			expect(result).toContain("Special thanks to the docs team.");
			expect(result).toContain("### Patch Changes");
		});

		it("thanks: false still strips pure-attribution shapes from an existing Thanks section", () => {
			const md = "## 1.0.0\n\n### Thanks\n\nSpecial thanks to the docs team.\n\nThanks @alice!\n";
			const result = String(
				unified()
					.use(remarkParse)
					.use(remarkGfm)
					.use(ContributorFootnotesPlugin, { thanks: false })
					.use(remarkStringify)
					.processSync(md),
			);
			expect(result).toContain("Special thanks to the docs team.");
			expect(result).not.toContain("@alice");
		});

		it("full transform preset keeps one final Thanks section (preserved prose + merged mentions, pinned last)", () => {
			const md = [
				"## 1.0.0",
				"",
				"### Thanks",
				"",
				"Special thanks to the docs team.",
				"",
				"### Features",
				"",
				"- Added X Thanks @bob!",
				"",
			].join("\n");
			const once = transformFull(md);
			expect((once.match(/### Thanks/g) ?? []).length).toBe(1);
			expect(once).toContain("Special thanks to the docs team.");
			expect(once).toContain("Thanks to @bob for their contributions!");
			// Reorder pins Thanks last: the section follows Features in the output.
			expect(once.indexOf("### Thanks")).toBeGreaterThan(once.indexOf("### Features"));
			// Stable under a second full-pipeline pass.
			expect(transformFull(once)).toBe(once);
		});
	});
});
