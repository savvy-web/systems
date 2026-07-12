import { build } from "@savvy-web/bundler";

await build({ devManifest: "preserve", bundleNodeModules: true, meta: false });
