#!/usr/bin/env bash
set -euo pipefail

# PreToolUse (matcher: Bash) -- deny direct access to the Biome binary.
# Package-manager scripts (`pnpm lint`, `pnpm --filter <pkg> lint`, `pnpm -r
# lint`, `turbo run lint`, ...) are left alone entirely: that is where config
# resolution genuinely happens, so nothing about a script invocation can
# cause the corruption hazard below. One rule, no exception, no heuristic:
# this hook denies exactly the commands that reach the biome binary
# directly -- precisely detectable from the command string -- and nothing
# else.
#
# Supersedes this hook's earlier incarnation (biome-npx-deny.sh), which
# denied only `npx biome` / `bunx biome`, and this hook's own first version
# on this branch, which ALSO denied any package-manager script other than
# the three sanctioned names (e.g. `pnpm --filter @savvy-web/cli lint`) as
# an "accepted consequence." Probing that version showed it was backwards
# against the actual hazard: it blocked decorated forms of the sanctioned
# script names while letting every OTHER script name through unexamined
# (`pnpm lint:custom` could invoke Biome any way it liked and was never even
# considered). A script invocation resolves package.json, and therefore the
# repo's Biome config, regardless of which script name or package-manager
# flag reaches it -- `pnpm --filter <pkg> lint`, `pnpm -r lint`, and `turbo
# run lint` are exactly as config-safe as bare `pnpm lint`. A hazard-accurate
# version of that removed check would mean resolving package.json scripts
# (and, for `turbo run`, the workspace task graph) to see what a script's
# body actually invokes -- machinery this hook does not have. An
# approximate DENY is worse than an approximate nudge here: a missed nudge
# is a lost hint, but a false deny blocks legitimate work, the exact failure
# class savvy-web/systems#387 needed four fix rounds to eliminate. So the
# rule stays narrow: only what is directly, syntactically verifiable from
# the command string is denied.
#
# Two reasons drove the original widening from npx/bunx-only to "every
# direct route":
#
# 1. mcp__plugin_silk_savvy-mcp__biome_check returns typed, structured
#    diagnostics; Bash Biome returns text an agent has to parse.
# 2. Agents greedily run Biome directly and corrupt git submodules -- the
#    load-bearing reason. A direct invocation does not resolve the repo's
#    config (root biome.jsonc extends packages/silk/public/biome/silk.jsonc,
#    which excludes !**/.repos and !.claude/worktrees). Without the config,
#    Biome walks straight into .repos/**, read-only vendored source guarded
#    separately by repos-*-guard.sh.
#
# EVERY direct route is denied, including forms that resolve REAL Biome:
# `npx @biomejs/biome` / `bunx @biomejs/biome` were deliberately allowed
# under the previous npx-only rule (that scoped package name fetches the
# actual Biome, not the unrelated 0.3.3 impostor at savvy-web/systems#380).
# That carve-out is reversed here -- real Biome invoked without the repo
# config is exactly the corruption hazard this hook exists to stop, scoped
# package name or not.
#
# CONSUMER FALSE POSITIVE, accepted deliberately (savvy-web/systems#410).
# In an external consumer of @savvy-web/silk that has a real
# node_modules/.bin/biome on its path, `npx biome` resolves the ACTUAL
# Biome and largely does resolve that repo's root config -- so the deny
# fires on a command whose stated hazard is absent. That does not happen
# here: pnpm's isolated layout leaves no root node_modules/.bin/biome, which
# is exactly why `npx biome` reaches the unrelated biome@0.3.3 impostor
# instead. The alternative -- sniffing for a shadowing local binary and
# allowing npx through when one exists -- trades a clean, syntactic rule for
# a heuristic that still cannot tell whether the config resolves from the
# caller's cwd. Since the deny message names working alternatives (the lint
# scripts, the biome_check MCP tool), the cost downstream is a redirect
# rather than lost capability, and "use the scripts" is the rule we want in
# a consumer repo either way. Keep the rule; document the case.
#
# Coverage is NOT keyed to this repo's package manager: an agent that cannot
# run `biome` will reach for `npx biome` in a pnpm repo just as readily as in
# a yarn or bun one. Silk ships to pnpm, yarn, bun and npm consumers, so
# every pm x route permutation is handled identically.
#
# This DENIES rather than nudging, which is why it is a separate hook from
# biome-prefer-mcp.sh (that one's contract is "never blocks: additionalContext
# only"). Both may fire on the same command; a deny is authoritative.
#
# Segmenting (quote-aware, control-operator boundaries) and prefix-peeling
# (env / VAR=value / sudo / command / time / exec / npx / bunx / bun x /
# pnpm|yarn dlx / pnpm|npm|yarn|bun[ run], reduced all the way down to the
# invoked binary name) are shared with biome-prefer-mcp.sh -- see
# hooks/lib/split-segments.sh for the full rationale, including the
# RS="\001" awk sentinel and the #250 performance note.
#
# TRIPWIRE, not a security boundary: best-effort command-string matching, not
# a full shell parse. Fails open -- no jq, malformed envelope, or non-Bash
# tool exits 0 silently.

# shellcheck source=../lib/hook-output.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-output.sh"
# shellcheck source=../lib/hook-debug.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-debug.sh"
# shellcheck source=../lib/hook-env.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/hook-env.sh"
# shellcheck source=../lib/split-segments.sh
. "${CLAUDE_PLUGIN_ROOT}/hooks/lib/split-segments.sh"

_HOOK="pre-tool-use/biome-direct-deny"

if ! command -v jq >/dev/null 2>&1; then
	hook_error "$_HOOK" "jq not found; skipping"
	emit_noop
	exit 0
fi

read_envelope_or_noop "$_HOOK"
ENVELOPE="$HOOK_ENVELOPE"

TOOL=$(echo "$ENVELOPE" | jq -r '.tool_name // empty')
[ "$TOOL" = "Bash" ] || { emit_noop; exit 0; }

COMMAND=$(echo "$ENVELOPE" | jq -r '.tool_input.command // empty')
[ -z "$COMMAND" ] && { emit_noop; exit 0; }

# Cheap short-circuit: a real invocation necessarily contains the literal
# substring "biome" somewhere in $COMMAND -- even the scoped `@biomejs/biome`
# package name does. There is no longer a package-manager-script DENY path
# (see header comment), so unlike this hook's first version on this branch,
# "biome" is now the ONLY substring anything below can match on.
if [[ "$COMMAND" != *biome* ]]; then
	emit_noop
	exit 0
fi

if ! command -v awk >/dev/null 2>&1; then
	hook_error "$_HOOK" "awk not found; skipping segmentation"
	emit_noop
	exit 0
fi

# True (exit 0) when "$1", a single segment already isolated at a
# command-position boundary by hook_split_segments, resolves -- after
# peeling env / VAR= / sudo / command / time / exec / npx / bunx / bun x /
# pnpm|yarn dlx / pnpm|npm|yarn|bun[ run], repeated -- to the biome binary:
# bare, path-prefixed, or a scoped package ending in "/biome". That last
# case is what makes `npx @biomejs/biome` match too: the leading
# "@biomejs/" satisfies the same optional path-prefix group that
# "/usr/local/bin/" or "./node_modules/.bin/" does -- deliberate, since a
# scoped-package invocation is no longer exempt (see the header comment
# above). A package-manager script invocation -- sanctioned name or not,
# bare or `--filter`/`-r`-decorated, `turbo run <task>` included -- never
# reduces to this shape: peeling stops at the script or task name, not at
# whatever that script's body goes on to invoke, so it is never mistaken for
# a direct Biome invocation.
_segment_is_biome_direct() {
	local seg="$1"
	seg="$(hook_peel_segment_prefix "$seg")"
	[ -z "$seg" ] && return 1
	[[ "$seg" =~ ^([^[:space:]]*/)?biome([[:space:]]|$) ]]
}

HOOK_CMD_SEGMENTS=()
hook_split_segments "$COMMAND"

is_denied=0
for _segment in "${HOOK_CMD_SEGMENTS[@]}"; do
	if _segment_is_biome_direct "$_segment"; then
		is_denied=1
		break
	fi
done

[ "$is_denied" -eq 0 ] && { emit_noop; exit 0; }

DENY_MSG="Direct Biome invocation is denied: it does not resolve this repo's config, so it lints paths the config excludes — in this repo that means .repos/** vendored submodules, which are read-only and can be corrupted. Use the mcp__plugin_silk_savvy-mcp__biome_check MCP tool (write: true applies safe fixes), or the sanctioned Bash path: pnpm lint / pnpm lint:fix / pnpm lint:fix:unsafe at the repo root (yarn/bun/npm equivalents also allowed). In a consumer repo that has its own node_modules/.bin/biome, this deny is a redirect rather than a real hazard — the lint scripts are still the intended path (savvy-web/systems#410)."

emit_deny "$DENY_MSG"
exit 0
