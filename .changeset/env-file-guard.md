---
"@savvy-web/ai-plugins": minor
---

## Features

### Guard the real environment files

A new fail-closed `env-file-guard` hook stops agents reading or writing `.envrc`, `.env`, `.env.*` and `.dev.vars`, which can hold secrets. It covers Read, Write, Edit, MultiEdit, NotebookEdit and Grep, and Bash readers, redirects and `tee`. It also covers `direnv exec <dir> env`, `printenv`, `export` and `set`, and `direnv export` and `direnv dump`. The `.example` files read and write normally, and `direnv exec . <cmd>` still runs, so an agent can use a variable without seeing it. The deny points the agent at `.envrc.example` and at 1Password `op://` references.
