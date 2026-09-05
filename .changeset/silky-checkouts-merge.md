---
"@savvy-web/cli": minor
---

## Features

### Dependency auto-install in managed hooks

`savvy lint init` and `savvy commit init` now write a `SAVVY-INSTALL` section into `.husky/post-checkout` and `.husky/post-merge` (never `post-commit`, which fires on every commit and would make the check too noisy to be useful). `post-merge` matters most in practice: a fast-forward `git pull` fires `post-merge` and never `post-checkout`, so the pull case only works because the section goes into both.

`savvy lint check` and `savvy commit check` now report the section's status alongside the existing savvy-toolchain drift check, flagging when it is missing or outdated and pointing back to `savvy init`.

`savvy lint init` additionally reports when the workspace publishes through built link directories, naming the `git config --local savvy.installLifecycleScripts true` command that lets a hook-time install run lifecycle scripts. It reports rather than sets: enabling that means later hook installs may execute code from whatever revision was checked out, which is the checkout owner's decision to make.
