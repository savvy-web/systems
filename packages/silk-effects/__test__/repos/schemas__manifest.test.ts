import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";
import { RepoName, ReposManifestFile } from "../../src/repos/schemas/manifest.js";

const valid = {
	repos: {
		"effect-smol": {
			url: "https://github.com/Effect-TS/effect-smol",
			ref: "effect@4.0.0-beta.97",
			purpose: "Read-only Effect v4 source; authority on what v4 exports.",
			sparse: ["packages/effect/src"],
			orientation: {
				layout: "pnpm monorepo; only packages/effect matters",
				keyPaths: { "packages/effect/src/index.ts": "authoritative export barrel" },
				startHere: "Grep packages/effect/src, not the repo root.",
			},
			notes: [
				{ id: "n-7f3a", date: "2026-07-12", ref: "effect@4.0.0-beta.97", note: "Schema.Class moved in beta.90+" },
			],
		},
	},
};

describe("ReposManifestFile", () => {
	it("decodes a full manifest", () => {
		const decoded = Schema.decodeUnknownSync(ReposManifestFile)(valid);
		expect(Object.keys(decoded.repos)).toEqual(["effect-smol"]);
		expect(decoded.repos["effect-smol"]?.notes?.[0]?.id).toBe("n-7f3a");
	});
	it("decodes a minimal entry (no sparse/orientation/notes)", () => {
		const min = { repos: { spec: { url: "https://example.com/spec.git", ref: "1.0.0", purpose: "spec authority" } } };
		expect(() => Schema.decodeUnknownSync(ReposManifestFile)(min)).not.toThrow();
	});
	it("rejects an entry with an empty purpose", () => {
		const bad = { repos: { x: { url: "https://e.com/x.git", ref: "1.0.0", purpose: "" } } };
		expect(() => Schema.decodeUnknownSync(ReposManifestFile)(bad)).toThrow();
	});
	it("rejects a missing purpose", () => {
		const bad = { repos: { x: { url: "https://e.com/x.git", ref: "1.0.0" } } };
		expect(() => Schema.decodeUnknownSync(ReposManifestFile)(bad)).toThrow();
	});

	it.each(["../x", "a/b", "..", "."])("rejects a manifest whose repos key is %j", (badKey) => {
		const bad = { repos: { [badKey]: { url: "https://e.com/x.git", ref: "1.0.0", purpose: "p" } } };
		expect(() => Schema.decodeUnknownSync(ReposManifestFile)(bad)).toThrow();
	});

	it("rejects an empty-string repos key", () => {
		const bad = { repos: { "": { url: "https://e.com/x.git", ref: "1.0.0", purpose: "p" } } };
		expect(() => Schema.decodeUnknownSync(ReposManifestFile)(bad)).toThrow();
	});
});

describe("RepoName", () => {
	it.each(["../x", "a/b", "a\\b", "..", ".", ""])("rejects %j", (bad) => {
		expect(() => Schema.decodeUnknownSync(RepoName)(bad)).toThrow();
	});

	it.each(["spec", "effect-smol", "my_repo.v2"])("accepts %j", (good) => {
		expect(Schema.decodeUnknownSync(RepoName)(good)).toBe(good);
	});
});
