import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
	ChangesetSchema,
	ChangesetSummarySchema,
	DependencyTypeSchema,
	DependencyUpdateSchema,
} from "../../src/changesets/schemas/changeset.js";

describe("ChangesetSummarySchema", () => {
	const decode = Schema.decodeUnknownSync(ChangesetSummarySchema);

	it("accepts valid summaries", () => {
		expect(decode("Fix critical bug")).toBe("Fix critical bug");
	});

	it("rejects empty strings", () => {
		expect(() => decode("")).toThrow(/cannot be empty.*1-1000 character/);
	});

	it("rejects summaries over 1000 characters", () => {
		expect(() => decode("a".repeat(1001))).toThrow(/exceeds the 1000 character limit/);
	});
});

describe("ChangesetSchema", () => {
	const decode = Schema.decodeUnknownSync(ChangesetSchema);

	it("accepts a full changeset", () => {
		const cs = decode({
			summary: "feat: add auth",
			id: "brave-pandas-learn",
			commit: "abc123d",
		});
		expect(cs.summary).toBe("feat: add auth");
		expect(cs.id).toBe("brave-pandas-learn");
		expect(cs.commit).toBe("abc123d");
	});

	it("accepts a changeset without commit", () => {
		const cs = decode({ summary: "Fix bug", id: "clever-foxes" });
		expect(cs.commit).toBeUndefined();
	});

	it("rejects missing summary", () => {
		expect(() => decode({ id: "test" })).toThrow();
	});

	it("rejects invalid commit hash", () => {
		expect(() => decode({ summary: "x", id: "y", commit: "short" })).toThrow();
	});
});

describe("DependencyTypeSchema", () => {
	const decode = Schema.decodeUnknownSync(DependencyTypeSchema);

	it.each(["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"])("accepts '%s'", (type) => {
		expect(decode(type)).toBe(type);
	});

	it("rejects invalid types", () => {
		expect(() => decode("bundledDependencies")).toThrow();
	});
});

describe("DependencyUpdateSchema", () => {
	const decode = Schema.decodeUnknownSync(DependencyUpdateSchema);

	it("accepts a valid dependency update", () => {
		const dep = decode({
			name: "@types/node",
			type: "devDependencies",
			oldVersion: "18.0.0",
			newVersion: "20.0.0",
		});
		expect(dep.name).toBe("@types/node");
	});

	it("rejects empty package name", () => {
		expect(() => decode({ name: "", type: "dependencies", oldVersion: "1.0.0", newVersion: "2.0.0" })).toThrow();
	});
});
