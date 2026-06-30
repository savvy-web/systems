import { build } from "tsdown";
import escapeConfig from "./tsdown.config.ts";

await build({ ...escapeConfig, config: false, logLevel: "silent" });
