#!/usr/bin/env sh
# Launch the Biome language server for the Claude Code LSP integration.
#
# Resolution order (matches the suite's "prefer global" workflow and the
# Lint.Biome discovery order):
#   1. Global `biome` on PATH (the VS Code extension path).
#   2. Project-local node_modules/.bin/biome (walk up from the project dir).
#   3. Neither -> actionable error on stderr, non-zero exit.
set -eu

# 1. Global biome on PATH.
if command -v biome >/dev/null 2>&1; then
	exec biome lsp-proxy "$@"
fi

# 2. Project-local: walk up for node_modules/.bin/biome.
dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
while [ -n "$dir" ] && [ "$dir" != "/" ]; do
	if [ -x "$dir/node_modules/.bin/biome" ]; then
		exec "$dir/node_modules/.bin/biome" lsp-proxy "$@"
	fi
	dir=$(dirname "$dir")
done

# 3. Not found.
echo "biome-lsp: Biome not found. Install @biomejs/biome globally (recommended: 'brew install biome' or 'npm i -g @biomejs/biome') or add it as a devDependency so node_modules/.bin/biome exists." >&2
exit 127
