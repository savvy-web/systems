import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import type { MaintenanceNoteOptions } from "../../src/changesets/remark/plugins/maintenance-note.js";
import { MaintenanceNotePlugin } from "../../src/changesets/remark/plugins/maintenance-note.js";

function transform(md: string, options: MaintenanceNoteOptions): string {
	return String(
		unified().use(remarkParse).use(remarkGfm).use(MaintenanceNotePlugin, options).use(remarkStringify).processSync(md),
	);
}

const fixedReason: MaintenanceNoteOptions = {
	version: "2.3.1",
	reason: { kind: "fixed", triggers: [{ name: "@savvy-web/fixed-2", version: "2.3.1" }] },
};

describe("maintenance-note", () => {
	it("inserts a Maintenance section into an empty version block (fixed)", () => {
		const result = transform("# pkg\n\n## 2.3.1\n\n## 2.3.0\n\n### Features\n\n- Old\n", fixedReason);
		expect(result).toContain("### Maintenance");
		expect(result).toContain("`@savvy-web/fixed-2@2.3.1`");
		expect(result).toContain("(fixed version group)");
		// inserted into 2.3.1, not 2.3.0
		expect(result.indexOf("### Maintenance")).toBeLessThan(result.indexOf("## 2.3.0"));
	});

	it("renders linked groups and multiple triggers", () => {
		const result = transform("## 3.0.0\n", {
			version: "3.0.0",
			reason: {
				kind: "linked",
				triggers: [
					{ name: "@scope/l2", version: "3.0.0" },
					{ name: "@scope/l3", version: "3.0.0" },
				],
			},
		});
		expect(result).toContain("`@scope/l2@3.0.0`");
		expect(result).toContain("`@scope/l3@3.0.0`");
		expect(result).toContain("(linked version group)");
	});

	it("renders the generic sentence for unspecified", () => {
		const result = transform("## 1.0.1\n", {
			version: "1.0.1",
			reason: { kind: "unspecified", triggers: [] },
		});
		expect(result).toContain("### Maintenance");
		expect(result).toContain("Version-only release to keep workspace versions consistent");
	});

	it("no-ops when the version block has content", () => {
		const md =
			"## 2.3.1\n\n### Dependencies\n\n| Dependency | Type | Action | From | To |\n| --- | --- | --- | --- | --- |\n| foo | dependency | updated | 1.0.0 | 1.1.0 |\n";
		expect(transform(md, fixedReason)).not.toContain("### Maintenance");
	});

	it("no-ops when the version block is absent", () => {
		expect(transform("## 9.9.9\n\n### Features\n\n- X\n", fixedReason)).not.toContain("### Maintenance");
	});

	it("is idempotent", () => {
		const once = transform("## 2.3.1\n", fixedReason);
		const twice = transform(once, fixedReason);
		expect(twice).toBe(once);
	});
});
