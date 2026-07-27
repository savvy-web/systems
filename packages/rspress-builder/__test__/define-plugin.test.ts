import { describe, expect, it } from "vitest";
import { definePlugin } from "../src/index.js";

describe("definePlugin", () => {
	it("presets the plugin external and the import.meta.env identity define", () => {
		const config = definePlugin({ runtime: true });
		expect(config.externals).toContain("@rspress/core");
		expect(config.define?.["import.meta.env"]).toBe("import.meta.env");
	});

	it("builds the runtime as an isolated browser/css EntryOverride pinned to ./runtime", () => {
		const config = definePlugin({ runtime: true });
		const ov = config.overrides?.find((o) => o.entries.includes("./runtime"));
		expect(ov).toBeDefined();
		expect(ov?.outSubdir).toBe("runtime");
		expect(ov?.platform).toBe("browser");
		expect(ov?.css).toEqual({ modules: { localsConvention: "camelCaseOnly", namedExport: false }, inject: true });
		expect(ov?.externals).toEqual(
			expect.arrayContaining(["react", "react/jsx-runtime", "react/jsx-dev-runtime", "@theme", "@rspress/core"]),
		);
	});

	it("omits the runtime override when runtime is false", () => {
		const config = definePlugin({ runtime: false });
		expect(config.overrides ?? []).toHaveLength(0);
	});

	it("forwards the bundler's dependency-posture options under their own names", () => {
		const config = definePlugin({
			runtime: true,
			bundledPackages: ["@rspress/core"],
			dtsExternals: ["effect"],
			bundleNodeModules: true,
			meta: { tsdoc: { suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_x" }] } },
		});
		expect(config.bundledPackages).toEqual(["@rspress/core"]);
		expect(config.dtsExternals).toEqual(["effect"]);
		expect(config.bundleNodeModules).toBe(true);
		expect(config.meta).toEqual({
			tsdoc: { suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_x" }] },
		});
	});

	it("threads extra runtime externals and a build-wide user define", () => {
		const config = definePlugin({
			runtime: { externals: ["clsx"] },
			define: { "process.env.FOO": '"bar"' },
		});
		const ov = config.overrides?.find((o) => o.entries.includes("./runtime"));
		expect(ov?.externals).toContain("clsx");
		expect(config.define?.["process.env.FOO"]).toBe('"bar"');
		expect(config.define?.["import.meta.env"]).toBe("import.meta.env");
	});

	it("enables the runtime override by default (no args)", () => {
		const config = definePlugin();
		const ov = config.overrides?.find((o) => o.entries.includes("./runtime"));
		expect(ov?.outSubdir).toBe("runtime");
		expect(config.define?.["import.meta.env"]).toBe("import.meta.env");
	});

	it("appends plugin-bundle externals to the built-in plugin externals", () => {
		const config = definePlugin({ plugin: { externals: ["my-dep"] } });
		expect(config.externals).toEqual(expect.arrayContaining(["@rspress/core", "my-dep"]));
	});

	it("merges top-level externals into BOTH the plugin and runtime bundles", () => {
		const config = definePlugin({ externals: ["shared-dep"] });
		const ov = config.overrides?.find((o) => o.entries.includes("./runtime"));
		expect(config.externals).toEqual(expect.arrayContaining(["@rspress/core", "shared-dep"]));
		expect(ov?.externals).toEqual(expect.arrayContaining(["react", "@theme", "shared-dep"]));
	});

	it("deduplicates externals across the built-ins, top level and per-bundle tuning", () => {
		const config = definePlugin({
			externals: ["@rspress/core", "dup"],
			plugin: { externals: ["dup"] },
		});
		expect(config.externals.filter((e) => e === "dup")).toHaveLength(1);
		expect(config.externals.filter((e) => e === "@rspress/core")).toHaveLength(1);
	});

	it("lets plugin-bundle tuning override the top-level posture on the base build", () => {
		const config = definePlugin({
			bundledPackages: ["top-level"],
			plugin: { bundledPackages: ["per-bundle"] },
		});
		expect(config.bundledPackages).toEqual(["per-bundle"]);
	});

	it("threads the build-wide posture onto the runtime override, with per-bundle tuning winning", () => {
		const withTuning = definePlugin({ runtime: { dtsExternals: ["react"] }, dtsExternals: ["effect"] });
		const tunedOv = withTuning.overrides?.find((o) => o.entries.includes("./runtime"));
		// Per-bundle tuning wins over the build-wide value.
		expect(tunedOv?.dtsExternals).toEqual(["react"]);

		const withoutTuning = definePlugin({ runtime: true, dtsExternals: ["effect"] });
		const plainOv = withoutTuning.overrides?.find((o) => o.entries.includes("./runtime"));
		// The bundler builds each override partition from its own values only — it does not fall
		// back to the base build's value — so the build-wide value must reach the override
		// explicitly when the runtime itself sets no tuning.
		expect(plainOv?.dtsExternals).toEqual(["effect"]);
	});
});
