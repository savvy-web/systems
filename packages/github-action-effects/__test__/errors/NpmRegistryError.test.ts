import { describe, expect, it } from "@effect/vitest";
import { NpmRegistryError } from "../../src/errors/NpmRegistryError.js";

describe("NpmRegistryError", () => {
	it("preserves _tag as NpmRegistryError", () => {
		const err = new NpmRegistryError({ pkg: "effect", operation: "view", reason: "not found" });
		expect(err._tag).toBe("NpmRegistryError");
	});

	it("message composes [operation] pkg: reason", () => {
		const err = new NpmRegistryError({ pkg: "effect", operation: "view", reason: "not found" });
		expect(err.message).toBe("[view] effect: not found");
	});

	it("message reflects search operation", () => {
		const err = new NpmRegistryError({ pkg: "@scope/pkg", operation: "search", reason: "timeout" });
		expect(err.message).toBe("[search] @scope/pkg: timeout");
	});

	it("message reflects versions operation", () => {
		const err = new NpmRegistryError({ pkg: "typescript", operation: "versions", reason: "registry unreachable" });
		expect(err.message).toBe("[versions] typescript: registry unreachable");
	});
});
