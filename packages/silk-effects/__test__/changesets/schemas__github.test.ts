import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import {
	GitHubInfoSchema,
	IssueNumberSchema,
	UrlOrMarkdownLinkSchema,
	UsernameSchema,
} from "../../src/changesets/schemas/github.js";

describe("UsernameSchema", () => {
	const decode = Schema.decodeUnknownSync(UsernameSchema);

	it("accepts valid usernames", () => {
		expect(decode("octocat")).toBe("octocat");
		expect(decode("user-123")).toBe("user-123");
		expect(decode("a")).toBe("a");
	});

	it("rejects usernames starting with a hyphen", () => {
		expect(() => decode("-user")).toThrow(/cannot start or end with a hyphen/);
	});

	it("rejects usernames ending with a hyphen", () => {
		expect(() => decode("user-")).toThrow(/cannot start or end with a hyphen/);
	});

	it("rejects usernames with underscores", () => {
		expect(() => decode("user_name")).toThrow(/alphanumeric characters and hyphens/);
	});
});

describe("IssueNumberSchema", () => {
	const decode = Schema.decodeUnknownSync(IssueNumberSchema);

	it("accepts positive integers", () => {
		expect(decode(1)).toBe(1);
		expect(decode(123)).toBe(123);
		expect(decode(999999)).toBe(999999);
	});

	it("rejects zero", () => {
		expect(() => decode(0)).toThrow();
	});

	it("rejects negative numbers", () => {
		expect(() => decode(-1)).toThrow();
	});

	it("rejects non-integers", () => {
		expect(() => decode(1.5)).toThrow();
	});
});

describe("UrlOrMarkdownLinkSchema", () => {
	const decode = Schema.decodeUnknownSync(UrlOrMarkdownLinkSchema);

	it("accepts plain URLs", () => {
		expect(decode("https://github.com/owner/repo/pull/42")).toBe("https://github.com/owner/repo/pull/42");
	});

	it("accepts markdown links", () => {
		const link = "[#42](https://github.com/owner/repo/pull/42)";
		expect(decode(link)).toBe(link);
	});

	it("rejects plain text", () => {
		expect(() => decode("not a url")).toThrow(/valid URL or a markdown link/);
	});

	it("rejects markdown links with invalid URLs", () => {
		expect(() => decode("[text](not-a-url)")).toThrow(/valid URL or a markdown link/);
	});
});

describe("GitHubInfoSchema", () => {
	const decode = Schema.decodeUnknownSync(GitHubInfoSchema);

	it("accepts a full response", () => {
		const info = decode({
			user: "octocat",
			pull: 123,
			links: {
				commit: "https://github.com/owner/repo/commit/abc123",
				pull: "https://github.com/owner/repo/pull/123",
				user: "https://github.com/octocat",
			},
		});
		expect(info.user).toBe("octocat");
		expect(info.pull).toBe(123);
		expect(info.links.commit).toBe("https://github.com/owner/repo/commit/abc123");
	});

	it("accepts a minimal response (only commit link)", () => {
		const info = decode({
			links: {
				commit: "https://github.com/owner/repo/commit/abc123",
			},
		});
		expect(info.user).toBeUndefined();
		expect(info.pull).toBeUndefined();
		expect(info.links.pull).toBeUndefined();
	});

	it("accepts markdown-formatted links", () => {
		const info = decode({
			user: "octocat",
			pull: 42,
			links: {
				commit: "[`abc123`](https://github.com/owner/repo/commit/abc123)",
				pull: "[#42](https://github.com/owner/repo/pull/42)",
				user: "[@octocat](https://github.com/octocat)",
			},
		});
		expect(info.links.commit).toContain("abc123");
	});

	it("rejects missing links object", () => {
		expect(() => decode({ user: "octocat" })).toThrow();
	});

	it("rejects missing commit link", () => {
		expect(() => decode({ links: {} })).toThrow();
	});

	it("rejects invalid username in response", () => {
		expect(() =>
			decode({
				user: "-invalid",
				links: { commit: "https://github.com/owner/repo/commit/abc123" },
			}),
		).toThrow();
	});
});
