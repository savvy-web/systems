---
"@savvy-web/ai-plugins": patch
---

## Bug Fixes

- The `repos-bash-guard` hook now judges `sed -i`, `rm`, `patch` and `dd of=` inside their own clause. A `grep -i` or a `grep` for the word `rm` or `patch` in one clause no longer turns a read of a vendored file in another clause into a denied write. The sed `-i` check also catches `-i.bak` and `--in-place=.bak`, which it missed before. Deletes whose operands come from elsewhere are still denied: `find .repos/x -exec rm` and `-delete`, `... | xargs rm`, an `rm` in a `for` or `while` loop over `.repos/` paths, and an `rm` behind a wrapper flag such as `sudo -u root` or `nice -n 5`. Closes #594 and #853.
- The hook now resolves each `.repos/` path against the call's directory and denies a write only when the path lands under the project's own `.repos/`. A `.repos/` directory in a scratch tree or another checkout is no longer guarded. The `.repos/config.json` manifest stays writable when spelled `./.repos/config.json` or by absolute path. A path built from `$VAR` or a command substitution still denies, and so does a relative path in a command that runs `cd`, `pushd` or `popd`, because the guard cannot tell which directory that path is relative to. Closes #757.
