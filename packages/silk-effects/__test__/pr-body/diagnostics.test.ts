/**
 * The advisory marker scan — the check the pr-body skill's "stop and report
 * a missing pair" instruction points at.
 */

import { describe, expect, it } from "vitest";
import { ManagedPrBody } from "../../src/pr-body/body.js";
import { PrBodyDiagnostic } from "../../src/pr-body/diagnostics.js";

describe("PrBodyDiagnostic.scan", () => {
	it("reports nothing for a well-formed generated body", () => {
		const body = ManagedPrBody.build({
			subject: "release: 1.0.0",
			linkedIssues: [{ number: 1, title: "t", state: "open" }],
			signoff: "Signed-off-by: A <a@b.c>",
			summary: "",
		});
		expect(PrBodyDiagnostic.scan(body)).toHaveLength(0);
	});

	it("reports nothing for an unmanaged body — absent markers are not a defect", () => {
		expect(PrBodyDiagnostic.scan("just an ordinary PR description")).toHaveLength(0);
	});

	it("reports an unpaired summary marker", () => {
		const diags = PrBodyDiagnostic.scan("<!-- silk-release:summary:start -->\nno close");
		expect(diags).toHaveLength(1);
		expect(diags[0]?.code).toBe("unpairedMarker");
		expect(diags[0]?.token).toBe("silk-release:summary");
	});

	it("reports an end-before-start pair as unpaired", () => {
		const diags = PrBodyDiagnostic.scan("<!-- silk-release:end -->\n<!-- silk-release:start -->");
		expect(diags).toHaveLength(1);
		expect(diags[0]?.code).toBe("unpairedMarker");
	});

	it("reports a duplicated region", () => {
		const region = "<!-- silk-release:summary:start -->\n<!-- silk-release:summary:end -->";
		const diags = PrBodyDiagnostic.scan(`${region}\n${region}`);
		expect(diags).toHaveLength(1);
		expect(diags[0]?.code).toBe("duplicateMarker");
	});

	it("counts an attributed references marker as present", () => {
		const body = '<!-- silk-release:references:start owned="1" -->\nCloses #1\n<!-- silk-release:references:end -->';
		expect(PrBodyDiagnostic.scan(body)).toHaveLength(0);
	});

	it("derives the message from the structured fields", () => {
		const unpaired = PrBodyDiagnostic.make({ code: "unpairedMarker", token: "silk-release" });
		const duplicate = PrBodyDiagnostic.make({ code: "duplicateMarker", token: "silk-release:summary" });
		expect(unpaired.message).toContain('"silk-release"');
		expect(unpaired.message).toContain("unpaired");
		expect(duplicate.message).toContain("more than once");
	});
});
