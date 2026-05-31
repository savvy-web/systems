import { describe, expect, it } from "vitest";
import { inferTicketId } from "../../../../src/commitlint/hook/diagnostics/branch.js";

describe("inferTicketId", () => {
	it("returns the digit run for fix/123-something", () => {
		expect(inferTicketId("fix/123-something")).toBe(123);
	});
	it("returns null when digits are not immediately after the type segment", () => {
		expect(inferTicketId("feat/issue-456")).toBeNull();
	});
	it("returns the digit run for chore/42_dependencies", () => {
		expect(inferTicketId("chore/42_dependencies")).toBe(42);
	});
	it("returns null when no digits follow the type segment", () => {
		expect(inferTicketId("feat/clarity")).toBeNull();
	});
	it("returns null for unstructured branch names", () => {
		expect(inferTicketId("just-a-branch")).toBeNull();
	});
});
