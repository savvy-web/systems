import { join } from "node:path";
import { findWorkspaceRootSync, getWorkspacePackagesSync } from "@effected/workspaces";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Biome } from "../../../src/lint/handlers/Biome.js";
import { isWorkspacePackagePath, resetWorkspaceCache } from "../../../src/lint/utils/Workspace.js";

vi.mock("@effected/workspaces", () => ({
	findWorkspaceRootSync: vi.fn(),
	getWorkspacePackagesSync: vi.fn(),
}));

const mockFindRoot = vi.mocked(findWorkspaceRootSync);
const mockGetPackages = vi.mocked(getWorkspacePackagesSync);

const FIXTURES = join(import.meta.dirname, "fixtures");

beforeEach(() => {
	resetWorkspaceCache();
});

afterEach(() => {
	resetWorkspaceCache();
	vi.clearAllMocks();
});

describe("Workspace discovery integration", () => {
	describe("Biome.findAllConfigs", () => {
		it("should find configs at root and leaf workspaces in multi-config fixture", () => {
			const fixtureRoot = join(FIXTURES, "multi-config");
			mockFindRoot.mockReturnValue(fixtureRoot);
			mockGetPackages.mockReturnValue([
				{ name: "@test/ui", path: join(fixtureRoot, "packages/ui") },
			] as unknown as ReturnType<typeof getWorkspacePackagesSync>);

			const configs = Biome.findAllConfigs();
			expect(configs).toHaveLength(2);
			expect(configs[0]).toBe(join(fixtureRoot, "biome.jsonc"));
			expect(configs[1]).toBe(join(fixtureRoot, "packages/ui/biome.json"));
		});

		it("should find no configs in monorepo without biome files", () => {
			const fixtureRoot = join(FIXTURES, "monorepo-basic");
			mockFindRoot.mockReturnValue(fixtureRoot);
			mockGetPackages.mockReturnValue([
				{ name: "@test/app-a", path: join(fixtureRoot, "packages/app-a") },
				{ name: "@test/lib-b", path: join(fixtureRoot, "packages/lib-b") },
			] as unknown as ReturnType<typeof getWorkspacePackagesSync>);

			const configs = Biome.findAllConfigs();
			expect(configs).toHaveLength(0);
		});
	});

	describe("PackageJson filtering", () => {
		it("should accept workspace root and leaf roots, reject nested", () => {
			const fixtureRoot = join(FIXTURES, "monorepo-basic");
			mockFindRoot.mockReturnValue(fixtureRoot);
			mockGetPackages.mockReturnValue([
				{ name: "@test/app-a", path: join(fixtureRoot, "packages/app-a") },
				{ name: "@test/lib-b", path: join(fixtureRoot, "packages/lib-b") },
			] as unknown as ReturnType<typeof getWorkspacePackagesSync>);

			expect(isWorkspacePackagePath(join(fixtureRoot, "package.json"))).toBe(true);
			expect(isWorkspacePackagePath(join(fixtureRoot, "packages/app-a/package.json"))).toBe(true);
			expect(isWorkspacePackagePath(join(fixtureRoot, "packages/lib-b/package.json"))).toBe(true);
			expect(isWorkspacePackagePath(join(fixtureRoot, "packages/lib-b/dist/package.json"))).toBe(false);
		});
	});
});
