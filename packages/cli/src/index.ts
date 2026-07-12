/**
 * `@savvy-web/cli` — the `savvy` CLI for the Silk Suite.
 *
 * @remarks
 * This entry point re-exports the `changeset`, `commit`, `lint`, and `repos` command
 * groups, their named handlers, and `runCli` — the assembled root `savvy` command with
 * its merged runtime layer stack.
 *
 * @packageDocumentation
 */

export { runCli } from "./cli/index.js";
export { changesetCommand, runChangesetCheck, runChangesetInit } from "./commands/changeset/index.js";
export { checkCommand, runCheck } from "./commands/check.js";
export { commitCommand, runCommitCheck, runCommitInit } from "./commands/commit/index.js";
export { initCommand, runInit } from "./commands/init.js";
export { lintCommand, runLintCheck, runLintInit } from "./commands/lint/index.js";
export { reposCommand, runReposStatus, runReposSync } from "./commands/repos/index.js";
