import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NodeContext } from "@effect/platform-node";
import { ChangesetConfigReaderLive, Changesets } from "@savvy-web/silk-effects";
import { Effect, Layer, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkspacesLive } from "workspaces-effect";

import { renderClassificationLine, runClassify } from "../../src/commands/changeset/commands/classify.js";

const { ConfigInspectorLive } = Changesets;

const TestLive = ConfigInspectorLive.pipe(
	Layer.provide(Layer.mergeAll(ChangesetConfigReaderLive, WorkspacesLive)),
	Layer.provide(NodeContext.layer),
);
const silentLogger = Logger.replace(Logger.defaultLogger, Logger.none);

function setupFixture(): string {
	const dir = mkdtempSync(join(tmpdir(), "cs-cli-classify-"));
	writeFileSync(
		join(dir, "package.json"),
		JSON.stringify({ name: "root", version: "1.0.0", private: true, workspaces: ["packages/foo"] }),
	);
	writeFileSync(join(dir, "pnpm-workspace.yaml"), 'packages:\n  - "packages/foo"\n');
	writeFileSync(join(dir, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	mkdirSync(join(dir, "packages/foo"), { recursive: true });
	writeFileSync(join(dir, "packages/foo/package.json"), JSON.stringify({ name: "@scope/foo", version: "1.0.0" }));
	mkdirSync(join(dir, "plugin"), { recursive: true });
	writeFileSync(join(dir, "plugin/SKILL.md"), "");
	mkdirSync(join(dir, "packages/foo/src"), { recursive: true });
	writeFileSync(join(dir, "packages/foo/src/index.ts"), "");
	writeFileSync(join(dir, "unrelated.md"), "");
	mkdirSync(join(dir, ".changeset"), { recursive: true });
	writeFileSync(
		join(dir, ".changeset", "config.json"),
		JSON.stringify(
			{
				changelog: [
					"@savvy-web/changesets/changelog",
					{
						repo: "owner/repo",
						packages: { "@scope/foo": { additionalScopes: ["plugin/**"] } },
					},
				],
				baseBranch: "main",
			},
			null,
			2,
		),
	);
	return dir;
}

describe("classify – runClassify handler", () => {
	let dir: string;
	let savedExitCode: typeof process.exitCode;

	beforeEach(() => {
		dir = setupFixture();
		savedExitCode = process.exitCode;
		process.exitCode = undefined;
	});

	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
		process.exitCode = savedExitCode;
	});

	it("classifies workspace, additionalScope, and unmapped paths", async () => {
		await Effect.runPromise(
			runClassify(dir, ["packages/foo/src/index.ts", "plugin/SKILL.md", "unrelated.md"], false).pipe(
				Effect.provide(TestLive),
				Effect.provide(silentLogger),
			),
		);
		expect(process.exitCode).toBeUndefined();
	});

	it("emits valid JSON when --json is set", async () => {
		const logs: string[] = [];
		const captureLogger = Logger.replace(
			Logger.defaultLogger,
			Logger.make(({ message }) => {
				logs.push(String(message));
			}),
		);
		await Effect.runPromise(
			runClassify(dir, ["plugin/SKILL.md"], true).pipe(Effect.provide(TestLive), Effect.provide(captureLogger)),
		);
		expect(logs).toHaveLength(1);
		const parsed = JSON.parse(logs[0]);
		expect(parsed).toHaveLength(1);
		expect(parsed[0].path).toBe("plugin/SKILL.md");
		expect(parsed[0].package).toBe("@scope/foo");
	});

	it("sets exitCode=1 on ConfigurationError", async () => {
		writeFileSync(
			join(dir, ".changeset", "config.json"),
			JSON.stringify(
				{
					changelog: ["@savvy-web/changesets/changelog", { repo: "owner/repo", packages: { "@scope/ghost": {} } }],
				},
				null,
				2,
			),
		);
		await Effect.runPromise(
			runClassify(dir, ["plugin/SKILL.md"], false).pipe(
				Effect.provide(TestLive),
				Effect.provide(silentLogger),
				Effect.ignore,
			),
		);
		expect(process.exitCode).toBe(1);
	});
});

describe("renderClassificationLine", () => {
	it("renders an unmapped classification", () => {
		expect(renderClassificationLine({ path: "x.md", package: null, reason: null })).toContain("<unmapped>");
	});

	it("renders a workspace classification", () => {
		const line = renderClassificationLine({ path: "p/i.ts", package: "@s/foo", reason: "workspace" });
		expect(line).toContain("@s/foo");
		expect(line).toContain("workspace");
	});

	it("renders an additionalScope classification with the glob", () => {
		const line = renderClassificationLine({
			path: "p/x.md",
			package: "@s/foo",
			reason: { kind: "additionalScope", glob: "plugin/**" },
		});
		expect(line).toContain("additionalScope");
		expect(line).toContain("plugin/**");
	});

	it("renders a versionFile classification with the glob", () => {
		const line = renderClassificationLine({
			path: "p/m.json",
			package: "@s/foo",
			reason: { kind: "versionFile", glob: "plugin/m.json" },
		});
		expect(line).toContain("versionFile");
		expect(line).toContain("plugin/m.json");
	});
});
