/**
 * Structural coverage of the served toolkit: imports `SilkToolkit` with no bin
 * and no platform layer, and pins the wire names and MCP annotations every
 * tool declares. The annotation table is the tool set's own contract with a
 * client — a mutating tool served as read-only would let an agent skip its
 * confirmation step.
 */

import { Context } from "effect";
import { Tool } from "effect/unstable/ai";
import { describe, expect, it } from "vitest";

import { SilkMarkdown } from "../src/markdown.js";
import { SilkToolkit } from "../src/toolkit.js";

const TOOL_NAMES = [
	"biome_check",
	"changeset_deps_detect",
	"changeset_deps_regen",
	"changeset_inspect",
	"changeset_preview",
	"changeset_validate",
	"repos_inspect",
	"repos_manage",
	"turbo_inspect",
	"workspace_info",
] as const;

/** name → [readOnly, idempotent, openWorld, destructive] */
const ANNOTATIONS: Record<(typeof TOOL_NAMES)[number], readonly [boolean, boolean, boolean, boolean]> = {
	workspace_info: [true, true, false, false],
	turbo_inspect: [true, true, false, false],
	changeset_inspect: [true, true, false, false],
	changeset_validate: [true, true, false, false],
	changeset_deps_detect: [true, true, false, false],
	changeset_preview: [true, true, false, false],
	changeset_deps_regen: [false, false, false, true],
	repos_inspect: [true, true, false, false],
	repos_manage: [false, false, false, true],
	biome_check: [false, false, false, false],
};

const tools = Object.values(SilkToolkit.tools) as ReadonlyArray<Tool.Any>;

describe("SilkToolkit", () => {
	it("serves exactly the ten savvy-mcp tools", () => {
		expect(tools.map((tool) => tool.name).toSorted()).toEqual([...TOOL_NAMES]);
		expect(tools).toHaveLength(10);
	});

	it.each(TOOL_NAMES)("%s declares the read-only/idempotent/open-world/destructive annotations", (name) => {
		const tool = SilkToolkit.tools[name];
		const [readOnly, idempotent, openWorld, destructive] = ANNOTATIONS[name];
		expect(Context.get(tool.annotations, Tool.Readonly)).toBe(readOnly);
		expect(Context.get(tool.annotations, Tool.Idempotent)).toBe(idempotent);
		expect(Context.get(tool.annotations, Tool.OpenWorld)).toBe(openWorld);
		expect(Context.get(tool.annotations, Tool.Destructive)).toBe(destructive);
	});

	it("marks exactly the three mutating tools as not read-only", () => {
		const mutating = tools.filter((tool) => !Context.get(tool.annotations, Tool.Readonly)).map((tool) => tool.name);
		expect(mutating.toSorted()).toEqual(["biome_check", "changeset_deps_regen", "repos_manage"]);
	});

	it("gives every tool a title, a description, and a markdown renderer", () => {
		for (const tool of tools) {
			expect(Context.getOrUndefined(tool.annotations, Tool.Title), `${tool.name} title`).toBeTypeOf("string");
			expect(tool.description?.length ?? 0, `${tool.name} description`).toBeGreaterThan(0);
			expect(Context.getOrUndefined(tool.annotations, SilkMarkdown), `${tool.name} markdown`).toBeTypeOf("function");
		}
	});

	it("every tool uses failureMode error, the mode whose wire rendering errors.ts is written for", () => {
		for (const tool of tools) {
			expect(tool.failureMode, tool.name).toBe("error");
		}
	});

	it("every tool's parameters compile to an object-rooted JSON Schema with described properties", () => {
		for (const tool of tools) {
			const schema = Tool.getJsonSchema(tool) as {
				type?: string;
				properties?: Record<string, { description?: string }>;
			};
			expect(schema.type, tool.name).toBe("object");
			for (const [key, prop] of Object.entries(schema.properties ?? {})) {
				expect(prop.description, `${tool.name}.${key}`).toBeTypeOf("string");
			}
		}
	});
});
