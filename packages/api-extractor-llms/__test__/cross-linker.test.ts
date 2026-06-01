import { describe, expect, it } from "vitest";

import { CrossLinker } from "../src/cross-linker.js";
import type { ApiItemRef } from "../src/types.js";

const refs: ApiItemRef[] = [
	{ name: "Pipeline", kind: "class", slug: "pipeline" },
	{ name: "Config", kind: "interface", slug: "config" },
];

describe("CrossLinker", () => {
	const linker = new CrossLinker(refs, (ref) => `silk://packages/x/api/${ref.kind}/${ref.slug}`);

	it("links a known name via the injected route formatter", () => {
		expect(linker.addLinks("See Pipeline for details.")).toBe(
			"See [Pipeline](silk://packages/x/api/class/pipeline) for details.",
		);
	});

	it("does not link inside a code span", () => {
		expect(linker.addLinks("Use `Pipeline` directly.")).toBe("Use `Pipeline` directly.");
	});

	it("does not double-link text already in a markdown link", () => {
		expect(linker.addLinks("[Pipeline](/elsewhere)")).toBe("[Pipeline](/elsewhere)");
	});

	it("leaves unknown names untouched", () => {
		expect(linker.addLinks("See Unknown.")).toBe("See Unknown.");
	});

	it("links the longest matching name, not a shorter prefix", () => {
		const linker = new CrossLinker(
			[
				{ name: "Pipeline", kind: "class", slug: "pipeline" },
				{ name: "PipelineConfig", kind: "interface", slug: "pipelineconfig" },
			],
			(ref) => `silk://packages/x/api/${ref.kind}/${ref.slug}`,
		);
		expect(linker.addLinks("See PipelineConfig.")).toBe(
			"See [PipelineConfig](silk://packages/x/api/interface/pipelineconfig).",
		);
	});

	it("links every occurrence of a name", () => {
		const linker = new CrossLinker(
			[{ name: "Pipeline", kind: "class", slug: "pipeline" }],
			(ref) => `silk://packages/x/api/${ref.kind}/${ref.slug}`,
		);
		const out = linker.addLinks("Pipeline talks to Pipeline.");
		expect(out.match(/\[Pipeline\]/g)).toHaveLength(2);
	});
});
