/**
 * Coverage tests for the Repos namespace barrel exports.
 *
 * These modules are re-export entry points that are never imported
 * by other tests (which import from individual modules directly).
 * Importing them here ensures their module-level code is executed.
 */

import { describe, expect, it } from "vitest";
import * as SilkEffects from "../../src/index.js";

describe("Repos namespace (src/repos/index.ts)", () => {
	it("exports the ReposManager service", () => {
		expect(SilkEffects.Repos.ReposManager).toBeDefined();
		expect(SilkEffects.Repos.ReposManager.layer).toBeDefined();
	});

	it("exports the ReposConfigStore service", () => {
		expect(SilkEffects.Repos.ReposConfigStore).toBeDefined();
		expect(SilkEffects.Repos.ReposConfigStore.layer).toBeDefined();
	});

	it("exports manifest schemas", () => {
		expect(SilkEffects.Repos.ReposManifestFile).toBeDefined();
		expect(SilkEffects.Repos.RepoEntry).toBeDefined();
		expect(SilkEffects.Repos.RepoNote).toBeDefined();
		expect(SilkEffects.Repos.RepoOrientation).toBeDefined();
		expect(SilkEffects.Repos.RepoName).toBeDefined();
	});

	it("exports report schemas", () => {
		expect(SilkEffects.Repos.ReposStatusReport).toBeDefined();
		expect(SilkEffects.Repos.ReposSyncReport).toBeDefined();
		expect(SilkEffects.Repos.ReposPinResult).toBeDefined();
		expect(SilkEffects.Repos.ReposAddResult).toBeDefined();
		expect(SilkEffects.Repos.ReposNoteResult).toBeDefined();
		expect(SilkEffects.Repos.ReposDeregisterResult).toBeDefined();
	});

	it("exports tagged errors", () => {
		expect(SilkEffects.Repos.ReposConfigError).toBeDefined();
		expect(SilkEffects.Repos.GitSubmoduleError).toBeDefined();
		expect(SilkEffects.Repos.RepoNotFoundError).toBeDefined();
		expect(SilkEffects.Repos.NoteNotFoundError).toBeDefined();
	});

	it("exports constants", () => {
		expect(SilkEffects.Repos.REPOS_DIR).toBeDefined();
		expect(SilkEffects.Repos.MANIFEST_PATH).toBeDefined();
		expect(SilkEffects.Repos.NOTE_LIMIT).toBeDefined();
	});

	it("exports the ReposDrift service", () => {
		expect(SilkEffects.Repos.ReposDrift).toBeDefined();
		expect(SilkEffects.Repos.ReposDrift.layer).toBeDefined();
	});

	it("exports drift schemas", () => {
		expect(SilkEffects.Repos.DriftKind).toBeDefined();
		expect(SilkEffects.Repos.RepoDrift).toBeDefined();
		expect(SilkEffects.Repos.ReposDriftReport).toBeDefined();
	});
});
