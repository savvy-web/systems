import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspacePackage } from "workspaces-effect";
import {
	getWorkspacePackagePaths,
	getWorkspacePackages,
	getWorkspaceRoot,
	isWorkspacePackagePath,
	resetWorkspaceCache,
} from "../../src/lint/utils/Workspace.js";

vi.mock("workspaces-effect", () => ({
	findWorkspaceRootSync: vi.fn(),
	getWorkspacePackagesSync: vi.fn(),
}));

import { findWorkspaceRootSync, getWorkspacePackagesSync } from "workspaces-effect";

const mockFindWorkspaceRootSync = vi.mocked(findWorkspaceRootSync);
const mockGetWorkspacePackagesSync = vi.mocked(getWorkspacePackagesSync);

const MOCK_ROOT = "/workspace";
const MOCK_PACKAGES = [
	{ name: "root-package", path: "/workspace" },
	{ name: "@org/pkg-a", path: "/workspace/packages/pkg-a" },
	{ name: "@org/pkg-b", path: "/workspace/packages/pkg-b" },
] as unknown as readonly WorkspacePackage[];

afterEach(() => {
	resetWorkspaceCache();
	vi.clearAllMocks();
});

describe("getWorkspaceRoot()", () => {
	it("returns the workspace root path", () => {
		mockFindWorkspaceRootSync.mockReturnValue(MOCK_ROOT);

		const result = getWorkspaceRoot();

		expect(result).toBe(MOCK_ROOT);
	});

	it("returns null when not in a workspace", () => {
		mockFindWorkspaceRootSync.mockReturnValue(null);

		const result = getWorkspaceRoot();

		expect(result).toBeNull();
	});

	it("caches the result on subsequent calls", () => {
		mockFindWorkspaceRootSync.mockReturnValue(MOCK_ROOT);

		getWorkspaceRoot();
		getWorkspaceRoot();
		getWorkspaceRoot();

		expect(mockFindWorkspaceRootSync).toHaveBeenCalledTimes(1);
	});

	it("caches null result on subsequent calls", () => {
		mockFindWorkspaceRootSync.mockReturnValue(null);

		getWorkspaceRoot();
		getWorkspaceRoot();

		expect(mockFindWorkspaceRootSync).toHaveBeenCalledTimes(1);
	});
});

describe("getWorkspacePackages()", () => {
	beforeEach(() => {
		mockFindWorkspaceRootSync.mockReturnValue(MOCK_ROOT);
		mockGetWorkspacePackagesSync.mockReturnValue(MOCK_PACKAGES);
	});

	it("returns leaf packages excluding the root package", () => {
		const result = getWorkspacePackages();

		expect(result).not.toBeNull();
		expect(result).toHaveLength(2);
		expect(result?.map((p) => p.name)).toEqual(["@org/pkg-a", "@org/pkg-b"]);
	});

	it("does not include the package whose path equals the root", () => {
		const result = getWorkspacePackages();

		const rootPkg = result?.find((p) => p.path === MOCK_ROOT);
		expect(rootPkg).toBeUndefined();
	});

	it("returns null when not in a workspace", () => {
		mockFindWorkspaceRootSync.mockReturnValue(null);
		resetWorkspaceCache();

		const result = getWorkspacePackages();

		expect(result).toBeNull();
	});

	it("caches result on subsequent calls", () => {
		getWorkspacePackages();
		getWorkspacePackages();
		getWorkspacePackages();

		expect(mockGetWorkspacePackagesSync).toHaveBeenCalledTimes(1);
	});

	it("handles empty package list gracefully", () => {
		mockGetWorkspacePackagesSync.mockReturnValue([]);
		resetWorkspaceCache();

		const result = getWorkspacePackages();

		expect(result).toEqual([]);
	});
});

describe("getWorkspacePackagePaths()", () => {
	beforeEach(() => {
		mockFindWorkspaceRootSync.mockReturnValue(MOCK_ROOT);
		mockGetWorkspacePackagesSync.mockReturnValue(MOCK_PACKAGES);
	});

	it("returns absolute paths of leaf workspace packages", () => {
		const result = getWorkspacePackagePaths();

		expect(result).toEqual(["/workspace/packages/pkg-a", "/workspace/packages/pkg-b"]);
	});

	it("returns an empty array when not in a workspace", () => {
		mockFindWorkspaceRootSync.mockReturnValue(null);
		resetWorkspaceCache();

		const result = getWorkspacePackagePaths();

		expect(result).toEqual([]);
	});

	it("caches the result on subsequent calls", () => {
		getWorkspacePackagePaths();
		getWorkspacePackagePaths();

		expect(mockGetWorkspacePackagesSync).toHaveBeenCalledTimes(1);
	});
});

describe("isWorkspacePackagePath()", () => {
	beforeEach(() => {
		mockFindWorkspaceRootSync.mockReturnValue(MOCK_ROOT);
		mockGetWorkspacePackagesSync.mockReturnValue(MOCK_PACKAGES);
	});

	it("returns true for a file at the workspace root", () => {
		const result = isWorkspacePackagePath("/workspace/package.json");

		expect(result).toBe(true);
	});

	it("returns true for a file at a leaf package root", () => {
		const result = isWorkspacePackagePath("/workspace/packages/pkg-a/package.json");

		expect(result).toBe(true);
	});

	it("returns false for a file in a nested subdirectory of a package", () => {
		const result = isWorkspacePackagePath("/workspace/packages/pkg-a/src/index.ts");

		expect(result).toBe(false);
	});

	it("returns false for a file outside the workspace entirely", () => {
		const result = isWorkspacePackagePath("/other/project/package.json");

		expect(result).toBe(false);
	});

	it("returns true (permissive fallback) when not in a workspace", () => {
		mockFindWorkspaceRootSync.mockReturnValue(null);
		resetWorkspaceCache();

		const result = isWorkspacePackagePath("/any/path/package.json");

		expect(result).toBe(true);
	});
});

describe("resetWorkspaceCache()", () => {
	it("clears cached root so findWorkspaceRootSync is called again", () => {
		mockFindWorkspaceRootSync.mockReturnValue(MOCK_ROOT);

		getWorkspaceRoot();
		expect(mockFindWorkspaceRootSync).toHaveBeenCalledTimes(1);

		resetWorkspaceCache();

		getWorkspaceRoot();
		expect(mockFindWorkspaceRootSync).toHaveBeenCalledTimes(2);
	});

	it("clears cached packages so getWorkspacePackagesSync is called again", () => {
		mockFindWorkspaceRootSync.mockReturnValue(MOCK_ROOT);
		mockGetWorkspacePackagesSync.mockReturnValue(MOCK_PACKAGES);

		getWorkspacePackages();
		expect(mockGetWorkspacePackagesSync).toHaveBeenCalledTimes(1);

		resetWorkspaceCache();

		getWorkspacePackages();
		expect(mockGetWorkspacePackagesSync).toHaveBeenCalledTimes(2);
	});

	it("clears cached paths so they are recomputed from fresh package data", () => {
		mockFindWorkspaceRootSync.mockReturnValue(MOCK_ROOT);
		mockGetWorkspacePackagesSync.mockReturnValue(MOCK_PACKAGES);

		const first = getWorkspacePackagePaths();
		expect(first).toHaveLength(2);

		resetWorkspaceCache();

		const updatedPackages = [
			{ name: "root-package", path: "/workspace" },
			{ name: "@org/pkg-c", path: "/workspace/packages/pkg-c" },
		] as unknown as readonly WorkspacePackage[];
		mockGetWorkspacePackagesSync.mockReturnValue(updatedPackages);

		const second = getWorkspacePackagePaths();
		expect(second).toEqual(["/workspace/packages/pkg-c"]);
	});
});
