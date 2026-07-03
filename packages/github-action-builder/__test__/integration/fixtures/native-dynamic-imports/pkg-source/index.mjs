// Mirrors @changesets/apply-release-plan's changelog-module resolution: the
// module path is a runtime variable, not a string literal, so rspack would
// otherwise compile this into a context module that throws "Cannot find
// module" at runtime even though the file exists on disk.
export async function loadTarget(path) {
	return import(path);
}
