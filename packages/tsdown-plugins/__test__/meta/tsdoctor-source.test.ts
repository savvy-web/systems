import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative as relativePath } from "node:path";
import { describe, expect, it } from "vitest";
import { TsdoctorSourceError, loadTsdoctorSources } from "../../src/meta/tsdoctor-source.js";

// Real tmpdirs: WorkspaceDiscovery walks the disk through the Node platform layer, so a memfs
// volume would not be seen. realpath so the root comparison inside the loader is exact on macOS.
function root(): string {
	return realpathSync(mkdtempSync(join(tmpdir(), "tsdoctor-src-")));
}

function workspace(): { root: string; pkg: string } {
	const r = root();
	// WorkspaceDiscovery rejects a root manifest without a version (missingVersion), so declare one.
	writeFileSync(join(r, "package.json"), JSON.stringify({ name: "root", version: "0.0.0", private: true }));
	writeFileSync(join(r, "pnpm-workspace.yaml"), 'packages:\n  - "packages/*"\n');
	const pkg = join(r, "packages", "pkg");
	mkdirSync(pkg, { recursive: true });
	writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@scope/pkg", version: "1.0.0" }));
	return { root: r, pkg };
}

describe("loadTsdoctorSources", () => {
	it("returns both tiers undefined when no file exists", async () => {
		const cwd = root();
		writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "lonely" }));
		expect(await loadTsdoctorSources(cwd)).toEqual({ leaf: undefined, project: undefined });
	});

	it("reads the leaf tier alone outside any workspace", async () => {
		const cwd = root();
		writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "lonely" }));
		writeFileSync(join(cwd, "tsdoctor.json"), JSON.stringify({ name: "Lonely", tagline: "alone" }));
		expect(await loadTsdoctorSources(cwd)).toEqual({ leaf: { name: "Lonely", tagline: "alone" }, project: undefined });
	});

	it("reads the project tier from the workspace root", async () => {
		const { root: r, pkg } = workspace();
		writeFileSync(join(pkg, "tsdoctor.json"), JSON.stringify({ name: "Leaf" }));
		writeFileSync(join(r, "tsdoctor.json"), JSON.stringify({ name: "Project", tagline: "root tag" }));
		expect(await loadTsdoctorSources(pkg)).toEqual({
			leaf: { name: "Leaf" },
			project: { name: "Project", tagline: "root tag" },
		});
	});

	it("ignores stray spec and project keys in a source file", async () => {
		const cwd = root();
		writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "lonely" }));
		writeFileSync(join(cwd, "tsdoctor.json"), JSON.stringify({ spec: 1, project: { name: "X" }, name: "Y" }));
		expect((await loadTsdoctorSources(cwd)).leaf).toEqual({ name: "Y" });
	});

	it("throws TsdoctorSourceError for a present but invalid leaf", async () => {
		const cwd = root();
		writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "lonely" }));
		writeFileSync(join(cwd, "tsdoctor.json"), "{ not json");
		const err = await loadTsdoctorSources(cwd).catch((e: unknown) => e);
		expect(err).toBeInstanceOf(TsdoctorSourceError);
		expect((err as TsdoctorSourceError).path.endsWith("tsdoctor.json")).toBe(true);
	});

	it("throws TsdoctorSourceError for a leaf that parses but fails the schema", async () => {
		const cwd = root();
		writeFileSync(join(cwd, "package.json"), JSON.stringify({ name: "lonely" }));
		writeFileSync(join(cwd, "tsdoctor.json"), JSON.stringify({ openGraph: { images: [{}] } }));
		await expect(loadTsdoctorSources(cwd)).rejects.toBeInstanceOf(TsdoctorSourceError);
	});

	it("does not double-count the root file when cwd is a relative or symlinked spelling of the root", async () => {
		const { root: r } = workspace();
		writeFileSync(
			join(r, "tsdoctor.json"),
			JSON.stringify({ name: "Root", openGraph: { images: [{ url: "https://x/og.png" }] } }),
		);
		const link = join(root(), "link");
		symlinkSync(r, link);
		const relative = relativePath(process.cwd(), r);
		for (const cwd of [link, relative, `${r}/.`]) {
			expect(await loadTsdoctorSources(cwd), cwd).toEqual({
				leaf: { name: "Root", openGraph: { images: [{ url: "https://x/og.png" }] } },
				project: undefined,
			});
		}
	});

	it("reads a file at a package that IS the workspace root once, as the leaf", async () => {
		const { root: r } = workspace();
		writeFileSync(join(r, "tsdoctor.json"), JSON.stringify({ name: "Root" }));
		expect(await loadTsdoctorSources(r)).toEqual({ leaf: { name: "Root" }, project: undefined });
	});
});
