import { describe, expect, it } from "vitest";
import { parseBashCommand } from "../../../src/commitlint/hook/parse-bash-command.js";

describe("parseBashCommand — kind detection", () => {
	it("identifies a plain git commit -m", () => {
		const r = parseBashCommand(`git commit -m "subject"`);
		expect(r.kind).toBe("git-commit");
		expect(r.message).toBe("subject");
	});

	it("returns kind=unknown for unrelated commands", () => {
		const r = parseBashCommand(`ls -la`);
		expect(r.kind).toBe("unknown");
		expect(r.message).toBeNull();
	});
});

describe("parseBashCommand — multiple -m and --message", () => {
	it("concatenates multiple -m flags with blank lines (git's documented behavior)", () => {
		const r = parseBashCommand(`git commit -m "subject" -m "body line 1" -m "body line 2"`);
		expect(r.message).toBe("subject\n\nbody line 1\n\nbody line 2");
	});

	it("handles --message=value", () => {
		const r = parseBashCommand(`git commit --message=hello`);
		expect(r.message).toBe("hello");
	});

	it("handles --message value (separate token)", () => {
		const r = parseBashCommand(`git commit --message hello`);
		expect(r.message).toBe("hello");
	});

	it("handles single quotes", () => {
		const r = parseBashCommand(`git commit -m 'with "nested" quotes'`);
		expect(r.message).toBe(`with "nested" quotes`);
	});
});

describe("parseBashCommand — flag detection", () => {
	it("detects -S as force-on", () => {
		const r = parseBashCommand(`git commit -S -m subj`);
		expect(r.flags.sign).toBe("force-on");
	});
	it("detects --gpg-sign as force-on", () => {
		expect(parseBashCommand(`git commit --gpg-sign -m s`).flags.sign).toBe("force-on");
	});
	it("detects --no-gpg-sign as force-off", () => {
		expect(parseBashCommand(`git commit --no-gpg-sign -m s`).flags.sign).toBe("force-off");
	});
	it("detects --no-verify", () => {
		expect(parseBashCommand(`git commit --no-verify -m s`).flags.noVerify).toBe(true);
	});
	it("detects --amend (no message; kind switches to git-commit-amend)", () => {
		const r = parseBashCommand(`git commit --amend --no-edit`);
		expect(r.kind).toBe("git-commit-amend");
		expect(r.flags.amend).toBe(true);
		expect(r.message).toBeNull();
	});
	it("amend with -m still parses the message", () => {
		const r = parseBashCommand(`git commit --amend -m "new subj"`);
		expect(r.kind).toBe("git-commit-amend");
		expect(r.message).toBe("new subj");
	});
});

describe("parseBashCommand — gh pr", () => {
	it("parses gh pr create --body", () => {
		const r = parseBashCommand(`gh pr create --title "T" --body "B"`);
		expect(r.kind).toBe("gh-pr-create");
		expect(r.message).toBe("B");
	});

	it("parses gh pr edit --body", () => {
		const r = parseBashCommand(`gh pr edit 123 --body "new body"`);
		expect(r.kind).toBe("gh-pr-edit");
		expect(r.message).toBe("new body");
	});

	it("returns null message when --body is absent", () => {
		const r = parseBashCommand(`gh pr create --title T`);
		expect(r.kind).toBe("gh-pr-create");
		expect(r.message).toBeNull();
	});
});
