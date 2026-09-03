import { imageSize } from "image-size";
import { describe, expect, it, vi } from "vitest";

const info = { name: "Kitchen Sink", packageName: "@modules/kitchensink", version: "1.0.0", tagline: "Every shape" };

describe("ogImage.satori", () => {
	it("renders a 1200×630 PNG with the bundled Inter font", async () => {
		const { ogImage } = await import("../src/og.js");
		const bytes = await ogImage.satori()(info);
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(imageSize(bytes)).toMatchObject({ type: "png", width: 1200, height: 630 });
	});

	it("rejects with a message naming both optional peers when satori cannot load", async () => {
		vi.resetModules();
		vi.doMock("satori", () => {
			throw new Error("Cannot find module 'satori'");
		});
		try {
			const { ogImage } = await import("../src/og.js");
			await expect(ogImage.satori()(info)).rejects.toThrow(/satori.*@resvg\/resvg-js/);
		} finally {
			vi.doUnmock("satori");
			vi.resetModules();
		}
	});
});
