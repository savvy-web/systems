/**
 * Unit suite for the closing-reference model: the two spellings, closedness
 * classification, and the `owned="…"` attribute.
 */

import { describe, expect, it } from "vitest";
import { LinkedIssueRef } from "../../src/pr-body/linked-issue.js";
import { ClosingReferences, OwnedAttribute } from "../../src/pr-body/references.js";

describe("LinkedIssueRef.isClosed", () => {
	it("classifies REST's lowercase state", () => {
		expect(LinkedIssueRef.isClosed({ state: "closed" })).toBe(true);
		expect(LinkedIssueRef.isClosed({ state: "open" })).toBe(false);
	});

	it("classifies GraphQL's uppercase state — the case a bare === misses", () => {
		expect(LinkedIssueRef.isClosed({ state: "CLOSED" })).toBe(true);
		expect(LinkedIssueRef.isClosed({ state: "OPEN" })).toBe(false);
	});
});

describe("ClosingReferences.fromIssues", () => {
	const issue = (number: number, state: string): LinkedIssueRef => ({ number, title: "t", state });

	it("keeps open issues in order and drops closed ones, either spelling", () => {
		const refs = ClosingReferences.fromIssues([
			issue(1, "open"),
			issue(2, "closed"),
			issue(3, "CLOSED"),
			issue(4, "OPEN"),
		]);
		expect([...refs.ids]).toEqual([1, 4]);
	});

	it("preserves duplicates — dedupe() is a separate, explicit step", () => {
		// Pins the historical asymmetry byte-parity depends on: the squash
		// trailer renders duplicates as-given, the references region dedupes.
		const refs = ClosingReferences.fromIssues([issue(7, "open"), issue(7, "open")]);
		expect([...refs.ids]).toEqual([7, 7]);
		expect([...refs.dedupe().ids]).toEqual([7]);
	});
});

describe("the two renderers", () => {
	it("renderTrailer comma-joins on one line", () => {
		expect(ClosingReferences.make({ ids: [1, 2, 3] }).renderTrailer()).toBe("Closes #1, #2, #3");
	});

	it("renderTrailer is empty for no ids", () => {
		expect(ClosingReferences.make({ ids: [] }).renderTrailer()).toBe("");
	});

	it("renderBareLines emits one line per id", () => {
		expect(ClosingReferences.make({ ids: [1, 2] }).renderBareLines()).toBe("Closes #1\nCloses #2");
	});

	it("the two renderers never produce each other's spelling", () => {
		const refs = ClosingReferences.make({ ids: [1, 2] });
		expect(refs.renderTrailer()).not.toContain("\n");
		expect(refs.renderBareLines()).not.toContain(",");
	});
});

describe("ClosingReferences.parseBare", () => {
	it("accepts every GitHub closing keyword, any case, optional colon", () => {
		const region = ["Fixes: #601", "Closed #602", "resolve #603", "FIX #604", "Closes #605"].join("\n");
		expect([...ClosingReferences.parseBare(region)]).toEqual([601, 602, 603, 604, 605]);
	});

	it("ignores lines where the reference is not the whole line", () => {
		const region = ["See also #500", "Closes #1 and more text", "prefix Closes #2"].join("\n");
		expect(ClosingReferences.parseBare(region)).toHaveLength(0);
	});
});

describe("OwnedAttribute", () => {
	it("round-trips through render and parse", () => {
		const marker = `<!-- silk-release:references:start ${OwnedAttribute.render([10, 11])} -->`;
		expect([...OwnedAttribute.parse(marker)]).toEqual([10, 11]);
	});

	it("reads absent or malformed attributes as none — the fail-safe direction", () => {
		expect(OwnedAttribute.parse("no marker at all").size).toBe(0);
		expect(OwnedAttribute.parse("<!-- silk-release:references:start -->").size).toBe(0);
		expect(OwnedAttribute.parse('<!-- silk-release:references:start owned="oops" -->').size).toBe(0);
	});

	it("does not let data-owned or unowned lookalikes match", () => {
		expect(OwnedAttribute.parse('<!-- silk-release:references:start data-owned="700" -->').size).toBe(0);
		expect(OwnedAttribute.parse('<!-- silk-release:references:start unowned="700" -->').size).toBe(0);
	});
});
