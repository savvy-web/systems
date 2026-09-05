import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommentStyle, SectionId } from "@effected/templates";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SavvyInstallSection, savvyInstallDeps } from "../../src/schemas/SavvyInstallSection.js";

/**
 * These tests EXECUTE the generated shell rather than string-match it.
 *
 * The section's whole product is behaviour under a real `sh`: which argument
 * shape suppresses it, whether the diff gate actually narrows to dependency
 * files, and which flag each package manager is handed. A snapshot assertion
 * proves the bytes and none of that, so every case here builds a throwaway git
 * repo, puts a recording fake on PATH in place of the package manager, and
 * reads back what the hook decided to run.
 */

let repo: string;
let bin: string;

/** Path the fake package manager appends one line of argv to per invocation. */
const logPath = () => join(bin, "invocations.log");

const git = (...args: ReadonlyArray<string>): string =>
	execFileSync("git", [...args], {
		cwd: repo,
		encoding: "utf8",
		env: {
			...process.env,
			GIT_AUTHOR_NAME: "t",
			GIT_AUTHOR_EMAIL: "t@t",
			GIT_COMMITTER_NAME: "t",
			GIT_COMMITTER_EMAIL: "t@t",
		},
	}).trim();

/**
 * Installs a fake `name` on PATH that records its argv and exits `exitCode`.
 *
 * `--version` is answered separately from an install so the yarn major-version
 * probe can be steered without also steering the install's exit status.
 */
const fakePm = (name: string, options: { version?: string; exitCode?: number } = {}): void => {
	const script = `#!/bin/sh
if [ "$1" = "--version" ]; then echo "${options.version ?? "9.9.9"}"; exit 0; fi
echo "${name} $*" >> "${logPath()}"
exit ${options.exitCode ?? 0}
`;
	const file = join(bin, name);
	writeFileSync(file, script);
	chmodSync(file, 0o755);
};

/** Every line the fakes recorded, in order. */
const invocations = (): ReadonlyArray<string> => {
	try {
		return execFileSync("cat", [logPath()], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
	} catch {
		return [];
	}
};

/**
 * Runs the section for `hook` with `args`, returning its exit code.
 *
 * `PATH` leads with the fake bin so the recording stub shadows any real
 * manager, and `CI`/`GITHUB_ACTIONS` are cleared because the suite itself
 * routinely runs under them — inheriting either would make every case pass by
 * taking the CI skip.
 */
const runHook = (
	hook: "post-checkout" | "post-merge",
	args: ReadonlyArray<string> = [],
	env: Record<string, string> = {},
): number => {
	const hookFile = join(repo, "hook.sh");
	writeFileSync(hookFile, `${savvyInstallDeps(hook)}\n`);
	const child = spawnSync("sh", [hookFile, ...args], {
		cwd: repo,
		encoding: "utf8",
		env: {
			...process.env,
			CI: "",
			GITHUB_ACTIONS: "",
			SAVVY_SKIP_INSTALL: "",
			PATH: `${bin}:${process.env.PATH ?? ""}`,
			...env,
		},
	});
	if (child.status === null) throw new Error(`hook did not exit: ${String(child.error)}`);
	lastStderr = child.stderr;
	return child.status;
};

/** Stderr from the most recent {@link runHook}, where the hook's own notices land. */
let lastStderr = "";

beforeEach(() => {
	repo = mkdtempSync(join(tmpdir(), "savvy-install-"));
	bin = mkdtempSync(join(tmpdir(), "savvy-bin-"));
	writeFileSync(logPath(), "");
	git("init", "--initial-branch=main");
	writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "fixture", packageManager: "pnpm@11.0.0" }));
	writeFileSync(join(repo, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
	writeFileSync(join(repo, "README.md"), "one\n");
	mkdirSync(join(repo, "node_modules"), { recursive: true });
	git("add", "-A");
	git("commit", "-m", "base");
	fakePm("pnpm");
});

afterEach(() => {
	rmSync(repo, { recursive: true, force: true });
	rmSync(bin, { recursive: true, force: true });
});

/** Commits `content` to `file` and returns the new HEAD sha. */
const commitChange = (file: string, content: string): string => {
	writeFileSync(join(repo, file), content);
	git("add", "-A");
	git("commit", "-m", `touch ${file}`);
	return git("rev-parse", "HEAD");
};

describe("savvyInstallDeps (post-checkout)", () => {
	it("installs when a lockfile changed across a branch checkout", () => {
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");

		runHook("post-checkout", [before, after, "1"]);

		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});

	it("installs when a nested workspace package.json changed", () => {
		const before = git("rev-parse", "HEAD");
		mkdirSync(join(repo, "packages/a"), { recursive: true });
		const after = commitChange("packages/a/package.json", JSON.stringify({ name: "a" }));

		runHook("post-checkout", [before, after, "1"]);

		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});

	it("stays silent when only unrelated files changed", () => {
		const before = git("rev-parse", "HEAD");
		const after = commitChange("README.md", "two\n");

		runHook("post-checkout", [before, after, "1"]);

		expect(invocations()).toEqual([]);
	});

	it("stays silent for a file checkout (branch flag 0)", () => {
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");

		runHook("post-checkout", [before, after, "0"]);

		expect(invocations()).toEqual([]);
	});

	it("installs when node_modules is absent even with no dependency change", () => {
		rmSync(join(repo, "node_modules"), { recursive: true, force: true });
		const before = git("rev-parse", "HEAD");
		const after = commitChange("README.md", "two\n");

		runHook("post-checkout", [before, after, "1"]);

		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});

	it("stays silent under CI", () => {
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");

		runHook("post-checkout", [before, after, "1"], { CI: "true" });

		expect(invocations()).toEqual([]);
	});

	it("stays silent when SAVVY_SKIP_INSTALL is set", () => {
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");

		runHook("post-checkout", [before, after, "1"], { SAVVY_SKIP_INSTALL: "1" });

		expect(invocations()).toEqual([]);
	});

	it("stays silent when the detected manager is not on PATH", () => {
		rmSync(join(bin, "pnpm"), { force: true });
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");

		runHook("post-checkout", [before, after, "1"]);

		expect(invocations()).toEqual([]);
	});

	it("does not fail the hook when the install itself fails", () => {
		fakePm("pnpm", { exitCode: 1 });
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");

		expect(runHook("post-checkout", [before, after, "1"])).toBe(0);
		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});

	it("hands yarn berry --mode=skip-build and yarn classic --ignore-scripts", () => {
		writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "fixture", packageManager: "yarn@4.1.0" }));
		writeFileSync(join(repo, "yarn.lock"), "# yarn\n");
		git("add", "-A");
		git("commit", "-m", "yarn");
		const before = git("rev-parse", "HEAD");
		const after = commitChange("yarn.lock", "# yarn 2\n");

		fakePm("yarn", { version: "4.1.0" });
		runHook("post-checkout", [before, after, "1"]);
		expect(invocations()).toEqual(["yarn install --mode=skip-build"]);

		writeFileSync(logPath(), "");
		fakePm("yarn", { version: "1.22.22" });
		runHook("post-checkout", [before, after, "1"]);
		expect(invocations()).toEqual(["yarn install --ignore-scripts"]);
	});
});

describe("savvyInstallDeps (post-merge)", () => {
	it("installs off ORIG_HEAD..HEAD when a lockfile changed", () => {
		const before = git("rev-parse", "HEAD");
		commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");
		writeFileSync(join(repo, ".git/ORIG_HEAD"), `${before}\n`);

		runHook("post-merge", ["0"]);

		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});

	it("stays silent when ORIG_HEAD is absent", () => {
		commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");
		rmSync(join(repo, ".git/ORIG_HEAD"), { force: true });

		runHook("post-merge", ["0"]);

		expect(invocations()).toEqual([]);
	});

	it("ignores the branch-flag position a post-checkout hook would read", () => {
		const before = git("rev-parse", "HEAD");
		commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");
		writeFileSync(join(repo, ".git/ORIG_HEAD"), `${before}\n`);

		// post-merge's only argument is the squash flag; there is no "$3" to gate on.
		runHook("post-merge", ["1"]);

		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});
});

describe("savvyInstallDeps (built link directories)", () => {
	/**
	 * A workspace whose packages publish through `publishConfig.directory` with
	 * `linkDirectory: true` resolves its own workspace dependencies through a
	 * directory that a lifecycle script has to build first. `--ignore-scripts`
	 * there produces a populated `node_modules` pointing at nothing, which is
	 * worse than a slower install — so those repos take the scripts.
	 */
	const declareLinkedPackage = (publishConfig: Record<string, unknown>): void => {
		mkdirSync(join(repo, "packages/a"), { recursive: true });
		writeFileSync(join(repo, "packages/a/package.json"), JSON.stringify({ name: "a", publishConfig }));
		git("add", "-A");
		git("commit", "-m", "add package a");
	};

	it("drops --ignore-scripts when a workspace package links to a built directory", () => {
		declareLinkedPackage({ directory: "dist/dev/pkg", linkDirectory: true });
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");

		runHook("post-checkout", [before, after, "1"]);

		expect(invocations()).toEqual(["pnpm install"]);
	});

	it("keeps --ignore-scripts when a directory is published without linkDirectory", () => {
		// publishConfig.directory alone changes what is PUBLISHED, not how the
		// workspace resolves itself — nothing needs building for the link to work.
		declareLinkedPackage({ directory: "dist/dev/pkg" });
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");

		runHook("post-checkout", [before, after, "1"]);

		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});

	it("keeps --ignore-scripts for an ordinary workspace with no publishConfig", () => {
		declareLinkedPackage({});
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");

		runHook("post-checkout", [before, after, "1"]);

		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});

	it("ignores an untracked package.json, matching what a checkout can carry", () => {
		// Detection reads the index, not the working tree: a file git does not
		// track cannot have arrived with the checkout that triggered this hook.
		// Written AFTER the commits — commitChange stages everything, so creating
		// it earlier would quietly track it and test nothing.
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");
		mkdirSync(join(repo, "packages/b"), { recursive: true });
		writeFileSync(
			join(repo, "packages/b/package.json"),
			JSON.stringify({ name: "b", publishConfig: { directory: "dist", linkDirectory: true } }),
		);

		runHook("post-checkout", [before, after, "1"]);

		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});
	it("announces a full install without a dangling separator", () => {
		declareLinkedPackage({ directory: "dist/dev/pkg", linkDirectory: true });
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");

		runHook("post-checkout", [before, after, "1"]);

		// No flag to name, so the line ends at the command — not at a stray space.
		expect(lastStderr).toContain("running pnpm install\n");
	});

	it("names the flag when there is one to name", () => {
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");

		runHook("post-checkout", [before, after, "1"]);

		expect(lastStderr).toContain("running pnpm install --ignore-scripts\n");
	});
});

describe("savvyInstallDeps under set -e", () => {
	/**
	 * A consumer hook may run under `set -e`, and these blocks are co-owned: user
	 * content can sit below them. A bare command substitution that exits non-zero
	 * would abort the whole hook there, silently taking those later sections with
	 * it — so every probe that can legitimately fail has to be neutralised.
	 */
	const survivesSetE = (hook: "post-checkout" | "post-merge", args: ReadonlyArray<string>): boolean => {
		const hookFile = join(repo, "hook-sete.sh");
		writeFileSync(hookFile, `set -e\n${savvyInstallDeps(hook)}\necho reached-the-end\n`);
		const child = spawnSync("sh", [hookFile, ...args], {
			cwd: repo,
			encoding: "utf8",
			env: {
				...process.env,
				CI: "",
				GITHUB_ACTIONS: "",
				SAVVY_SKIP_INSTALL: "",
				PATH: `${bin}:${process.env.PATH ?? ""}`,
			},
		});
		return child.stdout.includes("reached-the-end");
	};

	it("runs the hook to completion when ORIG_HEAD is absent", () => {
		commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");
		rmSync(join(repo, ".git/ORIG_HEAD"), { force: true });

		expect(survivesSetE("post-merge", ["0"])).toBe(true);
	});

	it("runs the hook to completion when the diff range is unresolvable", () => {
		const bogus = "0000000000000000000000000000000000000000";

		expect(survivesSetE("post-checkout", [bogus, "HEAD", "1"])).toBe(true);
	});
});

describe("SavvyInstallSection", () => {
	it("is a hash-comment section keyed SAVVY-INSTALL", () => {
		expect(SavvyInstallSection).toBeInstanceOf(SectionId);
		expect(SavvyInstallSection.key).toBe("SAVVY-INSTALL");
		expect(SavvyInstallSection.commentStyle).toStrictEqual(CommentStyle.hash);
	});

	it("leaves no shell variables behind", () => {
		for (const hook of ["post-checkout", "post-merge"] as const) {
			expect(savvyInstallDeps(hook)).toContain("unset install_");
		}
	});
});
