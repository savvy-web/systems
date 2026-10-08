# @savvy-web/ai-plugins

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
