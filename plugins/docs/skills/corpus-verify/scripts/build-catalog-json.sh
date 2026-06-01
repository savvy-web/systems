#!/usr/bin/env bash
# build-catalog-json.sh — run build:catalog and emit a JSON summary parsed from
# the "[build-catalog] ERROR|WARN ..." and "wrote manifest with N entries" lines.
set -euo pipefail

SYSTEMS_DIR="${SAVVY_SYSTEMS_DIR:-}"
if [ -z "$SYSTEMS_DIR" ]; then
	base="${CLAUDE_PROJECT_DIR:-$(pwd)}"
	if git -C "$base" remote get-url origin 2>/dev/null | grep -q 'savvy-web/systems'; then
		SYSTEMS_DIR="$(git -C "$base" rev-parse --show-toplevel)"
	fi
fi
if [ -z "$SYSTEMS_DIR" ] || [ ! -d "$SYSTEMS_DIR/packages/mcp" ]; then
	echo '{"pass":false,"errors":["savvy-web/systems checkout not found; set SAVVY_SYSTEMS_DIR"],"warnings":[],"entryCount":0}'
	exit 1
fi

cd "$SYSTEMS_DIR"
set +e
out="$(pnpm exec turbo run build:catalog --filter @savvy-web/mcp 2>&1)"
code=$?
set -e

errors="$(printf '%s\n' "$out" | sed -n 's/.*\[build-catalog\] ERROR //p' | jq -R . | jq -s .)"
warnings="$(printf '%s\n' "$out" | sed -n 's/.*\[build-catalog\] WARN //p' | jq -R . | jq -s .)"
entries="$(printf '%s\n' "$out" | sed -n 's/.*\[build-catalog\] wrote manifest with \([0-9]*\) entries.*/\1/p' | tail -1)"
[ -z "$entries" ] && entries=0
pass=false; [ "$code" -eq 0 ] && pass=true

jq -n --argjson e "$errors" --argjson w "$warnings" --argjson n "$entries" --argjson p "$pass" \
	'{pass:$p, errors:$e, warnings:$w, entryCount:$n}'
exit "$code"
