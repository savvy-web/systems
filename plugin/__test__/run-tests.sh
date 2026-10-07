#!/usr/bin/env bash
# run-tests.sh — the silk plugin's pluginfinity test suite.
#
# 1. pluginfinity build, so builds/ is current (every suite runs against it).
# 2. shellcheck over the BUILT hook, launcher, skill and env-setup scripts of both
#    targets: the hook library they source exists only in builds/, so linting
#    them there follows every `source` to a real file. `-x -P SCRIPTDIR`
#    resolves each `# shellcheck source=` directive relative to the script.
# 3. bats over __test__/*.bats; every hook and script suite runs once per
#    target (claude, copilot).
# 4. pluginfinity build --check, which must be clean.
#
# Run from anywhere: `bash plugin/__test__/run-tests.sh`, or the package's
# `test:hooks` script.
set -euo pipefail

TESTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "${TESTS_DIR}/.." && pwd)"
cd "$PLUGIN_DIR"

missing=0
for tool in shellcheck bats jq git node; do
	if ! command -v "$tool" >/dev/null 2>&1; then
		echo "run-tests: required tool '${tool}' not found on PATH." >&2
		missing=1
	fi
done
if [ "$missing" -ne 0 ]; then
	echo "Install them (macOS: 'brew install shellcheck bats-core jq git'; Debian/Ubuntu: 'apt-get install shellcheck bats jq git nodejs')." >&2
	exit 127
fi

PF="node node_modules/pluginfinity/bin/pluginfinity.js"

echo "==> pluginfinity build"
$PF build >/dev/null

echo "==> shellcheck"
targets=()
for target in claude copilot; do
	while IFS= read -r f; do
		# Sourced-only helpers carry no shebang; they are linted in context
		# through -x from the scripts that source them.
		if head -n1 "$f" | grep -q '^#!'; then
			targets+=("$f")
		fi
	done < <(find "builds/${target}/hooks" "builds/${target}/bin" "builds/${target}/skills" "builds/${target}/scripts" -type f -name '*.sh' | sort)
done
targets+=("${TESTS_DIR}/common.bash" "${TESTS_DIR}/run-tests.sh")
shellcheck -x -P SCRIPTDIR "${targets[@]}"
echo "    shellcheck: clean (${#targets[@]} scripts)"

echo "==> bats"
# No stdin redirect: hooks get their fixture from run_hook, scripts get
# /dev/null from run_script, and no stub drains stdin, so the suite also passes
# with an inherited terminal or an open pipe on stdin.
bats "${TESTS_DIR}"/*.bats

echo "==> pluginfinity build --check"
$PF build --check >/dev/null
echo "    build --check: clean"
