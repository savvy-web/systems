// Ambient declaration so the fixture type-checks. "fake-dynamic-pkg" is not a
// real dependency — the integration test materializes it under node_modules/
// at test time from ../pkg-source (node_modules is gitignored, so it cannot
// be a committed fixture directory; see native-dynamic-imports.int.test.ts).
declare module "fake-dynamic-pkg" {
	export function loadTarget(path: string): Promise<unknown>;
}
