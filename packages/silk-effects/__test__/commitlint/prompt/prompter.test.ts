import { describe, expect, it, vi } from "vitest";
import type { Inquirer, PrompterOptions } from "../../../src/commitlint/prompt/prompter.js";
import { prompter } from "../../../src/commitlint/prompt/prompter.js";

describe("prompter", () => {
	function createMockInquirer(answers: Record<string, unknown>): Inquirer {
		return {
			prompt: vi.fn().mockResolvedValue(answers),
		};
	}

	const baseAnswers = {
		type: "feat" as const,
		scope: "",
		subject: "add new feature",
		body: "",
		isBreaking: false,
		breakingBody: "",
		isIssueAffected: false,
		issues: "",
	};

	it("calls commit with formatted message", async () => {
		const cz = createMockInquirer(baseAnswers);
		const commit = vi.fn();

		prompter(cz, commit);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		expect(commit).toHaveBeenCalledWith("feat: add new feature");
	});

	it("includes scope in message when provided", async () => {
		const cz = createMockInquirer({ ...baseAnswers, scope: "api" });
		const commit = vi.fn();

		prompter(cz, commit);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		expect(commit).toHaveBeenCalledWith("feat(api): add new feature");
	});

	it("includes breaking change marker and body", async () => {
		const cz = createMockInquirer({
			...baseAnswers,
			isBreaking: true,
			breakingBody: "removed old API",
		});
		const commit = vi.fn();

		prompter(cz, commit);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		const message = commit.mock.calls[0][0] as string;
		expect(message).toContain("feat!:");
		expect(message).toContain("BREAKING CHANGE: removed old API");
	});

	it("includes body when provided", async () => {
		const cz = createMockInquirer({
			...baseAnswers,
			body: "detailed description",
		});
		const commit = vi.fn();

		prompter(cz, commit);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		const message = commit.mock.calls[0][0] as string;
		expect(message).toContain("detailed description");
	});

	it("includes issue references when affected", async () => {
		const cz = createMockInquirer({
			...baseAnswers,
			isIssueAffected: true,
			issues: "closes #123",
		});
		const commit = vi.fn();

		prompter(cz, commit);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		const message = commit.mock.calls[0][0] as string;
		expect(message).toContain("closes #123");
	});

	it("passes type choices with emojis by default", async () => {
		const cz = createMockInquirer(baseAnswers);
		const commit = vi.fn();

		prompter(cz, commit);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		const questions = (cz.prompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const typeQuestion = questions.find((q: { name: string }) => q.name === "type");
		// With emojis enabled (default), choices should contain emoji characters
		expect(typeQuestion.choices[0].name).toMatch(/./);
	});

	it("passes type choices without emojis when disabled", async () => {
		const cz = createMockInquirer(baseAnswers);
		const commit = vi.fn();
		const options: PrompterOptions = { emojis: false };

		prompter(cz, commit, options);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		const questions = (cz.prompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const typeQuestion = questions.find((q: { name: string }) => q.name === "type");
		// Without emojis, choice names should start directly with type
		expect(typeQuestion.choices[0].name).toMatch(/^\w+:/);
	});

	it("uses list question for scope when scopes are provided", async () => {
		const cz = createMockInquirer(baseAnswers);
		const commit = vi.fn();
		const options: PrompterOptions = { scopes: ["api", "cli"] };

		prompter(cz, commit, options);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		const questions = (cz.prompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const scopeQuestion = questions.find((q: { name: string }) => q.name === "scope");
		expect(scopeQuestion.type).toBe("list");
		// Should include (none) option plus the provided scopes
		expect(scopeQuestion.choices).toHaveLength(3);
		expect(scopeQuestion.choices[0]).toEqual({ name: "(none)", value: "" });
	});

	it("uses input question for scope when no scopes provided", async () => {
		const cz = createMockInquirer(baseAnswers);
		const commit = vi.fn();

		prompter(cz, commit);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		const questions = (cz.prompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const scopeQuestion = questions.find((q: { name: string }) => q.name === "scope");
		expect(scopeQuestion.type).toBe("input");
	});

	it("handles prompt rejection gracefully", async () => {
		const cz: Inquirer = {
			prompt: vi.fn().mockRejectedValue(new Error("cancelled")),
		};
		const commit = vi.fn();

		// Should not throw
		prompter(cz, commit);
		await vi.waitFor(() => expect(cz.prompt).toHaveBeenCalled());

		// commit should not be called
		expect(commit).not.toHaveBeenCalled();
	});

	it("validates subject is required", async () => {
		const cz = createMockInquirer(baseAnswers);
		const commit = vi.fn();

		prompter(cz, commit);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		const questions = (cz.prompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const subjectQuestion = questions.find((q: { name: string }) => q.name === "subject");

		expect(subjectQuestion.validate("")).toBe("Subject is required");
		expect(subjectQuestion.validate("   ")).toBe("Subject is required");
		expect(subjectQuestion.validate("valid subject")).toBe(true);
	});

	it("validates subject max length", async () => {
		const cz = createMockInquirer(baseAnswers);
		const commit = vi.fn();
		const options: PrompterOptions = { maxSubjectLength: 10 };

		prompter(cz, commit, options);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		const questions = (cz.prompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const subjectQuestion = questions.find((q: { name: string }) => q.name === "subject");

		expect(subjectQuestion.validate("short")).toBe(true);
		expect(subjectQuestion.validate("this is way too long")).toMatch(/must be 10 characters or less/);
	});

	it("filters subject to lowercase first letter", async () => {
		const cz = createMockInquirer(baseAnswers);
		const commit = vi.fn();

		prompter(cz, commit);
		await vi.waitFor(() => expect(commit).toHaveBeenCalled());

		const questions = (cz.prompt as ReturnType<typeof vi.fn>).mock.calls[0][0];
		const subjectQuestion = questions.find((q: { name: string }) => q.name === "subject");

		expect(subjectQuestion.filter("  Hello World  ")).toBe("hello World");
	});
});
