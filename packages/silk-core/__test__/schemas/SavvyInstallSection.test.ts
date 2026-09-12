import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommentStyle, SectionId } from "@effected/templates";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	LIFECYCLE_SCRIPTS_CONFIG_KEY,
	SavvyInstallSection,
	publishesBuiltLinkDirectory,
	savvyInstallDeps,
} from "../../src/schemas/SavvyInstallSection.js";

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
/** Stderr from the most recent {@link runHook}, where the hook's own notices land. */
let lastStderr = "";

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
		return readFileSync(logPath(), "utf8").trim().split("\n").filter(Boolean);
	} catch {
		return [];
	}
};

/**
 * Whether `jq` is on PATH.
 *
 * The block reads `packageManager` through `jq` and falls back to the lockfile
 * ladder without it, so the one test that asserts on manifest-driven detection
 * has to say so rather than quietly asserting the fallback's answer instead.
 */
const hasJq = spawnSync("sh", ["-c", "command -v jq"], { encoding: "utf8" }).status === 0;

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

beforeEach(() => {
	lastStderr = "";
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
		// Detection runs through the LOCKFILE ladder here, not `packageManager`:
		// dropping pnpm-lock.yaml leaves yarn.lock the only candidate, which keeps
		// this test — about the Berry/Classic flag split — independent of `jq`.
		writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "fixture" }));
		rmSync(join(repo, "pnpm-lock.yaml"), { force: true });
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

describe("savvyInstallDeps (lifecycle scripts)", () => {
	/**
	 * Whether lifecycle scripts run is decided by LOCAL git config, never by the
	 * revision being checked out.
	 *
	 * A workspace that publishes through a built link directory needs its
	 * `prepare` scripts to materialise the directories its own workspace links
	 * point at, so it has to be able to ask for a full install. Reading that
	 * intent out of the checked-out manifest would have made `git checkout` of an
	 * untrusted branch a code-execution path, and would additionally have gone
	 * the WRONG way when `jq` is absent — silently skipping scripts in exactly
	 * the repos that cannot survive it. `.git/config` is neither checked out nor
	 * parsed with `jq`, so it has neither problem. `savvy init` sets it.
	 */
	const setOptIn = (value: string): void => {
		git("config", "--local", "savvy.installLifecycleScripts", value);
	};

	/** Commits a manifest declaring the built-link-directory shape. */
	const declareLinkedPackage = (): void => {
		mkdirSync(join(repo, "packages/a"), { recursive: true });
		writeFileSync(
			join(repo, "packages/a/package.json"),
			JSON.stringify({ name: "a", publishConfig: { directory: "dist/dev/pkg", linkDirectory: true } }),
		);
		git("add", "-A");
		git("commit", "-m", "add package a");
	};

	const bumpLockfile = (): ReadonlyArray<string> => {
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");
		return [before, after, "1"];
	};

	it("runs a full install when the local opt-in is set", () => {
		setOptIn("true");

		runHook("post-checkout", bumpLockfile());

		expect(invocations()).toEqual(["pnpm install"]);
	});

	it("skips lifecycle scripts by default", () => {
		runHook("post-checkout", bumpLockfile());

		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});

	it("skips lifecycle scripts when the opt-in is explicitly false", () => {
		setOptIn("false");

		runHook("post-checkout", bumpLockfile());

		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});

	it("does not let a checked-out manifest enable lifecycle scripts", () => {
		// The security case: a branch that adds the built-link-directory shape
		// must NOT be able to turn scripts back on by being checked out. Without
		// the local opt-in this stays suppressed no matter what the tree says.
		declareLinkedPackage();

		runHook("post-checkout", bumpLockfile());

		expect(invocations()).toEqual(["pnpm install --ignore-scripts"]);
	});

	it("announces a full install without a dangling separator", () => {
		setOptIn("true");

		runHook("post-checkout", bumpLockfile());

		// No flag to name, so the line ends at the command — not at a stray space.
		expect(lastStderr).toContain("running pnpm install\n");
	});

	it("names the flag when there is one to name", () => {
		runHook("post-checkout", bumpLockfile());

		expect(lastStderr).toContain("running pnpm install --ignore-scripts\n");
	});
});

describe("savvyInstallDeps (package-manager allowlist)", () => {
	/**
	 * `packageManager` comes from the checked-out revision, so it names an
	 * executable an attacker controls. `command -v` proves a binary exists, not
	 * that it is a package manager — the name has to be checked against the four
	 * that are actually supported before anything is run.
	 */
	const declareManager = (name: string): ReadonlyArray<string> => {
		writeFileSync(join(repo, "package.json"), JSON.stringify({ name: "fixture", packageManager: `${name}@1.0.0` }));
		git("add", "-A");
		git("commit", "-m", `use ${name}`);
		const before = git("rev-parse", "HEAD");
		const after = commitChange("pnpm-lock.yaml", "lockfileVersion: '9.1'\n");
		return [before, after, "1"];
	};

	it.skipIf(!hasJq)("refuses a manager outside the allowlist even when it is on PATH", () => {
		fakePm("python");
		const args = declareManager("python");

		runHook("post-checkout", args);

		expect(invocations()).toEqual([]);
	});

	it.skipIf(!hasJq)("accepts a manager named in the manifest when it is allowlisted", () => {
		fakePm("npm");
		const args = declareManager("npm");

		runHook("post-checkout", args);

		expect(invocations()).toEqual(["npm install --ignore-scripts"]);
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

describe("publishesBuiltLinkDirectory", () => {
	it("accepts a directory paired with linkDirectory", () => {
		expect(publishesBuiltLinkDirectory({ publishConfig: { directory: "dist/dev/pkg", linkDirectory: true } })).toBe(
			true,
		);
	});

	it("rejects a directory without linkDirectory", () => {
		// publishConfig.directory alone changes what is PUBLISHED, not how the
		// workspace resolves itself — nothing needs building for the link to work.
		expect(publishesBuiltLinkDirectory({ publishConfig: { directory: "dist/dev/pkg" } })).toBe(false);
	});

	it("rejects linkDirectory without a directory", () => {
		expect(publishesBuiltLinkDirectory({ publishConfig: { linkDirectory: true } })).toBe(false);
	});

	it("rejects an empty directory", () => {
		expect(publishesBuiltLinkDirectory({ publishConfig: { directory: "", linkDirectory: true } })).toBe(false);
	});

	it("rejects a truthy non-true linkDirectory", () => {
		expect(publishesBuiltLinkDirectory({ publishConfig: { directory: "d", linkDirectory: "yes" } })).toBe(false);
	});

	it("reads any non-object manifest as false", () => {
		for (const manifest of [null, undefined, "x", 3, []]) {
			expect(publishesBuiltLinkDirectory(manifest)).toBe(false);
		}
	});
});

describe("LIFECYCLE_SCRIPTS_CONFIG_KEY", () => {
	it("is the key the generated block actually reads", () => {
		// The constant and the shell must not drift: consumers set this key, and
		// a rename on one side alone would silently stop authorizing anything.
		expect(LIFECYCLE_SCRIPTS_CONFIG_KEY).toBe("savvy.installLifecycleScripts");
		for (const hook of ["post-checkout", "post-merge"] as const) {
			expect(savvyInstallDeps(hook)).toContain(`--get ${LIFECYCLE_SCRIPTS_CONFIG_KEY}`);
		}
	});
});
