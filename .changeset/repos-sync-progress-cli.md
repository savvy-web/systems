---
"@savvy-web/cli": minor
---

## Features

`savvy repos sync` prints each repo as it finishes, so a run that fails part-way still shows what already landed, and draws a live progress view (repos done out of the total, and the current repo) at a terminal. A piped run, such as the session hook, never loads the view and never prompts.
