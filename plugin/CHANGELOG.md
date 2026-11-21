# @savvy-web/ai-plugins

## 4.6.0

### Features

#### Guard the real environment files

- A new fail-closed `env-file-guard` hook stops agents reading or writing `.envrc`, `.env`, `.env.*` and `.dev.vars`, which can hold secrets. It covers Read, Write, Edit, MultiEdit, NotebookEdit and Grep, and Bash readers, redirects and `tee`. It also covers `direnv exec <dir> env`, `printenv`, `export` and `set`, and `direnv export` and `direnv dump`. The `.example` files read and write normally, and `direnv exec . <cmd>` still runs, so an agent can use a variable without seeing it. The deny points the agent at `.envrc.example` and at 1Password `op://` references.

### Bug Fixes

- The dogfood doorbell now sends once with `it2 session send-text --skip-confirm` instead of retrying into duplicate notices. The journal append script and the journal readers tolerate torn tails per the `@effected/jsonl` envelope model: an append first closes an unterminated fragment so the new snapshot lands on its own line, every reader treats only an envelope frame (string `at` and `event`) as a valid snapshot, and the `dogfood-mail` monitor reads each journal incrementally from a byte cursor, holding back an unterminated tail and re-reading a truncated or replaced journal from zero.

* The `repos-bash-guard` hook now judges `sed -i`, `rm`, `patch` and `dd of=` inside their own clause. A `grep -i` or a `grep` for the word `rm` or `patch` in one clause no longer turns a read of a vendored file in another clause into a denied write. The sed `-i` check also catches `-i.bak` and `--in-place=.bak`, which it missed before. Deletes whose operands come from elsewhere are still denied: `find .repos/x -exec rm` and `-delete`, `... | xargs rm`, an `rm` in a `for` or `while` loop over `.repos/` paths, and an `rm` behind a wrapper flag such as `sudo -u root` or `nice -n 5`. Closes #594 and #853.
* The hook now resolves each `.repos/` path against the call's directory and denies a write only when the path lands under the project's own `.repos/`. A `.repos/` directory in a scratch tree or another checkout is no longer guarded. The `.repos/config.json` manifest stays writable when spelled `./.repos/config.json` or by absolute path. A path built from `$VAR` or a command substitution still denies, and so does a relative path in a command that runs `cd`, `pushd` or `popd`, because the guard cannot tell which directory that path is relative to. Closes #757.

### Documentation

- The dogfood skill now explains that a `file:` override cannot install while pnpm's `pnprServer` is set, because the pnpr server reports the local target as missing. It shows how to turn pnpr off for a linked install, either in the global config or with an isolated `XDG_CONFIG_HOME`, and lists the spellings that do not work on pnpm 12.x. Closes #808

* The `repos` skill now explains that a `localRegistrationDivergence` paired with an `orphanGitmodulesEntry` for the same path is a mid-add/remove transition, and that one seen right after a branch switch belongs to the checkout, so switching back comes before either remedy.

- The `repos` skill now says that `sync` advances a clean checkout onto a moved gitlink (`advanced`), reports a dirty one as `skippedDirty`, and works from a linked git worktree.

## 4.5.0

### Breaking Changes

#### Build tooling moves to the effected plugin

- The silk plugin now covers workflow only: changesets, commits, pull requests, Turborepo, vendored repos and dogfooding. Packages build with `effected package build`, and the effected agent plugin owns the build tooling that silk used to ship.

- Removed the `/silk:build` and `/silk:tsdoc` skills and the `tsdoctor` agent. Build and TSDoc guidance now belongs to the effected plugin, which has been asked to ship it; until it does, no plugin carries these.

- Removed the `tsdoc-diagnostics` monitor, which watched `dist/<target>/issues.json`. Claude Code keeps the `dogfood-mail` and `gitmodules-drift` monitors.

- The session-start orientation no longer lists the removed skills, agent or monitor.

- The `turborepo` agent and `/silk:turbo` skill now describe the current workspace: nothing builds on install, and one `build` task writes `dist/prod`. [#871][#871]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#871]: https://github.com/savvy-web/systems/pull/871

## 4.4.3

### Maintenance

- Rebuilt the Claude Code and Copilot plugin builds against pluginfinity 0.3.8. [#825][#825]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#825]: https://github.com/savvy-web/systems/pull/825

## 4.4.2

### Maintenance

- Rebuilt the Claude Code and Copilot plugin builds against the pluginfinity 0.3.1 hook library. The committed builds still recorded 0.3.0 after the pluginfinity update. [#789][#789]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#789]: https://github.com/savvy-web/systems/pull/789

## 4.4.1

### Bug Fixes

- `commit.sh`, `validate-message.sh` and the changeset `list.sh` no longer let an inherited `SILK_PROJECT_DIR` override the working tree you are standing in. Inside a git worktree, a `SILK_PROJECT_DIR` naming another worktree of the same repository is ignored with a notice, and one naming a different repository is refused with both paths named. Previously a subagent started in a worktree by a coordinating session committed into that session's main checkout. `SILK_PROJECT_DIR` now only applies when the working directory is outside any git repository; to target another repository, `cd` into it. [#763][#763]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#763]: https://github.com/savvy-web/systems/pull/763

## 4.4.0

### Features

- The silk agent plugin is now built from a single pluginfinity source into both a Claude Code plugin and a new GitHub Copilot plugin, with a Copilot plugin marketplace published under `.github/plugin/`.
- Session environment is declared by the plugin and can be set per project in `.env` or `.env.local`. `SILK_PACKAGE_MANAGER` and `SILK_SKIP_CHANGESET_NUDGE` are supported.
- Hook debug logging now lives in one place: `$XDG_STATE_HOME/pluginfinity/silk/error.log` and `debug.log`. Set `PLUGINFINITY_DEBUG=1` to enable debug output. This replaces the `SILK_HOOK_*_LOG` overrides.

### Bug Fixes

- Guard hooks now fail closed: if a guard hook itself crashes, the tool call is denied rather than allowed through. Advisory hooks still fail open.
- The `savvy-mcp` launcher fallback no longer fails with `EBADDEVENGINES` in projects that set pnpm `devEngines`.
- Skill scripts are no longer pinned to the tree where the session started, so they follow the active worktree.
- Startup-only orientation now runs on fresh Copilot sessions.
- Project directory resolution is now correct inside git worktrees. [#756][#756]

### Thanks

Thanks to [@spencerbeggs](https://github.com/spencerbeggs) for their contributions!

[#756]: https://github.com/savvy-web/systems/pull/756
