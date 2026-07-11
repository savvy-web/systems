---
"@savvy-web/cli": patch
---

## Bug Fixes

* `savvy commit hook post-commit-verify` no longer reports a signing problem when a signature merely cannot be verified. Git's `%G?` reports `E` for "signature cannot be checked (e.g. missing key)" — the commit is signed, but the checking process cannot reach the keyring or gpg-agent, which is routine inside a hook subprocess. The hook treated `E` as a defect alongside `B` (bad), `R` (revoked), and `X`/`Y` (expired), and told the user to investigate their signing setup and amend. In practice it fired on correctly signed commits: the same commit that reports `E` from the hook reports `G` from an interactive shell. Failure to verify is not evidence of a bad signature, and amending would not have fixed anything. Genuinely defective signatures are still reported, and an unsigned commit under `commit.gpgsign=true` still is too.
