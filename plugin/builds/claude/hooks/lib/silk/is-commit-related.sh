#!/usr/bin/env bash
# Cheap heuristic: does the command look like one whose message we should
# inspect? Exit 0 if yes, 1 if no.
set -euo pipefail

CMD="${1:-}"
[ -z "$CMD" ] && exit 1

# Match bare and env-prefixed forms (e.g. `env GIT_AUTHOR_DATE=... git commit`).
ENV_PREFIX='(env([[:space:]]+[A-Z_][A-Z0-9_]*=[^[:space:]]+)*[[:space:]]+)?'
if echo "$CMD" | grep -qE "^[[:space:]]*${ENV_PREFIX}git[[:space:]]+commit\\b"; then exit 0; fi
if echo "$CMD" | grep -qE "^[[:space:]]*${ENV_PREFIX}gh[[:space:]]+pr[[:space:]]+(create|edit)\\b"; then exit 0; fi
exit 1
