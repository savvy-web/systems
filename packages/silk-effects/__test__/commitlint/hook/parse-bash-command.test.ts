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

describe("parseBashCommand — compound commands (#856)", () => {
	it("finds a git commit chained after another command", () => {
		const r = parseBashCommand(`git add -A && git commit -m "feat: x"`);
		expect(r.kind).toBe("git-commit");
		expect(r.message).toBe("feat: x");
	});

	it("finds a git commit after cd", () => {
		const r = parseBashCommand(`cd packages/cli && git commit -m "feat: x"`);
		expect(r.kind).toBe("git-commit");
		expect(r.message).toBe("feat: x");
	});

	it("skips leading environment assignments", () => {
		const r = parseBashCommand(`FOO=1 BAR=two git commit -m "feat: x"`);
		expect(r.kind).toBe("git-commit");
		expect(r.message).toBe("feat: x");
	});

	it("finds gh pr create after a semicolon", () => {
		const r = parseBashCommand(`gh pr view 1; gh pr create --title t --body "b"`);
		expect(r.kind).toBe("gh-pr-create");
		expect(r.message).toBe("b");
	});

	it("finds a git commit inside a subshell", () => {
		const r = parseBashCommand(`(cd packages/cli && git commit -m "feat: x")`);
		expect(r.kind).toBe("git-commit");
		expect(r.message).toBe("feat: x");
	});

	it("does not attribute a later command's flags to the commit", () => {
		const r = parseBashCommand(`git commit -m "feat: x" && git push --no-verify`);
		expect(r.kind).toBe("git-commit");
		expect(r.flags.noVerify).toBe(false);
		expect(r.message).toBe("feat: x");
	});

	it("keeps an operator inside a quoted message as text", () => {
		const r = parseBashCommand(`git commit -m "feat: a && b; c | d"`);
		expect(r.kind).toBe("git-commit");
		expect(r.message).toBe("feat: a && b; c | d");
	});

	it("stays unknown when no segment is a commit or PR command", () => {
		const r = parseBashCommand(`git status && git log --oneline -1 | head`);
		expect(r.kind).toBe("unknown");
	});
});

describe("parseBashCommand — newline-separated commands (#856)", () => {
	it("finds a git commit on the line after another command", () => {
		const r = parseBashCommand(`git add -A\ngit commit -m "feat: x"`);
		expect(r.kind).toBe("git-commit");
		expect(r.message).toBe("feat: x");
	});

	it("does not attribute the next line's flags to the commit", () => {
		const r = parseBashCommand(`git commit -m "feat: x"\ngit push --no-verify`);
		expect(r.kind).toBe("git-commit");
		expect(r.flags.noVerify).toBe(false);
	});

	it("keeps a newline inside a quoted message as text", () => {
		const r = parseBashCommand(`git commit -m "feat: x\n\nbody line"`);
		expect(r.kind).toBe("git-commit");
		expect(r.message).toBe("feat: x\n\nbody line");
	});

	it("joins a backslash-continued line instead of splitting it", () => {
		const r = parseBashCommand(`git commit \\\n  --no-verify \\\n  -m "feat: x"`);
		expect(r.kind).toBe("git-commit");
		expect(r.flags.noVerify).toBe(true);
		expect(r.message).toBe("feat: x");
	});

	it("does not read a heredoc body as commands", () => {
		const r = parseBashCommand(`git commit -F - <<'EOF'\nfix: x\n\ngit push --no-verify\nEOF`);
		expect(r.kind).toBe("git-commit");
		expect(r.flags.noVerify).toBe(false);
	});

	it("does not classify a commit command quoted inside a heredoc body", () => {
		const r = parseBashCommand(`cat <<'EOF' > msg.txt\ngit commit -m "not a command"\nEOF`);
		expect(r.kind).toBe("unknown");
	});

	it("resumes after a heredoc ends", () => {
		const r = parseBashCommand(`cat <<EOF > msg.txt\nfeat: x\nEOF\ngit commit -F msg.txt`);
		expect(r.kind).toBe("git-commit");
	});

	it("handles the agent heredoc commit form inside double quotes", () => {
		const r = parseBashCommand(`git add -A\ngit commit -m "$(cat <<'EOF'\nfeat: x\n\nbody\nEOF\n)"`);
		expect(r.kind).toBe("git-commit");
	});
});
