import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
	DependencyActionSchema,
	DependencyTableRowSchema,
	DependencyTableSchema,
	DependencyTableTypeSchema,
	VERSION_RE,
	VersionOrEmptySchema,
} from "../../src/changesets/schemas/dependency-table.js";

describe("DependencyTableTypeSchema", () => {
	const decode = Schema.decodeUnknownSync(DependencyTableTypeSchema);

	it("accepts valid dependency types", () => {
		for (const t of ["dependency", "devDependency", "peerDependency", "optionalDependency", "workspace", "config"]) {
			expect(decode(t)).toBe(t);
		}
	});

	it("rejects invalid types", () => {
		expect(() => decode("devDep")).toThrow();
		expect(() => decode("dependencies")).toThrow();
		expect(() => decode("")).toThrow();
	});
});

describe("DependencyActionSchema", () => {
	const decode = Schema.decodeUnknownSync(DependencyActionSchema);

	it("accepts valid actions", () => {
		for (const a of ["added", "updated", "removed"]) {
			expect(decode(a)).toBe(a);
		}
	});

	it("rejects invalid actions", () => {
		expect(() => decode("changed")).toThrow();
		expect(() => decode("")).toThrow();
	});
});

describe("VersionOrEmptySchema", () => {
	const decode = Schema.decodeUnknownSync(VersionOrEmptySchema);

	it("accepts em dash sentinel", () => {
		expect(decode("\u2014")).toBe("\u2014");
	});

	it("accepts semver versions", () => {
		expect(decode("1.0.0")).toBe("1.0.0");
		expect(decode("^5.4.0")).toBe("^5.4.0");
		expect(decode("~2.3.1")).toBe("~2.3.1");
	});

	it("accepts pre-release versions", () => {
		expect(decode("1.0.0-beta.1")).toBe("1.0.0-beta.1");
		expect(decode("^2.0.0-rc.3")).toBe("^2.0.0-rc.3");
	});

	it("accepts build metadata", () => {
		expect(decode("1.0.0+build.123")).toBe("1.0.0+build.123");
	});

	it("rejects invalid versions", () => {
		expect(() => decode("")).toThrow();
		expect(() => decode("latest")).toThrow();
		expect(() => decode("-")).toThrow(); // ASCII hyphen, not em dash
	});
});

describe("DependencyTableRowSchema", () => {
	const decode = Schema.decodeUnknownSync(DependencyTableRowSchema);

	it("accepts a valid updated row", () => {
		const row = decode({
			dependency: "typescript",
			type: "devDependency",
			action: "updated",
			from: "^5.4.0",
			to: "^5.6.0",
		});
		expect(row.dependency).toBe("typescript");
		expect(row.action).toBe("updated");
	});

	it("accepts a valid added row", () => {
		const row = decode({
			dependency: "new-pkg",
			type: "dependency",
			action: "added",
			from: "\u2014",
			to: "^1.0.0",
		});
		expect(row.action).toBe("added");
		expect(row.from).toBe("\u2014");
	});

	it("accepts a valid removed row", () => {
		const row = decode({
			dependency: "old-pkg",
			type: "dependency",
			action: "removed",
			from: "^2.0.0",
			to: "\u2014",
		});
		expect(row.action).toBe("removed");
		expect(row.to).toBe("\u2014");
	});

	it("accepts scoped package names", () => {
		const row = decode({
			dependency: "@savvy-web/changesets",
			type: "devDependency",
			action: "updated",
			from: "0.3.0",
			to: "0.4.0",
		});
		expect(row.dependency).toBe("@savvy-web/changesets");
	});

	it("rejects empty dependency name", () => {
		expect(() =>
			decode({
				dependency: "",
				type: "dependency",
				action: "updated",
				from: "1.0.0",
				to: "2.0.0",
			}),
		).toThrow();
	});
});

describe("DependencyTableSchema", () => {
	const decode = Schema.decodeUnknownSync(DependencyTableSchema);

	it("accepts array with at least one row", () => {
		const rows = decode([
			{
				dependency: "foo",
				type: "dependency",
				action: "updated",
				from: "1.0.0",
				to: "2.0.0",
			},
		]);
		expect(rows).toHaveLength(1);
	});

	it("rejects empty array", () => {
		expect(() => decode([])).toThrow();
	});
});

describe("VERSION_RE widening (protocol fallback)", () => {
	const decode = Schema.decodeUnknownExit(VersionOrEmptySchema);

	it("still accepts semver, ranges, and the em-dash sentinel", () => {
		for (const v of ["1.2.3", "^1.2.3", "~1.2.3", "1.2.3-beta.1", "—"]) {
			expect(VERSION_RE.test(v)).toBe(true);
		}
	});

	it("accepts pnpm protocol specifiers as a last resort", () => {
		for (const v of ["catalog:silk", "catalog:silkPeers", "workspace:*", "workspace:^", "npm:effect@3.19.0"]) {
			expect(VERSION_RE.test(v)).toBe(true);
			expect(decode(v)._tag).toBe("Success");
		}
	});

	it("still rejects arbitrary text", () => {
		for (const v of ["latest", "not a version", "1.2", "foo:bar"]) {
			expect(VERSION_RE.test(v)).toBe(false);
		}
	});

	it("rejects malformed cells: empty protocol payloads and dangling semver suffixes", () => {
		for (const v of ["catalog:", "workspace:", "npm:", "1.2.3-", "1.2.3+", "1.2.3."]) {
			expect(VERSION_RE.test(v)).toBe(false);
		}
	});
});
