# silk

The companion agent plugin for [`@savvy-web/silk`](../packages/silk): skills, agents, hooks and MCP tools that teach Claude Code and GitHub Copilot the Silk Suite's changeset, commit, lint and Turborepo conventions.

## Install

The plugin is distributed from the `savvy-web-systems` marketplace in this repository, not from npm.

**Claude Code:**

```sh
claude plugin marketplace add savvy-web/systems
claude plugin install silk@savvy-web-systems
```

Inside a session, `/plugin marketplace add savvy-web/systems` and `/plugin install silk@savvy-web-systems` do the same.

**GitHub Copilot CLI:**

```sh
copilot plugin marketplace add savvy-web/systems
copilot plugin install silk@savvy-web-systems
```

Requires a repository that uses `@savvy-web/silk` (it provides the `savvy` and `savvy-mcp` binaries the plugin calls), plus `bash`, `jq` and `git` on `PATH`. The Biome language server needs Biome installed in the project.

## What you get

- **Skills.** `/silk:changeset` (create, squash, list, preview and check changesets), `/silk:changeset-style`, `/silk:changeset-config`, `/silk:commit-create` (the commit-message contract), `/silk:pr-body` (pull-request descriptions), `/silk:build`, `/silk:tsdoc`, `/silk:turbo`, `/silk:repos` (vendored reference repos) and `/silk:dogfood` (cross-repo dogfooding).
- **Agents.** `changeset-manager` writes and reconciles changesets, `turborepo` diagnoses Turborepo caching and task graphs, and `tsdoctor` drives API Extractor and TSDoc diagnostics to zero.
- **MCP tools.** The `savvy-mcp` server gives structured answers about the workspace: layout, Turborepo state, Biome diagnostics, changesets, dependency changesets and vendored repos.
- **Biome language server.** Lint and format diagnostics on the files you edit.
- **Hooks.** A session-start orientation, guards that check commit messages, block direct Biome runs and writes into read-only vendored repos, block pushes while local `file:` overrides are linked, and validate changeset files as you write them.

Claude Code also gets three background monitors (build diagnostics, dogfood mail, vendored-repo drift) and the `/silk:it2` iTerm2 pane skill, plus advisory nudges and an end-of-turn reminder when a branch has no changeset. Copilot has no equivalent for these. On Copilot the agent passes the project directory to each MCP tool, because the server cannot detect it there.

## Contributing

The plugin is built from one source for both hosts. Read [`CLAUDE.md`](CLAUDE.md) first; the design notes live in the repository's knowledge bundle, starting at [`okf/modules/silk-plugin.md`](../okf/modules/silk-plugin.md).

## License

[MIT](../LICENSE)
