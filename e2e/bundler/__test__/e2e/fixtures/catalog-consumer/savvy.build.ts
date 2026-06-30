import { build } from "@savvy-web/bundler";

await build({ formats: ["esm"], externals: ["effect"], meta: false });
