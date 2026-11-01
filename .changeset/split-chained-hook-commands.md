---
"@savvy-web/silk-effects": patch
---

## Bug Fixes

The commit-message pre-tool-use guard now checks chained commands. `Commitlint.parseBashCommand` used to drop shell operators and inspect only the first words, so the guard skipped these shapes entirely:

- `git add -A && git commit -m "…"`
- `cd pkg && git commit …`
- `FOO=1 git commit …`
- a `gh pr create` that follows a `;`

The command is now split on its control operators (`&&`, `||`, `;`, `|`, `&` and subshell parentheses), leading variable assignments are skipped, and the first `git commit` or `gh pr create`/`edit` is classified. A later command's flags no longer leak into the commit's: `git commit -m "…" && git push --no-verify` no longer reports `noVerify`. An operator inside a quoted message is still part of the message.
