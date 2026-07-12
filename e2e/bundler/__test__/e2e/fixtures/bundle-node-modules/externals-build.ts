// Variant build: bundleNodeModules with tinyrainbow explicitly externalized,
// proving the flag bundles only NON-externalized node_modules deps.
import { build } from "@savvy-web/bundler";

await build({ devManifest: "preserve", bundleNodeModules: true, externals: ["tinyrainbow"], meta: false });
