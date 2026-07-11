#!/usr/bin/env bash
# run-hook-tests.sh — single entry point for the silk plugin's hook test suite.
#
# 1. shellcheck over every shell entry script under hooks/, bin/, and tests/,
#    plus the tests/*.bash helpers. Sourced-only libs (hooks/lib/hook-output.sh,
#    hook-debug.sh, source-session-env.sh) carry no shebang; they are validated
#    IN CONTEXT via `-x` (follow-source) from the scripts that source them,
#    which also avoids the spurious SC2148 they would raise when linted
#    standalone. `-P SCRIPTDIR` resolves each `# shellcheck source=` directive
#    relative to the sourcing script's own directory.
# 2. bats over every tests/*.bats suite.
#
# Invoked by the root `pnpm test:hooks` script and by CI.
set -euo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "${TESTS_DIR}/.." && pwd)"
cd "$PLUGIN_ROOT"

missing=0
for tool in shellcheck bats jq; do
	if ! command -v "$tool" >/dev/null 2>&1; then
		echo "run-hook-tests: required tool '${tool}' not found on PATH." >&2
		missing=1
	fi
done
if [ "$missing" -ne 0 ]; then
	echo "Install them (macOS: 'brew install shellcheck bats-core jq'; Debian/Ubuntu: 'apt-get install shellcheck bats jq')." >&2
	exit 127
fi

# --- 1. shellcheck ---------------------------------------------------------
shellcheck_targets=()
while IFS= read -r f; do
	# Only pass scripts with a shebang as top-level inputs; the sourced-only
	# libs are reached via -x from these and must not be linted standalone.
	if head -n1 "$f" | grep -q '^#!'; then
		shellcheck_targets+=("$f")
	fi
done < <(find hooks bin tests skills -type f -name '*.sh' | sort)

# tests/*.bash helpers carry a `# shellcheck shell=bash` directive.
while IFS= read -r f; do
	shellcheck_targets+=("$f")
done < <(find tests -maxdepth 1 -type f -name '*.bash' | sort)

echo "==> shellcheck (${#shellcheck_targets[@]} scripts)"
shellcheck -x -P SCRIPTDIR "${shellcheck_targets[@]}"
echo "    shellcheck: clean"

# --- 2. bats ---------------------------------------------------------------
echo "==> bats"
bats tests/*.bats
