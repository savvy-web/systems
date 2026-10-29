// packages/bundler/__test__/runtime-env.test.ts
import { describe, expect, it } from "vitest";
import { isCi, reportNoColor } from "../src/runtime-env.js";

describe("isCi", () => {
	it("is false for an empty environment and for CI=false", () => {
		expect(isCi({})).toBe(false);
		expect(isCi({ CI: "false" })).toBe(false);
	});

	it("is true for CI=true, CI=1 and a provider marker alone", () => {
		expect(isCi({ CI: "true" })).toBe(true);
		expect(isCi({ CI: "1" })).toBe(true);
		expect(isCi({ GITHUB_ACTIONS: "true" })).toBe(true);
		expect(isCi({ GITLAB_CI: "true" })).toBe(true);
	});
});

describe("reportNoColor", () => {
	it("a colour-capable TTY paints", () => {
		expect(reportNoColor({ TERM: "xterm-256color" }, true)).toBe(false);
	});

	it("a non-TTY stdout is plain", () => {
		expect(reportNoColor({ TERM: "xterm-256color" }, false)).toBe(true);
	});

	it("NO_COLOR turns a TTY plain", () => {
		expect(reportNoColor({ TERM: "xterm-256color", NO_COLOR: "1" }, true)).toBe(true);
	});

	it("FORCE_COLOR paints a non-TTY stdout and beats NO_COLOR", () => {
		expect(reportNoColor({ FORCE_COLOR: "1" }, false)).toBe(false);
		expect(reportNoColor({ FORCE_COLOR: "1", NO_COLOR: "1" }, false)).toBe(false);
		expect(reportNoColor({ FORCE_COLOR: "0" }, true)).toBe(true);
	});

	it("a TTY with no TERM/COLORTERM hint is plain (changed: the old rule painted every TTY)", () => {
		expect(reportNoColor({}, true)).toBe(true);
	});
});
