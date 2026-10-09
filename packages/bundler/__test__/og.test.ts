import { ImageFacts } from "@effected/images";
import { Result } from "effect";
import { describe, expect, it, vi } from "vitest";

const info = { name: "Kitchen Sink", packageName: "@modules/kitchensink", version: "1.0.0", tagline: "Every shape" };

describe("ogImage.satori", () => {
	it("renders a 1200×630 PNG with the bundled Inter font", async () => {
		const { ogImage } = await import("../src/og.js");
		const bytes = await ogImage.satori()(info);
		expect(bytes).toBeInstanceOf(Uint8Array);
		expect(Result.getOrThrow(ImageFacts.fromBytesResult(bytes))).toMatchObject({
			format: "png",
			width: 1200,
			height: 630,
		});
	});

	it("carries a cache salt naming its version, both peers' versions and its colors", async () => {
		const { ogImage } = await import("../src/og.js");
		const salt = JSON.parse(ogImage.satori().cacheSalt ?? "{}");
		expect(salt).toMatchObject({
			renderer: "@savvy-web/bundler/og#satori",
			satori: expect.stringMatching(/^\d+\.\d+\.\d+/),
			resvg: expect.stringMatching(/^\d+\.\d+\.\d+/),
		});
		expect(ogImage.satori().cacheSalt).toBe(ogImage.satori().cacheSalt);
		expect(ogImage.satori({ accent: "#ff0000" }).cacheSalt).not.toBe(ogImage.satori().cacheSalt);
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
