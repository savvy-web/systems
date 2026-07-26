# @savvy-web/github-action-builder

`@savvy-web/github-action-builder` is a zero-config rsbuild build tool for Node.js 24 GitHub Actions. Built via `@savvy-web/bundler`.

## Key surface

- Zero-config rsbuild pipeline targeting Node.js 24 GitHub Actions.
- Assets live under top-level `public/` (no copyPatterns — the `public/` convention only).
- The rsbuild `mode` is pinned to `"production"`. Via the JS API rsbuild resolves mode from `NODE_ENV`, so a bare local build silently emitted an unminified bundle; this tool only produces committed production artifacts. Never make the pin conditional.
- `output.legalComments: "linked"` is the only mode whose extraction sees bundled license banners, and the emitted `.LICENSE.txt` sidecar is folded back into the bundle by `inlineLicenseSidecar` — keeping the single-file no-sidecar contract (#94). `"inline"` silently drops attribution; do not "simplify" back to it.
- `build.nativeDynamicImports` keeps listed packages' fully dynamic `import()` calls native at runtime (rspack would otherwise compile them into a throwing context module) via the on-disk `webpack-ignore-dynamic-imports.cjs` loader under `public/loaders/`, exported at `./loaders/webpack-ignore-dynamic-imports.cjs`.

## Design

Load for the build pipeline and configuration model:
→ `@../../.claude/design/github-action-builder/architecture.md`
Load when changing the build pipeline or action output configuration.
