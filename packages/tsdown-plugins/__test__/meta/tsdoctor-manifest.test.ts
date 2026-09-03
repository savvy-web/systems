import { describe, expect, it } from "vitest";
import {
	composeTsdoctorManifest,
	githubOwnerRepo,
	ogImageInfoOf,
	registriesFromTargets,
} from "../../src/meta/tsdoctor-manifest.js";

const base = {
	config: undefined,
	leaf: undefined,
	project: undefined,
	packageName: "@scope/pkg",
	isPrivate: false,
	targets: [{ name: "npm", registry: "https://registry.npmjs.org" }],
	generatedImage: undefined,
};

describe("composeTsdoctorManifest", () => {
	it("returns undefined when nothing is configured and the package is private", () => {
		expect(composeTsdoctorManifest({ ...base, isPrivate: true, targets: [] })).toBeUndefined();
	});

	it("derives registries from targets for a public package", () => {
		expect(composeTsdoctorManifest(base)).toEqual({
			spec: 1,
			registries: [{ type: "npm", name: "npm", url: "https://www.npmjs.com/package/@scope/pkg" }],
		});
	});

	it("skips derived registries for a private package and when registries is false", () => {
		expect(composeTsdoctorManifest({ ...base, isPrivate: true })).toBeUndefined();
		expect(composeTsdoctorManifest({ ...base, config: { registries: false, name: "X" } })).toEqual({
			spec: 1,
			name: "X",
		});
	});

	it("lets an explicit registries list (config over leaf) replace the derived one", () => {
		const explicit = [{ type: "jsr", name: "jsr", url: "https://jsr.io/@scope/pkg" }];
		expect(composeTsdoctorManifest({ ...base, leaf: { registries: explicit } })?.registries).toEqual(explicit);
		expect(
			composeTsdoctorManifest({ ...base, config: { registries: explicit }, leaf: { registries: [] } })?.registries,
		).toEqual(explicit);
	});

	it("lets config beat leaf beat project per field and keeps project nested", () => {
		const manifest = composeTsdoctorManifest({
			...base,
			config: { name: "Config" },
			leaf: { name: "Leaf", tagline: "leaf tag" },
			project: { name: "Project", tagline: "project tag", description: "project desc" },
		});
		expect(manifest?.name).toBe("Config");
		expect(manifest?.tagline).toBe("leaf tag");
		expect(manifest?.description).toBeUndefined();
		expect(manifest?.project).toEqual({ name: "Project", tagline: "project tag" });
	});

	it("puts the generated image first, then config, leaf, project images", () => {
		const manifest = composeTsdoctorManifest({
			...base,
			generatedImage: { path: "og/pkg.png", type: "image/png", width: 1200, height: 630 },
			config: { openGraph: { images: [{ url: "https://c/og.png" }] } },
			leaf: { openGraph: { images: [{ url: "https://l/og.png" }], themeColor: "#111" } },
			project: { openGraph: { images: [{ url: "https://p/og.png" }], themeColor: "#222" } },
		});
		expect(manifest?.openGraph?.images?.map((i) => i.path ?? i.url)).toEqual([
			"og/pkg.png",
			"https://c/og.png",
			"https://l/og.png",
			"https://p/og.png",
		]);
		expect(manifest?.openGraph?.themeColor).toBe("#111");
	});

	it("omits openGraph entirely when no tier declares an image or theme color", () => {
		expect(composeTsdoctorManifest({ ...base, config: { name: "X" } })).not.toHaveProperty("openGraph");
	});

	it("never writes an sbom pointer", () => {
		const manifest = composeTsdoctorManifest({ ...base, leaf: { sbom: { path: "x.json" } } });
		expect(manifest?.sbom).toBeUndefined();
	});
});

describe("registriesFromTargets", () => {
	const github = [{ name: "github", registry: "https://npm.pkg.github.com/" }];

	it("links a GitHub Packages target to the repository's package page", () => {
		expect(
			registriesFromTargets({
				packageName: "@scope/pkg",
				isPrivate: false,
				targets: github,
				repository: { url: "git+https://github.com/owner/repo.git", directory: "packages/pkg" },
			}),
		).toEqual([{ type: "npm", name: "github", url: "https://github.com/owner/repo/pkgs/npm/pkg" }]);
	});

	it("omits a GitHub Packages target when the repository is missing or unparseable", () => {
		expect(registriesFromTargets({ packageName: "@scope/pkg", isPrivate: false, targets: github })).toEqual([]);
		expect(
			registriesFromTargets({
				packageName: "@scope/pkg",
				isPrivate: false,
				targets: github,
				repository: { url: "https://gitlab.com/owner/repo" },
			}),
		).toEqual([]);
	});

	it("strips any run of trailing slashes from the registry endpoint", () => {
		expect(
			registriesFromTargets({
				packageName: "@scope/pkg",
				isPrivate: false,
				targets: [{ name: "npm", registry: `https://registry.npmjs.org${"/".repeat(5000)}` }],
			}),
		).toEqual([{ type: "npm", name: "npm", url: "https://www.npmjs.com/package/@scope/pkg" }]);
	});

	it("links any other non-npmjs registry to <host>/package/<name> and keeps type npm", () => {
		expect(
			registriesFromTargets({
				packageName: "@scope/pkg",
				isPrivate: false,
				targets: [{ name: "verdaccio", registry: "https://npm.example.com/" }],
			}),
		).toEqual([{ type: "npm", name: "verdaccio", url: "https://npm.example.com/package/@scope/pkg" }]);
	});
});

describe("githubOwnerRepo", () => {
	it.each([
		"https://github.com/owner/repo",
		"https://github.com/owner/repo.git",
		"git+https://github.com/owner/repo.git",
		"git@github.com:owner/repo.git",
		"ssh://git@github.com/owner/repo.git",
		"git://github.com/owner/repo.git",
		"github:owner/repo",
		"https://www.github.com/owner/repo/",
	])("parses %s", (url) => {
		expect(githubOwnerRepo(url)).toEqual({ owner: "owner", repo: "repo" });
	});

	it.each(["https://gitlab.com/owner/repo", "https://github.com/owner", "not a url", ""])("rejects %s", (url) => {
		expect(githubOwnerRepo(url)).toBeUndefined();
	});
});

describe("ogImageInfoOf", () => {
	it("falls back to the package name and carries the project tier", () => {
		expect(ogImageInfoOf({ ...base, version: "1.2.3", project: { name: "P" } })).toEqual({
			name: "@scope/pkg",
			packageName: "@scope/pkg",
			version: "1.2.3",
			project: { name: "P" },
		});
	});

	it("takes the tagline from the project tier when config and leaf are silent", () => {
		const info = ogImageInfoOf({
			...base,
			version: "0.0.1",
			leaf: { name: "Leaf", description: "leaf desc" },
			project: { tagline: "project tag" },
		});
		expect(info).toEqual({
			name: "Leaf",
			packageName: "@scope/pkg",
			version: "0.0.1",
			tagline: "project tag",
			description: "leaf desc",
			project: { tagline: "project tag" },
		});
	});
});
