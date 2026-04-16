import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { PackageJsonOptions, createPackageJson } from "../src/lib/package-json/index.js";

describe("package-json template", () => {
	it("creates minimal package.json with required fields", () => {
		const result = createPackageJson({ name: "my-package" });
		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("package-json");
		expect(result[0].filename).toBe("package.json");

		const parsed = JSON.parse(result[0].content);
		expect(parsed.name).toBe("my-package");
		expect(parsed.version).toBe("0.0.0");
	});

	it("includes all provided fields", () => {
		const result = createPackageJson({
			name: "@savvy-web/silk-effects",
			version: "0.2.2",
			private: true,
			description: "Shared Effect library for Silk Suite conventions",
			homepage: "https://github.com/savvy-web/systems/tree/main/packages/silk-effects",
			bugs: { url: "https://github.com/savvy-web/systems/issues" },
			repository: {
				type: "git",
				url: "git+https://github.com/savvy-web/systems.git",
				directory: "packages/silk-effects",
			},
			license: "MIT",
			author: {
				name: "C. Spencer Beggs",
				email: "spencer@savvyweb.systems",
				url: "https://savvyweb.systems",
			},
			sideEffects: false,
			type: "module",
			exports: { ".": "./src/index.ts" },
			scripts: {
				build: "turbo run build:dev build:prod --log-order=grouped",
			},
			dependencies: { "@effect/platform": "catalog:silk" },
			devDependencies: { "@savvy-web/rslib-builder": "^0.19.1" },
			peerDependencies: { effect: "catalog:silkPeers" },
			publishConfig: {
				access: "public",
				directory: "dist/dev",
				linkDirectory: true,
				targets: [
					{
						protocol: "npm",
						registry: "https://npm.pkg.github.com/",
						directory: "dist/npm",
						access: "public",
						provenance: true,
					},
				],
			},
		});

		const parsed = JSON.parse(result[0].content);
		expect(parsed.name).toBe("@savvy-web/silk-effects");
		expect(parsed.version).toBe("0.2.2");
		expect(parsed.private).toBe(true);
		expect(parsed.sideEffects).toBe(false);
		expect(parsed.author.name).toBe("C. Spencer Beggs");
		expect(parsed.publishConfig.targets).toHaveLength(1);
	});

	it("omits undefined optional fields", () => {
		const result = createPackageJson({ name: "bare" });
		const parsed = JSON.parse(result[0].content);
		expect(parsed.description).toBeUndefined();
		expect(parsed.scripts).toBeUndefined();
		expect(parsed.dependencies).toBeUndefined();
		expect(parsed.homepage).toBeUndefined();
	});

	it("sorts fields via sort-package-json", () => {
		const result = createPackageJson({
			name: "sorted",
			version: "1.0.0",
			description: "test",
			license: "MIT",
		});
		const content = result[0].content;
		const nameIdx = content.indexOf('"name"');
		const versionIdx = content.indexOf('"version"');
		const descIdx = content.indexOf('"description"');
		const licenseIdx = content.indexOf('"license"');
		expect(nameIdx).toBeLessThan(versionIdx);
		expect(versionIdx).toBeLessThan(descIdx);
		expect(descIdx).toBeLessThan(licenseIdx);
	});

	it("rejects invalid options via Schema", () => {
		// biome-ignore lint/suspicious/noExplicitAny: intentionally passing invalid input to test schema validation
		expect(() => createPackageJson({} as any)).toThrow();
	});

	it("validates type field", () => {
		// biome-ignore lint/suspicious/noExplicitAny: intentionally passing invalid input to test schema validation
		expect(() => createPackageJson({ name: "test", type: "invalid" as any })).toThrow();
	});

	it("Schema decodes valid input", () => {
		const decoded = Schema.decodeUnknownSync(PackageJsonOptions)({ name: "test" });
		expect(decoded.name).toBe("test");
		expect(decoded.version).toBe("0.0.0");
	});
});
