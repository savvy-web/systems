import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { ApiModel } from "@microsoft/api-extractor-model";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadApiModel } from "../src/model-loader.js";

describe("loadApiModel", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("throws a clear error when the model file is missing", async () => {
		await expect(loadApiModel("/no/such/model.api.json")).rejects.toThrow(/not found/);
	});

	it("resolves the path, passes the existsSync guard, and delegates to ApiModel.loadPackage", async () => {
		const tmpPath = join(tmpdir(), "model-loader-happy.api.json");
		writeFileSync(tmpPath, "{}");
		try {
			const sentinel = { name: "sentinel-package" };
			const spy = vi.spyOn(ApiModel.prototype, "loadPackage").mockReturnValue(sentinel as never);

			await expect(loadApiModel(tmpPath)).resolves.toBe(sentinel);
			expect(spy).toHaveBeenCalledWith(resolve(tmpPath));
		} finally {
			rmSync(tmpPath, { force: true });
		}
	});
});
