#!/usr/bin/env bash
# Exit 0 if the command matches a pattern in safe-bash-patterns.txt; 1 otherwise.
# Hard exclusions deny always-dangerous commands AND any compound script that
# contains a commit operation — the cold path validates those.
set -euo pipefail

CMD="${1:-}"
[ -z "$CMD" ] && exit 1

# Hard exclusion: any command that contains a commit operation, even buried
# inside a compound script (`git status && git commit -m '...'`, multi-line
# scripts, `cmd1 ; git commit`, etc.). These must always route to the cold
# path in pre-tool-use/commit-bash.sh for commit-message validation.
if echo "$CMD" | grep -qE '(^|[[:space:];|&]|env([[:space:]]+[A-Z_][A-Z0-9_]*=[^[:space:]]+)*[[:space:]]+)(git[[:space:]]+commit|gh[[:space:]]+pr[[:space:]]+(create|edit))(\b|$)'; then
	exit 1
fi

# Hard exclusions — always require user approval.
if echo "$CMD" | grep -qE '^[[:space:]]*(rm|mv|cp|chmod|chown|curl|wget)(\b|$)'; then exit 1; fi
# Force-pushes require approval. `-f` must be matched as a whole token: an
# unanchored `-f` substring-matches inside `--follow-tags` and inside any branch
# name containing it (`git push origin my-feature`), knocking ordinary pushes off
# the hot path. `--force[a-z-]*` keeps the lease/if-includes variants excluded.
if echo "$CMD" | grep -qE 'git[[:space:]]+push[[:space:]]+(.*[[:space:]])?(-f|--force[a-z-]*)([[:space:]]|$)'; then exit 1; fi
# Deny `git push --delete <ref>` (silently removes a remote branch/tag) and
# `git push --tags` (publishes every local tag, including force-tag overrides).
if echo "$CMD" | grep -qE 'git[[:space:]]+push\b.*[[:space:]](--delete|-d|--tags|--mirror)\b'; then exit 1; fi
if echo "$CMD" | grep -qE 'git[[:space:]]+reset[[:space:]]+--hard\b'; then exit 1; fi
if echo "$CMD" | grep -qE '^[[:space:]]*pnpm[[:space:]]+(install|add|remove|update|dlx)(\b|$)'; then exit 1; fi
if echo "$CMD" | grep -qE '^[[:space:]]*(npm|yarn|bun)[[:space:]]+(install|add|remove|update)(\b|$)'; then exit 1; fi
if echo "$CMD" | grep -qE '^[[:space:]]*(npx|bunx|yarn[[:space:]]+dlx)(\b|$)'; then exit 1; fi
if echo "$CMD" | grep -qE 'gh[[:space:]]+(repo[[:space:]]+delete|secret\b)'; then exit 1; fi
# Defense in depth: deny git rm with --force/-rf even if the allowlist matched.
if echo "$CMD" | grep -qE 'git[[:space:]]+rm[[:space:]]+([^[:space:]]+[[:space:]]+)*(--force|-rf|-fr|-r[[:space:]]+-f|-f[[:space:]]+-r)\b'; then exit 1; fi
# Deny git stash drop / clear (silent destructive variants).
if echo "$CMD" | grep -qE 'git[[:space:]]+stash[[:space:]]+(drop|clear)\b'; then exit 1; fi
# Deny tee writing to absolute paths, home-dir expansion, or path traversal.
# tee is allowlisted for pipeline logging to relative paths; absolute targets bypass the write guard.
if echo "$CMD" | grep -qE '\btee\b.*[[:space:]]([/~]|\.\.)'; then exit 1; fi
# Also deny tee paths containing /.. (catches ./../ traversal patterns).
if echo "$CMD" | grep -qE '\btee\b.*/\.\.'; then exit 1; fi
# Deny shell redirects (> or >>) to absolute paths, home-dir, or path traversal.
# Includes fd-prefixed redirects (1>, 2>>). Exempts N>/dev/null (safe stderr/stdout suppression).
if echo "$CMD" | grep -qE '(^|[[:space:]])[0-9]*>>?[[:space:]]*(\/|~|\.\.)' && \
   ! echo "$CMD" | grep -qE '[[:space:]][0-9]*>+/dev/null\b'; then exit 1; fi
# Also deny redirect paths containing /.. (catches > ./../ traversal patterns).
if echo "$CMD" | grep -qE '(^|[[:space:]])[0-9]*>>?[[:space:]]*[^[:space:]]*/\.\.'; then exit 1; fi

PATTERNS="${BASH_SOURCE%/*}/safe-bash-patterns.txt"
# grep -E reads patterns from a file; -f tells it to use that file. Skip comments + blanks.
_tmp=$(mktemp -t savvy-bash-patterns.XXXXXX)
trap 'rm -f "$_tmp"' EXIT
grep -vE '^[[:space:]]*(#|$)' "$PATTERNS" > "$_tmp" 2>/dev/null
if echo "$CMD" | grep -qE -f "$_tmp"; then exit 0; fi
exit 1
