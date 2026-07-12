// A runtime VALUE imported from a real installed node_modules package
// (tinyrainbow, a devDependency of the @e2e/bundler harness) that is NOT
// declared as an external. With bundleNodeModules, the JS pass must inline
// this package's code into the output instead of leaving a bare
// `import ... from "tinyrainbow"` at module top-level.
import { createColors } from "tinyrainbow";

const colors = createColors({ force: true });

export const label = (s: string): string => colors.bold(s);
