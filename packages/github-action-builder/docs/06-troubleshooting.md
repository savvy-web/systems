# Troubleshooting

Common errors from `@savvy-web/github-action-builder`, what causes them and how to fix them.

## Validation errors

### "runs.using must be 'node24'"

**Error:**

```text
action.yml: runs.using must be "node24", found "node20"
```

**Cause:** Your `action.yml` specifies a Node.js version other than 24.

**Solution:** Update your `action.yml`:

```yaml
runs:
  using: "node24"  # Must be exactly this
  main: "dist/main.js"
```

This builder targets Node.js 24 actions only. For older Node.js versions, use a different build tool.

### "Required entry not found: src/main.ts"

**Error:**

```text
Entry point not found: src/main.ts
```

**Cause:** The required main entry point file does not exist.

**Solution:** Create `src/main.ts` with your action logic:

```typescript
// src/main.ts
import * as core from "@actions/core";

async function run(): Promise<void> {
  // Your action logic
}

run();
```

Or specify a custom path in your config:

```typescript
// action.config.ts
export default defineConfig({
  entries: {
    main: "src/action.ts",  // Custom path
  },
});
```

### "action.yml not found in project root"

**Error:**

```text
action.yml not found in project root
```

**Cause:** No `action.yml` file exists in your project directory.

**Solution:** Create `action.yml`:

```yaml
name: "My Action"
description: "What my action does"
runs:
  using: "node24"
  main: "dist/main.js"
```

Or disable the requirement if building without an action.yml:

```typescript
// action.config.ts
export default defineConfig({
  validation: {
    requireActionYml: false,
  },
});
```

### "YAML parse error"

**Error:**

```text
action.yml: YAML parse error at line 5: ...
```

**Cause:** Your `action.yml` has invalid YAML syntax.

**Solution:** Check for:

- Missing colons after keys
- Incorrect indentation (YAML uses spaces, not tabs)
- Unquoted special characters
- Missing quotes around strings with colons

Use a YAML validator or linter to find the exact issue.

### "Schema validation error"

**Error:**

```text
action.yml schema error:
  - /runs/main: Expected string, found undefined
```

**Cause:** Your `action.yml` is missing required fields or has invalid values.

**Solution:** Check the GitHub Actions
[metadata syntax](https://docs.github.com/en/actions/creating-actions/metadata-syntax-for-github-actions)
for required fields:

- `name` (required)
- `description` (required)
- `runs.using` (required, must be `node24`)
- `runs.main` (required)

## Build errors

### "Bundle failed"

**Error:**

```text
Bundle failed: Cannot find module 'some-package'
```

**Cause:** A dependency is missing or cannot be resolved.

**Solution:**

1. Install the missing package:

   ```bash
   npm install some-package
   ```

2. If the package cannot be bundled (native modules), add it to externals:

   ```typescript
   // action.config.ts
   export default defineConfig({
     build: {
       externals: ["some-package"],
     },
   });
   ```

### "Cannot find module" at runtime from a dynamic import

**Error:**

```text
Error: Cannot find module '/path/that/exists/on/disk.js'
```

The action fails at runtime with `Cannot find module` for a path that exists on disk, typically from inside a bundled dependency.

**Cause:** rspack cannot statically resolve a fully dynamic `import(expr)` — a bare variable or an interpolated template literal — so it compiles the call into a context module that throws for any path it did not see at build time. Packages that resolve a module path at runtime and then dynamically import it break when bundled this way.

**Solution:** Add the package that performs the dynamic import to `nativeDynamicImports` so its `import()` calls stay native at runtime:

```typescript
// action.config.ts
export default defineConfig({
  build: {
    nativeDynamicImports: ["@changesets/apply-release-plan"],
  },
});
```

The dynamically imported module must exist on disk when the action runs, since the bundler no longer inlines it. See [Configuration](./02-configuration.md#nativedynamicimports) for details.

### "Write error: EACCES"

**Error:**

```text
Write error: EACCES: permission denied, mkdir 'dist'
```

**Cause:** No write permission for the output directory.

**Solution:**

1. Check directory permissions:

   ```bash
   ls -la .
   ```

2. Fix permissions if needed:

   ```bash
   chmod 755 .
   ```

3. Ensure you are not running as a restricted user.

### "Bundle size exceeds limit"

**Error:**

```text
Bundle size (12.5 MB) exceeds maximum (10 MB)
```

**Cause:** Your bundle is larger than the configured `maxBundleSize`.

**Solution:**

1. Increase the limit:

   ```typescript
   // action.config.ts
   export default defineConfig({
     validation: {
       maxBundleSize: "15mb",
     },
   });
   ```

2. Or reduce bundle size:
   - Remove unused dependencies
   - Use lighter alternatives
   - Add large dependencies to `externals`

### "Clean error"

**Error:**

```text
Clean error: ENOTEMPTY: directory not empty
```

**Cause:** The `dist/` directory cannot be cleaned, possibly due to file locks.

**Solution:**

1. Close any programs that might have files open in `dist/`
2. Manually delete the `dist/` directory:

   ```bash
   rm -rf dist
   ```

3. Run the build again

## Configuration errors

### "Config not found"

**Error:**

```text
Config not found at action.config.ts
```

**Cause:** The specified config file does not exist.

**Solution:**

1. Create the config file:

   ```bash
   github-action-builder init
   ```

2. Or run without a config (uses defaults):

   ```bash
   github-action-builder build
   ```

### "Config invalid"

**Error:**

```text
Config invalid: /build/target: Expected one of "es2020" | "es2021" | ...
```

**Cause:** Your configuration has invalid values.

**Solution:** Check the [Configuration](./02-configuration.md) guide for valid options. Common issues:

- Invalid `target` value (must be `es2020`-`es2024`)
- Wrong type (e.g., string instead of boolean)
- Unknown option names

### "Config load failed"

**Error:**

```text
Config load failed: Cannot find module '@savvy-web/github-action-builder'
```

**Cause:** The config file has an import error.

**Solution:**

1. Ensure the package is installed:

   ```bash
   npm install @savvy-web/github-action-builder
   ```

2. Check for typos in import paths
3. Verify your `tsconfig.json` supports ESM imports

### "Unknown file extension .ts" in CI

**Error:**

```text
ConfigLoadFailed: Unknown file extension ".ts" for /path/to/action.config.ts
```

**Cause:** Versions prior to 0.6.0 loaded `action.config.ts` through native `import()`. That needs a TypeScript loader registered in the Node.js runtime, and CI environments usually do not have one.

**Solution:** Upgrade to `@savvy-web/github-action-builder@0.6.0` or later. Recent versions load TypeScript config files with [jiti](https://github.com/unjs/jiti), so no external loader is needed.

## CI vs local differences

### "Build fails in CI but works locally"

**Cause:** CI uses strict mode by default.

**Explanation:** In CI environments (`CI=true` or `GITHUB_ACTIONS=true`) warnings become errors and the build fails on any issue. Locally, warnings are printed but the build continues, so you can keep iterating.

**Solution:**

1. Fix the warnings shown locally before pushing to CI

2. Or override strict mode in your config:

   ```typescript
   // action.config.ts
   export default defineConfig({
     validation: {
       strict: false,  // Never fail on warnings
     },
   });
   ```

### "Different bundle sizes in CI"

**Cause:** Different Node.js or dependency versions.

**Solution:**

1. Lock your Node.js version with `.nvmrc` or similar
2. Use a lockfile (`package-lock.json`, `pnpm-lock.yaml`)
3. Run `npm ci` instead of `npm install` in CI

## Node.js 24 compatibility

### "Node.js version not supported"

**Error:**

```text
Error: This tool requires Node.js 24 or later
```

**Cause:** You are running an older Node.js version.

**Solution:**

1. Update Node.js to version 24:

   ```bash
   # Using nvm
   nvm install 24
   nvm use 24

   # Using volta
   volta install node@24
   ```

2. Verify your version:

   ```bash
   node --version  # Should be v24.x.x
   ```

### "ESM import errors"

**Error:**

```text
SyntaxError: Cannot use import statement outside a module
```

**Cause:** Your project is not configured for ESM.

**Solution:**

1. Add `"type": "module"` to your `package.json`:

   ```json
   {
     "type": "module"
   }
   ```

2. Use `.js` extensions in imports:

   ```typescript
   import { foo } from "./utils.js";  // Note: .js extension
   ```

3. Configure `tsconfig.json`:

   ```json
   {
     "compilerOptions": {
       "module": "ESNext",
       "moduleResolution": "bundler"
     }
   }
   ```

## Getting help

If your issue is not covered here:

1. Search the [GitHub Issues](https://github.com/savvy-web/systems/issues) for a similar problem
2. If you find nothing, open a new issue with:
   - Error message (full output)
   - Your `action.config.ts`
   - Your `action.yml`
   - Node.js version (`node --version`)
   - Package version (`npm list @savvy-web/github-action-builder`)

## Related documentation

- [Configuration](./02-configuration.md) - Every configuration option
- [CLI reference](./04-cli-reference.md) - Every command and flag
- [Getting started](./01-getting-started.md) - Project setup from scratch
