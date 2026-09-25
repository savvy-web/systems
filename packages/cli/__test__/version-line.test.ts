import { Option } from "effect";
import { describe, expect, it } from "vitest";

import { VersionLine } from "../src/internal/version-line.js";

describe("VersionLine.format", () => {
	it("renders a direct install as the bare name and version", () => {
		expect(VersionLine.format("savvy", "1.2.3", Option.none())).toBe("savvy v1.2.3");
	});

	it("appends the carrier the bin was installed through", () => {
		expect(VersionLine.format("savvy", "1.2.3", Option.some({ name: "@savvy-web/silk", version: "4.5.6" }))).toBe(
			"savvy v1.2.3 via @savvy-web/silk 4.5.6",
		);
	});
});
