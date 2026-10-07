#!/usr/bin/env bash
# env-setup.sh — the session-env setup script (pluginfinity.config.ts `env.setup`).
#
# The generated SessionStart runner (lib/pluginfinity/env-run.sh) runs this once
# per SessionStart, under bash, with the project as its working directory and
# a 10 s bound. Each `NAME=value` line it prints sets a declared session
# variable, ranking above the config default and below the project's .env,
# .env.local and the ambient environment. There is no hook library here: no
# hook_* calls, and nothing but NAME=value lines on stdout.
#
# SILK_PACKAGE_MANAGER is the package manager detect_package_manager finds for
# the project; it fails open to npm. Readers keep their own detect-when-empty
# fallback, because a reader that races the runner sees the config default "".
set -euo pipefail

# shellcheck source=../hooks/lib/silk/hook-env.sh
. "$(dirname "$0")/../hooks/lib/silk/hook-env.sh"

printf 'SILK_PACKAGE_MANAGER=%s\n' "$(detect_package_manager "$PWD")"
