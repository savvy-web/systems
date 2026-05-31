#!/usr/bin/env bash
# Detect package manager and emit the runner prefix that should be used to
# invoke the savvy CLI. Used by all bash hooks that need to call the CLI.
# Call sites prepend the appropriate subcommand, e.g.: $RUN savvy commit hook <name>
set -euo pipefail

# Three-tier project root resolution: prefer CLAUDE_PROJECT_DIR (set by Claude
# Code in every hook subprocess), fall back to the git toplevel (reliable for
# standalone invocation), and finally pwd as a last resort.
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
PM="npm"

if [ -f "$ROOT/package.json" ] && command -v jq >/dev/null 2>&1; then
  pm_field=$(jq -r '.packageManager // empty' "$ROOT/package.json" 2>/dev/null | cut -d'@' -f1 || true)
  if [ -n "$pm_field" ]; then PM="$pm_field"; fi
fi

if [ "$PM" = "npm" ]; then
  if   [ -f "$ROOT/pnpm-lock.yaml" ]; then PM="pnpm"
  elif [ -f "$ROOT/yarn.lock" ];      then PM="yarn"
  elif [ -f "$ROOT/bun.lock" ];       then PM="bun"
  fi
fi

case "$PM" in
  pnpm) echo "pnpm exec" ;;
  yarn) echo "yarn exec" ;;
  bun)  echo "bunx" ;;
  *)    echo "npx --no --" ;;
esac
