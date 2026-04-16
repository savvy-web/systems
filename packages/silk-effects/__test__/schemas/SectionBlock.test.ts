import { Equal, Hash } from "effect";
import { describe, expect, it } from "vitest";
import { SectionBlock } from "../../src/schemas/SectionBlock.js";

const TOOL = "MY-TOOL";

describe("SectionBlock", () => {
	describe("make", () => {
		it("creates a block via make", () => {
			const block = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "hello" });
			expect(block.toolName).toBe(TOOL);
			expect(block.commentStyle).toBe("#");
			expect(block.content).toBe("hello");
		});
	});

	describe("text getters", () => {
		it("text returns raw content", () => {
			const block = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "  hello\n  world  " });
			expect(block.text).toBe("  hello\n  world  ");
		});

		it("normalized trims and collapses whitespace", () => {
			const block = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "  hello\n  world  " });
			expect(block.normalized).toBe("hello world");
		});

		it("rendered wraps content in markers", () => {
			const block = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "hello" });
			expect(block.rendered).toBe(
				"# --- BEGIN MY-TOOL MANAGED SECTION ---\nhello\n# --- END MY-TOOL MANAGED SECTION ---",
			);
		});

		it("rendered uses // comment style", () => {
			const block = SectionBlock.make({ toolName: TOOL, commentStyle: "//", content: "\nhello\n" });
			expect(block.rendered).toContain("// --- BEGIN MY-TOOL MANAGED SECTION ---");
			expect(block.rendered).toContain("// --- END MY-TOOL MANAGED SECTION ---");
		});

		it("rendered uppercases lowercase toolName in markers", () => {
			const block = SectionBlock.make({ toolName: "biome", commentStyle: "#", content: "\nhello\n" });
			expect(block.rendered).toContain("# --- BEGIN BIOME MANAGED SECTION ---");
			expect(block.rendered).toContain("# --- END BIOME MANAGED SECTION ---");
		});
	});

	describe("Equal/Hash", () => {
		it("equals blocks with same normalized content", () => {
			const a = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "hello\n" });
			const b = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "  hello  \n" });
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("not equal when normalized content differs", () => {
			const a = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "hello" });
			const b = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "world" });
			expect(Equal.equals(a, b)).toBe(false);
		});

		it("equal blocks have same hash", () => {
			const a = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "hello\n" });
			const b = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "  hello  \n" });
			expect(Hash.hash(a)).toBe(Hash.hash(b));
		});
	});

	describe("prepend/append", () => {
		it("prepend returns new block with lines before content", () => {
			const block = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "body" });
			const result = block.prepend("header");
			expect(result.content).toBe("header\nbody");
			expect(result.toolName).toBe(TOOL);
		});

		it("append returns new block with lines after content", () => {
			const block = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "body" });
			const result = block.append("footer");
			expect(result.content).toBe("body\nfooter");
		});

		it("prepend does not mutate original", () => {
			const block = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "body" });
			block.prepend("header");
			expect(block.content).toBe("body");
		});

		it("static prepend works as dual API", () => {
			const block = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "body" });
			const result = SectionBlock.prepend(block, "header");
			expect(result.content).toBe("header\nbody");
		});

		it("static append works as dual API (data-last)", () => {
			const block = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "body" });
			const appendFooter = SectionBlock.append("footer");
			const result = appendFooter(block);
			expect(result.content).toBe("body\nfooter");
		});
	});

	describe("diff", () => {
		it("returns Unchanged for equal blocks", () => {
			const a = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "same" });
			const b = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "same" });
			const d = a.diff(b);
			expect(d._tag).toBe("Unchanged");
		});

		it("returns Changed with added/removed lines", () => {
			const a = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "line1\nline2" });
			const b = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "line1\nline3" });
			const d = a.diff(b);
			expect(d._tag).toBe("Changed");
			if (d._tag === "Changed") {
				expect(d.removed).toContain("line2");
				expect(d.added).toContain("line3");
			}
		});

		it("static diff works as dual API", () => {
			const a = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "a" });
			const b = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "b" });
			const d = SectionBlock.diff(a, b);
			expect(d._tag).toBe("Changed");
		});

		it("static diff works data-last", () => {
			const a = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "a" });
			const b = SectionBlock.make({ toolName: TOOL, commentStyle: "#", content: "b" });
			const diffWithB = SectionBlock.diff(b);
			const d = diffWithB(a);
			expect(d._tag).toBe("Changed");
		});
	});
});
