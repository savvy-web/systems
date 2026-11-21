#!/usr/bin/env bash
set -euo pipefail

# PreToolUse guard (matchers: Read|Write|Edit|MultiEdit|NotebookEdit|Grep, and
# Bash) -- deny agents reading or writing the real environment files, which
# can hold secrets or values resolved from them (savvy-web/systems#794):
#
#   .envrc, .envrc.*, .env, .env.*, .dev.vars, .dev.vars.*
#
# matched on the BASENAME, so a nested path (apps/web/.env.local) counts too.
# A name ending in ".example" (.envrc.example, .env.example,
# .dev.vars.example) is never a secret file: agents read and edit those and
# describe the change, and the owner applies it to the real file.
#
# Routes covered:
#   - File tools: Read/Write/Edit/MultiEdit (tool_input.file_path, which the
#     library also reads from Copilot's `path`), NotebookEdit
#     (tool_input.notebook_path), Grep (tool_input.path's basename, and
#     tool_input.glob: a glob that can match an env file, such as `.env*`,
#     `**/.envrc` or `.env.{local,production}`, is denied; `*.example`, `*` and
#     `*.ts` are not).
#   - Bash: a reader in command position (cat, head, tail, less, sed, awk,
#     grep, rg, xxd, base64, cp, source, `.`, ...) with an argument naming a
#     real env file, or a glob argument that can match one; a `<`, `>` or
#     `>>` redirect onto one; `tee` onto one. `direnv exec <dir> <cmd>` is
#     judged by <cmd>: env, printenv, export, set and declare (the leak) are
#     denied, as is a reader of an env file; anything else runs, so an agent
#     can use a variable without seeing it. `direnv export` and `direnv dump`
#     print the loaded environment and are denied; `direnv allow`, `reload`
#     and `status` run.
#
# SCAN derivation (as in repos-bash-guard.sh): heredoc bodies are dropped and
# whitespace-containing quoted text is dropped, so prose that mentions .envrc
# (`gh issue comment --body "do not cat .envrc"`, a heredoc'd notes file)
# cannot trip the guard. The remainder is split at control operators by
# hook_split_segments and each segment's runner prefixes (env, VAR=value,
# sudo, command, time, exec, npx, pnpm/yarn/bun/npm [run]) are peeled.
#
# Known gaps (TRIPWIRE, not a security boundary -- the same stance as
# repos-bash-guard.sh):
#   - A directory-wide Grep with no env-file path or glob. ripgrep skips
#     gitignored files such as .env and .envrc by default, so the usual case
#     never reads them.
#   - Indirection: a variable or `$(...)` building the path at runtime, a
#     script or interpreter (python, node, ...) that opens the file itself,
#     `direnv exec . sh -c 'env'`, and git plumbing (`git show :.envrc`).
#   - Prose-like quoted paths: a quoted path containing whitespace is
#     dropped with the rest of the quoted prose.
#
# No subagent exemption: a deny holds inside a subagent's tool call too.
# Everything else exits 0 silently.

# shellcheck source=../lib/pluginfinity/hook.sh
. "$(dirname "$0")/../lib/pluginfinity/hook.sh"
# shellcheck source=../lib/silk/hook-env.sh
. "$(dirname "$0")/../lib/silk/hook-env.sh"
# shellcheck source=../lib/silk/split-segments.sh
. "$(dirname "$0")/../lib/silk/split-segments.sh"

hook_require_input

DENY_MSG="This file may hold secrets. Read or edit \`.envrc.example\` instead and describe the change; the owner applies it to \`.envrc\`. Secrets belong in 1Password as \`op://\` references read with \`op read\`."

# Names a glob is tested against: one representative of each secret shape.
ENV_FILE_SAMPLES=(.envrc .envrc.local .env .env.local .env.production .dev.vars .dev.vars.staging)

# _strip_token <token> -- drop one pair of surrounding quotes and any trailing
# `)`/backtick a command substitution left glued on.
_strip_token() {
	local t="$1"
	while [[ "$t" == *")" || "$t" == *'`' ]]; do t="${t%?}"; done
	while [[ "$t" == '`'* ]]; do t="${t#?}"; done
	t="${t%\"}"; t="${t#\"}"
	t="${t%\'}"; t="${t#\'}"
	printf '%s' "$t"
}

# is_secret_env_path <path> -- 0 when <path>'s basename is a real env file.
is_secret_env_path() {
	local base
	base="$(_strip_token "$1")"
	base="${base%/}"
	base="${base##*/}"
	[[ "$base" == *.example ]] && return 1
	case "$base" in
		.envrc | .envrc.* | .env | .env.* | .dev.vars | .dev.vars.*) return 0 ;;
	esac
	return 1
}

# _glob_alternatives <glob> -- print <glob> with one level of `{a,b}` braces
# expanded, one alternative per line (the glob itself when it has none).
_glob_alternatives() {
	local g="$1"
	if [[ "$g" =~ ^([^{}]*)\{([^{}]*)\}(.*)$ ]]; then
		local pre="${BASH_REMATCH[1]}" alts="${BASH_REMATCH[2]}" post="${BASH_REMATCH[3]}" a
		local -a parts
		IFS=',' read -ra parts <<<"$alts"
		for a in "${parts[@]}"; do printf '%s\n' "${pre}${a}${post}"; done
	else
		printf '%s\n' "$g"
	fi
}

# glob_reaches_env_file <glob> -- 0 when <glob> can match a real env file. A
# glob must name one literally ("env" or "dev.vars" in it) so a catch-all such
# as `*` is not mistaken for a reach at the env files; ripgrep and the shell
# skip dotfiles under `*` anyway.
glob_reaches_env_file() {
	local g alt base sample
	g="$(_strip_token "$1")"
	[[ "$g" == *env* || "$g" == *dev.vars* ]] || return 1
	while IFS= read -r alt; do
		base="${alt%/}"
		base="${base##*/}"
		[[ "$base" == *.example ]] && continue
		is_secret_env_path "$base" && return 0
		for sample in "${ENV_FILE_SAMPLES[@]}"; do
			# shellcheck disable=SC2053 # unquoted on purpose: a pattern match
			[[ "$sample" == $base ]] && return 0
		done
	done < <(_glob_alternatives "$g")
	return 1
}

# _arg_hits_env_file <token> -- 0 when a command argument names an env file:
# as a path, as a glob, or as the value of a `--flag=value`.
_arg_hits_env_file() {
	local t
	t="$(_strip_token "$1")"
	[ -z "$t" ] && return 1
	if [[ "$t" == -*=* ]]; then
		t="${t#*=}"
	elif [[ "$t" == -* ]]; then
		return 1
	fi
	is_secret_env_path "$t" && return 0
	if [[ "$t" == *[*?[]* ]]; then
		glob_reaches_env_file "$t" && return 0
	fi
	return 1
}

deny() {
	hook_deny "$DENY_MSG"
	exit 0
}

TOOL=$(hook_input tool_name)

# _tool_is <claude-name...> -- 0 when TOOL is one of the names, in Claude's
# spelling or this host's (Copilot hook input normally carries Claude's).
_tool_is() {
	local n host
	for n in "$@"; do
		[ "$TOOL" = "$n" ] && return 0
		if host=$(hook_tool_name "$n"); then
			[ "$TOOL" = "$host" ] && return 0
		fi
	done
	return 1
}

# --- File tools ------------------------------------------------------------
if _tool_is Read Write Edit MultiEdit; then
	path=$(hook_input tool_input.file_path)
	[ -n "$path" ] && is_secret_env_path "$path" && deny
	exit 0
fi

if _tool_is NotebookEdit; then
	path=$(hook_input tool_input.notebook_path)
	[ -n "$path" ] && is_secret_env_path "$path" && deny
	exit 0
fi

if _tool_is Grep; then
	path=$(hook_input tool_input.path)
	[ -n "$path" ] && is_secret_env_path "$path" && deny
	glob=$(hook_input tool_input.glob)
	[ -n "$glob" ] && glob_reaches_env_file "$glob" && deny
	exit 0
fi

_tool_is Bash || exit 0

# --- Bash ------------------------------------------------------------------
COMMAND=$(hook_input tool_input.command)
[ -z "$COMMAND" ] && exit 0

# Cheap early-out: every env-file name and direnv contain "env" or "vars".
[[ "$COMMAND" == *env* || "$COMMAND" == *vars* ]] || exit 0

# Pass 1: drop heredoc bodies (the intro line stays, so `cat > .envrc <<EOF`
# is still judged by its redirect). Same state machine as repos-bash-guard.sh.
SCAN=$(printf '%s' "$COMMAND" | awk '
	BEGIN { in_heredoc = 0 }
	{
		line = $0
		if (in_heredoc) {
			cmp = line
			if (strip_tabs) sub(/^\t+/, "", cmp)
			if (cmp == delim) { in_heredoc = 0 }
			next
		}
		scanline = line
		gsub(/<<</, "@@@", scanline)
		if (match(scanline, /<<-?[ \t]*[\047\"]?[A-Za-z_][A-Za-z0-9_]*[\047\"]?/)) {
			frag = substr(scanline, RSTART, RLENGTH)
			strip_tabs = (frag ~ /^<<-/)
			word = frag
			sub(/^<<-?[ \t]*/, "", word)
			sub(/^[\047\"]/, "", word)
			sub(/[\047\"]$/, "", word)
			delim = word
			in_heredoc = 1
		}
		print line
	}
')

# Pass 2: drop quoted strings that contain whitespace (prose), keeping a
# whitespace-free quoted path such as ".envrc". A character walk pairs each
# quote with the one that really closes it, so the text BETWEEN two strings
# (`printf "%s\n" ok; cat .envrc; echo "all done"`) is never taken for a
# string. Double quotes and $'...' honour backslash escapes, single quotes do
# not, and an unclosed string is kept as it is.
_strip_quoted_prose() {
	awk '
		{ buf = buf (NR > 1 ? "\n" : "") $0 }
		END {
			n = length(buf); out = ""; span = ""; q = ""; esc = 0
			for (i = 1; i <= n; i++) {
				c = substr(buf, i, 1)
				if (q == "") {
					if (c == "\\") { out = out c substr(buf, i + 1, 1); i++; continue }
					if (c == "\"" || c == "\047") {
						q = c; esc = (c == "\"")
						if (c == "\047" && substr(out, length(out), 1) == "$") esc = 1
						span = c; continue
					}
					out = out c; continue
				}
				span = span c
				if (esc && c == "\\") { span = span substr(buf, i + 1, 1); i++; continue }
				if (c == q) {
					if (span !~ /[ \t\n]/) out = out span
					q = ""; span = ""
				}
			}
			printf "%s", out span
		}
	'
}
SCAN=$(printf '%s' "$SCAN" | _strip_quoted_prose)

# The splitter cuts at every `|`, which would separate the clobber redirect
# `>|` from its target; spell it as a plain `>` first.
SCAN="${SCAN//>|/> }"

# Commands that read (or copy, or write) the file named by an argument.
READERS=" cat tac head tail less more most bat batcat nl sed awk gawk mawk grep egrep fgrep rg ag xxd hexdump od strings base64 cut sort uniq diff cmp paste rev fold cp mv tee source . vi vim nvim nano emacs ed "

# Commands whose bare form prints the environment.
ENV_DUMPERS=" env printenv export set declare typeset compgen "

# _segment_denied <segment> -- 0 when the segment reads or writes an env file.
_segment_denied() {
	local seg cmd i tok next
	seg="$(hook_peel_segment_prefix "$1")"
	local -a tokens=()
	read -ra tokens <<<"$seg" || true
	[ "${#tokens[@]}" -eq 0 ] && return 1

	# Redirects anywhere in the segment: `<`, `>`, `>>`, `>|`, `&>`, with the
	# target glued on or in the next token, and the operator anywhere in its
	# token (`echo X>.env`, `cat<.envrc`). `<<`/`<<<` are heredocs and
	# here-strings, `<(` a process substitution, `>&N` a descriptor: never a
	# file.
	for i in "${!tokens[@]}"; do
		tok="${tokens[$i]}"
		if [[ "$tok" =~ (\<|\>\>|\>\||\>)([^\<\>]*)$ ]] && [[ "$tok" != *'<<'* ]] && [[ "$tok" != *'<('* ]]; then
			next="${BASH_REMATCH[2]}"
			next="${next#|}"
			[[ "$next" == '&'* ]] && continue
			if [ -z "$next" ]; then
				next="${tokens[$((i + 1))]:-}"
			fi
			[ -n "$next" ] && is_secret_env_path "$next" && return 0
		fi
	done

	cmd="$(_strip_token "${tokens[0]}")"
	cmd="${cmd##*/}"

	if [ "$cmd" = direnv ]; then
		case "${tokens[1]:-}" in
			export | dump | show_dump) return 0 ;;
			exec)
				# direnv exec <dir> <cmd...>: judge <cmd> on its own.
				local inner="${tokens[*]:3}" inner_cmd
				[ -z "$inner" ] && return 1
				inner_cmd="$(hook_peel_segment_prefix "$inner")"
				read -r inner_cmd _ <<<"$inner_cmd" || true
				inner_cmd="${inner_cmd##*/}"
				# A bare `env` (no command after it) prints the environment;
				# `env FOO=1 pnpm build` peels down to the real command.
				[ -z "$inner_cmd" ] && return 0
				[[ "$ENV_DUMPERS" == *" $inner_cmd "* ]] && return 0
				_segment_denied "$inner" && return 0
				return 1
				;;
		esac
		return 1
	fi

	[[ "$READERS" == *" $cmd "* ]] || return 1
	for tok in "${tokens[@]:1}"; do
		_arg_hits_env_file "$tok" && return 0
	done
	return 1
}

HOOK_CMD_SEGMENTS=()
hook_split_segments "$SCAN"

for _segment in "${HOOK_CMD_SEGMENTS[@]}"; do
	if _segment_denied "$_segment"; then
		deny
	fi
done

exit 0
