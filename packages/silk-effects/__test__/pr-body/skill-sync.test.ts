/**
 * Drift lint: the silk plugin skills duplicate the marker literals and the
 * two closing-reference spellings for agent readability, and this suite is
 * what keeps those copies honest (ruled in savvy-web/systems#419: the PrBody
 * exports are the single source of truth; the skills are duplicated WITH a
 * lint, not generated and not merely referenced).
 *
 * If an assertion here fails, either the skill prose drifted from the
 * exported contract (fix the skill) or the contract changed (a wire-format
 * decision — see the frozen-token ruling on `Markers` before touching it).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { Markers } from "../../src/pr-body/markers.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..", "..");
const prBodySkill = readFileSync(join(repoRoot, "plugins", "silk", "skills", "pr-body", "SKILL.md"), "utf8");
const commitCreateSkill = readFileSync(
	join(repoRoot, "plugins", "silk", "skills", "commit-create", "SKILL.md"),
	"utf8",
);

describe("plugins/silk/skills/pr-body/SKILL.md carries the exported contract", () => {
	it("control: the skill file was found and is substantial", () => {
		// A moved or truncated file would green every substring miss below.
		expect(prBodySkill.length).toBeGreaterThan(1000);
		expect(prBodySkill).toContain("# pr-body");
	});

	it("names every marker literal verbatim", () => {
		expect(prBodySkill).toContain(Markers.MANAGED_START);
		expect(prBodySkill).toContain(Markers.MANAGED_END);
		expect(prBodySkill).toContain(Markers.SUMMARY_START);
		expect(prBodySkill).toContain(Markers.SUMMARY_END);
		// The skill shows the ATTRIBUTED references form, so assert the prefix
		// (the plain constant deliberately does not appear in a real document).
		expect(prBodySkill).toContain(Markers.REFERENCES_START_PREFIX);
		expect(prBodySkill).toContain(Markers.REFERENCES_END);
	});

	it("names the squash fence language and the owned attribute", () => {
		expect(prBodySkill).toContain(Markers.SQUASH_FENCE_LANGUAGE);
		expect(prBodySkill).toContain('owned="');
	});

	it("shows both closing-reference spellings", () => {
		// The comma-joined trailer (commitlint's spelling)…
		expect(prBodySkill).toMatch(/Closes #\d+, #\d+/);
		// …and the bare one-per-line form (GitHub's spelling).
		expect(prBodySkill).toMatch(/^Closes #\d+$/m);
	});
});

describe("plugins/silk/skills/commit-create/SKILL.md carries the trailer spelling", () => {
	it("control: the skill file was found and is substantial", () => {
		expect(commitCreateSkill.length).toBeGreaterThan(1000);
		expect(commitCreateSkill).toContain("# commit-create");
	});

	it("teaches the ONE comma-separated line rule with a matching example", () => {
		expect(commitCreateSkill).toMatch(/ONE line, comma-separated/i);
		expect(commitCreateSkill).toMatch(/Closes #\d+(, #\d+)+/);
	});
});
