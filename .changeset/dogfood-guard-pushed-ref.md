---
"@savvy-web/silk": patch
---

## Bug Fixes

### Dogfood Push Guard Scans the Pushed Ref

The dogfood push guard now inspects the `pnpm-workspace.yaml` committed on the ref a `git push` names, not only the working tree. Pushing a link-free release branch from a checkout that is still linked is no longer denied, and pushing a linked branch by name from a clean checkout is no longer allowed. A push whose destination is `dev` is exempt like the `dev` branch itself, and anything the guard cannot resolve falls back to the working-tree scan.

### Dogfood Mail Pointers Are Validated

`journal-append.sh` now rejects a `--mail-in` that does not resolve to a file in the repo, and normalizes a bare filename to its repo-relative mailbox path when the mail exists there. The mail monitor also retries a bare-filename `lastMail.in` against the counterpart's mailbox, so already-processed mail is no longer re-announced every session.

## Documentation

### Config-Dependency Pins at Dogfood Exit

The dogfood skill's `--exit` and `release` mail guidance now names the two independent stale objects when versions arrive through a `configDependencies` catalog: the pin (version and integrity) and the lockfile. Dropping the lockfile is required, not hygiene, and the exit is verified by resolution rather than by reading a manifest.
