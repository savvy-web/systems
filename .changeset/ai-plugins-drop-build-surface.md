---
"@savvy-web/ai-plugins": minor
---

## Breaking Changes

### Build tooling moves to the effected plugin

The silk plugin now covers workflow only: changesets, commits, pull requests, Turborepo, vendored repos and dogfooding. Packages build with `effected package build`, and the effected agent plugin owns the build tooling that silk used to ship.

* Removed the `/silk:build` and `/silk:tsdoc` skills and the `tsdoctor` agent. Build and TSDoc guidance now belongs to the effected plugin, which has been asked to ship it; until it does, no plugin carries these.
* Removed the `tsdoc-diagnostics` monitor, which watched `dist/<target>/issues.json`. Claude Code keeps the `dogfood-mail` and `gitmodules-drift` monitors.
* The session-start orientation no longer lists the removed skills, agent or monitor.
* The `turborepo` agent and `/silk:turbo` skill now describe the current workspace: nothing builds on install, and one `build` task writes `dist/prod`.
