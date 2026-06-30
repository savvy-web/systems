import { build } from "@savvy-web/bundler";

await build({ formats: ["esm"], externals: ["typescript"], devManifest: "preserve" });
