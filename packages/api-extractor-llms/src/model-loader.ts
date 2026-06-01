/**
 * Load a Microsoft API Extractor `.api.json` model from disk and return its
 * single `ApiPackage`. Ported from rspress-plugin-api-extractor's ApiModelLoader.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { ApiPackage } from "@microsoft/api-extractor-model";
import { ApiModel } from "@microsoft/api-extractor-model";

/** Load a `.api.json` model file and return its first (only) package. */
export async function loadApiModel(modelPath: string): Promise<ApiPackage> {
	const resolved = resolve(modelPath);
	if (!existsSync(resolved)) {
		throw new Error(`API model file not found: ${resolved}`);
	}
	const model = new ApiModel();
	return model.loadPackage(resolved);
}
