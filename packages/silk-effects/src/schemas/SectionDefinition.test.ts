import { Effect, Equal, Hash } from "effect";
import { describe, expect, it } from "vitest";
import type { SectionValidationError } from "../errors/SectionValidationError.js";
import { SectionBlock } from "./SectionBlock.js";
import { SectionDefinition, ShellSectionDefinition } from "./SectionDefinition.js";

const TOOL = "MY-TOOL";

describe("SectionDefinition", () => {
	describe("make", () => {
		it("creates with toolName and default commentStyle", () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			expect(def.toolName).toBe(TOOL);
			expect(def.commentStyle).toBe("#");
		});

		it("creates with explicit commentStyle", () => {
			const def = SectionDefinition.make({ toolName: TOOL, commentStyle: "//" });
			expect(def.commentStyle).toBe("//");
		});
	});

	describe("block", () => {
		it("creates a SectionBlock from content", () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			const block = def.block("hello");
			expect(block).toBeInstanceOf(SectionBlock);
			expect(block.toolName).toBe(TOOL);
			expect(block.commentStyle).toBe("#");
			expect(block.content).toBe("hello");
		});
	});

	describe("markers", () => {
		it("beginMarker returns correct format", () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			expect(def.beginMarker).toBe("# --- BEGIN MY-TOOL MANAGED SECTION ---");
		});

		it("endMarker returns correct format", () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			expect(def.endMarker).toBe("# --- END MY-TOOL MANAGED SECTION ---");
		});

		it("markers use // comment style", () => {
			const def = SectionDefinition.make({ toolName: TOOL, commentStyle: "//" });
			expect(def.beginMarker).toBe("// --- BEGIN MY-TOOL MANAGED SECTION ---");
		});
	});

	describe("Equal/Hash", () => {
		it("equal when same toolName and commentStyle", () => {
			const a = SectionDefinition.make({ toolName: TOOL });
			const b = SectionDefinition.make({ toolName: TOOL });
			expect(Equal.equals(a, b)).toBe(true);
		});

		it("not equal when different toolName", () => {
			const a = SectionDefinition.make({ toolName: "TOOL-A" });
			const b = SectionDefinition.make({ toolName: "TOOL-B" });
			expect(Equal.equals(a, b)).toBe(false);
		});

		it("not equal when different commentStyle", () => {
			const a = SectionDefinition.make({ toolName: TOOL, commentStyle: "#" });
			const b = SectionDefinition.make({ toolName: TOOL, commentStyle: "//" });
			expect(Equal.equals(a, b)).toBe(false);
		});

		it("equal definitions have same hash", () => {
			const a = SectionDefinition.make({ toolName: TOOL });
			const b = SectionDefinition.make({ toolName: TOOL });
			expect(Hash.hash(a)).toBe(Hash.hash(b));
		});
	});

	describe("generate", () => {
		it("returns a typed block factory (instance)", () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			const factory = def.generate((cfg: { name: string }) => `hello ${cfg.name}`);
			const block = factory({ name: "world" });
			expect(block).toBeInstanceOf(SectionBlock);
			expect(block.content).toBe("hello world");
			expect(block.toolName).toBe(TOOL);
		});

		it("static generate works data-first", () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			const factory = SectionDefinition.generate(def, (cfg: { n: number }) => `count: ${cfg.n}`);
			const block = factory({ n: 42 });
			expect(block.content).toBe("count: 42");
		});

		it("static generate works data-last", () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			const factory = SectionDefinition.generate((cfg: { n: number }) => `count: ${cfg.n}`)(def);
			const block = factory({ n: 42 });
			expect(block.content).toBe("count: 42");
		});
	});

	describe("generateEffect", () => {
		it("returns a typed Effect block factory (instance)", async () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			const factory = def.generateEffect((cfg: { name: string }) => Effect.succeed(`hello ${cfg.name}`));
			const block = await Effect.runPromise(factory({ name: "world" }));
			expect(block).toBeInstanceOf(SectionBlock);
			expect(block.content).toBe("hello world");
		});

		it("static generateEffect works data-first", async () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			const factory = SectionDefinition.generateEffect(def, (cfg: { n: number }) => Effect.succeed(`count: ${cfg.n}`));
			const block = await Effect.runPromise(factory({ n: 7 }));
			expect(block.content).toBe("count: 7");
		});
	});

	describe("withValidation", () => {
		it("validated definition rejects invalid content in block()", () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			const validated = SectionDefinition.withValidation(def, (block) => block.content.includes("required"));
			expect(() => validated.block("no match")).toThrow();
		});

		it("validated definition accepts valid content in block()", () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			const validated = SectionDefinition.withValidation(def, (block) => block.content.includes("required"));
			const block = validated.block("has required keyword");
			expect(block.content).toBe("has required keyword");
		});

		it("validation error has correct tag", () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			const validated = SectionDefinition.withValidation(def, () => false);
			try {
				validated.block("anything");
				expect.fail("should have thrown");
			} catch (e) {
				expect((e as SectionValidationError)._tag).toBe("SectionValidationError");
			}
		});

		it("generate factory runs validation", () => {
			const def = SectionDefinition.make({ toolName: TOOL });
			const validated = SectionDefinition.withValidation(def, (block) => block.content.includes("ok"));
			const factory = validated.generate((cfg: { v: string }) => cfg.v);
			expect(() => factory({ v: "not valid" })).toThrow();
			expect(factory({ v: "ok" }).content).toBe("ok");
		});
	});

	describe("diff", () => {
		it("Unchanged for same identity", () => {
			const a = SectionDefinition.make({ toolName: TOOL });
			const b = SectionDefinition.make({ toolName: TOOL });
			expect(a.diff(b)._tag).toBe("Unchanged");
		});

		it("Changed for different identity", () => {
			const a = SectionDefinition.make({ toolName: "A" });
			const b = SectionDefinition.make({ toolName: "B" });
			const d = a.diff(b);
			expect(d._tag).toBe("Changed");
		});
	});
});

describe("ShellSectionDefinition", () => {
	it("creates with toolName only", () => {
		const def = ShellSectionDefinition.make({ toolName: TOOL });
		expect(def.toolName).toBe(TOOL);
		expect(def.commentStyle).toBe("#");
	});

	it("block creates SectionBlock with # comment style", () => {
		const def = ShellSectionDefinition.make({ toolName: TOOL });
		const block = def.block("content");
		expect(block.commentStyle).toBe("#");
	});

	it("beginMarker uses # style", () => {
		const def = ShellSectionDefinition.make({ toolName: TOOL });
		expect(def.beginMarker).toBe("# --- BEGIN MY-TOOL MANAGED SECTION ---");
	});

	it("generate works", () => {
		const def = ShellSectionDefinition.make({ toolName: TOOL });
		const factory = def.generate((cfg: { path: string }) => `run ${cfg.path}`);
		const block = factory({ path: "/bin/test" });
		expect(block.content).toBe("run /bin/test");
	});
});
