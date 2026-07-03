import type { Config, ReleasePlan } from "@changesets/types";
import { describe, expect, it } from "vitest";
import { deriveMaintenanceReason } from "../../src/changesets/services/maintenance-reason.js";

const baseConfig = (overrides: Partial<Config>): Config => ({ fixed: [], linked: [], ...overrides }) as Config;

const release = (name: string, newVersion: string, changesets: string[]) => ({
	name,
	type: "patch" as const,
	oldVersion: "1.0.0",
	newVersion,
	changesets,
});

const planWith = (...releases: ReturnType<typeof release>[]): ReleasePlan =>
	({ releases, changesets: [], preState: undefined }) as unknown as ReleasePlan;

describe("deriveMaintenanceReason", () => {
	it("returns undefined for a release with its own changesets", () => {
		const r = release("@scope/a", "1.1.0", ["cs-1"]);
		expect(deriveMaintenanceReason(r, planWith(r), baseConfig({}))).toBeUndefined();
	});

	it("identifies a fixed-group release with a single trigger", () => {
		const empty = release("@scope/fixed-1", "2.3.1", []);
		const mover = release("@scope/fixed-2", "2.3.1", ["cs-1"]);
		const config = baseConfig({ fixed: [["@scope/fixed-1", "@scope/fixed-2"]] });
		expect(deriveMaintenanceReason(empty, planWith(empty, mover), config)).toEqual({
			kind: "fixed",
			triggers: [{ name: "@scope/fixed-2", version: "2.3.1" }],
		});
	});

	it("collects multiple triggers from the same fixed group", () => {
		const empty = release("@scope/f1", "2.3.1", []);
		const m1 = release("@scope/f2", "2.3.1", ["cs-1"]);
		const m2 = release("@scope/f3", "2.3.1", ["cs-2"]);
		const config = baseConfig({ fixed: [["@scope/f1", "@scope/f2", "@scope/f3"]] });
		const reason = deriveMaintenanceReason(empty, planWith(empty, m1, m2), config);
		expect(reason?.kind).toBe("fixed");
		expect(reason?.triggers).toHaveLength(2);
	});

	it("matches glob-style group entries", () => {
		const empty = release("@scope/fixed-1", "2.3.1", []);
		const mover = release("@scope/fixed-2", "2.3.1", ["cs-1"]);
		const config = baseConfig({ fixed: [["@scope/*"]] });
		expect(deriveMaintenanceReason(empty, planWith(empty, mover), config)?.kind).toBe("fixed");
	});

	it("identifies a linked-group release", () => {
		const empty = release("@scope/l1", "3.0.0", []);
		const mover = release("@scope/l2", "3.0.0", ["cs-1"]);
		const config = baseConfig({ linked: [["@scope/l1", "@scope/l2"]] });
		expect(deriveMaintenanceReason(empty, planWith(empty, mover), config)?.kind).toBe("linked");
	});

	it("falls back to unspecified with no triggers when no group explains the release", () => {
		const empty = release("@scope/orphan", "1.0.1", []);
		expect(deriveMaintenanceReason(empty, planWith(empty), baseConfig({}))).toEqual({
			kind: "unspecified",
			triggers: [],
		});
	});

	it("falls back to unspecified when the group has no movers with changesets", () => {
		const e1 = release("@scope/f1", "2.3.1", []);
		const e2 = release("@scope/f2", "2.3.1", []);
		const config = baseConfig({ fixed: [["@scope/f1", "@scope/f2"]] });
		expect(deriveMaintenanceReason(e1, planWith(e1, e2), config)?.kind).toBe("unspecified");
	});
});
