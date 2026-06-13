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

	it("forwards dtsBundledPackages to bundledPackages and apiModel to meta", () => {
		const config = definePlugin({
			runtime: true,
			dtsBundledPackages: ["@rspress/core"],
			apiModel: { tsdoc: { suppressWarnings: [{ messageId: "ae-forgotten-export", pattern: "_x" }] } },
		});
		expect(config.bundledPackages).toEqual(["@rspress/core"]);
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
});
