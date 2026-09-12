/**
 * `@savvy-web/cli` — the `savvy` CLI for the Silk Suite.
 *
 * @remarks
 * This entry point re-exports the `changeset`, `commit`, `lint`, and `repos` command
 * groups and their named handlers. The assembled root `savvy` command and its merged
 * runtime layer stack live in `./cli/index.js`; the process-owning `main()` that runs
 * them lives at `@savvy-web/cli/main` (`./main.js`) — see `bin.ts`.
 *
 * @packageDocumentation
 */

export { changesetCommand, runChangesetCheck, runChangesetInit } from "./commands/changeset/index.js";
export { checkCommand, runCheck } from "./commands/check.js";
export { commitCommand, runCommitCheck, runCommitInit } from "./commands/commit/index.js";
export { initCommand, runInit } from "./commands/init.js";
export { lintCommand, runLintCheck, runLintInit } from "./commands/lint/index.js";
export { reposCommand, runReposStatus, runReposSync } from "./commands/repos/index.js";
