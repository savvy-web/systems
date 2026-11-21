#!/usr/bin/env bats
# __test__/pre-tool-use-env-file-guard.bats
#
# Coverage for hooks/pre-tool-use/env-file-guard.sh (savvy-web/systems#794):
# deny agents reading or writing the real environment files (.envrc, .env,
# .env.*, .dev.vars), through the file tools and through Bash readers,
# redirects and `direnv exec <dir> env`. Every *.example twin reads and writes
# normally, and `direnv exec . <cmd>` still runs, so an agent can use a
# variable without seeing it.

load common

HOOK="hooks/pre-tool-use/env-file-guard.sh"
BASH_FIXTURE="${FIXTURES_DIR}/pretooluse.env-file-bash.json"

# _probe_bash <command> — run the hook on a Bash envelope carrying <command>.
_probe_bash() {
	local envelope="${SILK_TMP}/envelope-bash-$RANDOM.json"
	jq --arg cmd "$1" '.tool_input.command = $cmd' "$BASH_FIXTURE" >"$envelope"
	silk_run "$HOOK" "$envelope" --matcher Bash
}

# _probe_file <fixture> <key> <value> — run the hook on <fixture> with
# tool_input.<key> replaced by <value>. The script runs under two entries;
# silk_run without --matcher takes the first, the file-tool entry.
_probe_file() {
	local envelope="${SILK_TMP}/envelope-file-$RANDOM.json"
	jq --arg k "$2" --arg v "$3" '.tool_input[$k] = $v' "$1" >"$envelope"
	silk_run "$HOOK" "$envelope"
}

_assert_denied() {
	[ "$status" -eq 0 ] || { echo "status $status: $output" >&2; return 1; }
	[ "$(_decision)" = "deny" ] || { echo "expected deny, got: $output" >&2; return 1; }
	[[ "$(_reason)" == *"This file may hold secrets."* ]]
	[[ "$(_reason)" == *".envrc.example"* ]]
	[[ "$(_reason)" == *"op read"* ]]
}

_assert_allowed() {
	[ "$status" -eq 0 ] || { echo "status $status: $output" >&2; return 1; }
	[ -z "$(_decision)" ] || { echo "expected allow, got: $output" >&2; return 1; }
}

# --- File tools ------------------------------------------------------------

@test "Read .envrc: deny with the secrets message" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.env-file-read.json"
	_assert_denied
	done
}

@test "Read nested/.env.local, .dev.vars and an absolute .env: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local p
	for p in nested/.env.local .dev.vars /abs/project/.env apps/web/.env.production; do
		_probe_file "${FIXTURES_DIR}/pretooluse.env-file-read.json" file_path "$p"
		_assert_denied
	done
	done
}

@test "Write and Edit .envrc: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.env-file-write.json"
	_assert_denied
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.env-file-edit.json"
	_assert_denied
	done
}

@test "MultiEdit .env and NotebookEdit notebooks/.env: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local envelope="${SILK_TMP}/multiedit.json"
	jq '.tool_name = "MultiEdit" | .tool_input.file_path = ".env"' \
		"${FIXTURES_DIR}/pretooluse.env-file-edit.json" >"$envelope"
	silk_run "$HOOK" "$envelope"
	_assert_denied
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.env-file-notebook.json"
	_assert_denied
	done
}

@test "Read and Write the .example files: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.env-file-read-example.json"
	_assert_allowed
	[ -z "$output" ]
	local p
	for p in .envrc.example .env.example .dev.vars.example nested/.env.local.example; do
		_probe_file "${FIXTURES_DIR}/pretooluse.env-file-read.json" file_path "$p"
		_assert_allowed
		_probe_file "${FIXTURES_DIR}/pretooluse.env-file-write.json" file_path "$p"
		_assert_allowed
	done
	done
}

@test "unrelated files that only resemble an env file: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local p
	for p in environment.ts .envrcfoo src/env.ts .environment docs/envrc.md; do
		_probe_file "${FIXTURES_DIR}/pretooluse.env-file-read.json" file_path "$p"
		_assert_allowed
	done
	done
}

@test "Grep with path .envrc, or a glob reaching env files: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.env-file-grep.json"
	_assert_denied
	_probe_file "${FIXTURES_DIR}/pretooluse.env-file-grep.json" path "apps/web/.dev.vars"
	_assert_denied
	local g envelope
	for g in '.env*' '**/.envrc' '.env.{local,production}' '**/.dev.vars'; do
		envelope="${SILK_TMP}/grep-glob-$RANDOM.json"
		jq --arg g "$g" '.tool_input.path = "." | .tool_input.glob = $g' \
			"${FIXTURES_DIR}/pretooluse.env-file-grep.json" >"$envelope"
		silk_run "$HOOK" "$envelope"
		_assert_denied
	done
	done
}

@test "Grep with an .example glob, a source glob or a directory path: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local g envelope
	for g in '*.example' '.envrc.example' '*.ts' '*' '**/*.{ts,tsx}'; do
		envelope="${SILK_TMP}/grep-glob-$RANDOM.json"
		jq --arg g "$g" '.tool_input.path = "." | .tool_input.glob = $g' \
			"${FIXTURES_DIR}/pretooluse.env-file-grep.json" >"$envelope"
		silk_run "$HOOK" "$envelope"
		_assert_allowed
	done
	_probe_file "${FIXTURES_DIR}/pretooluse.env-file-grep.json" path "src"
	_assert_allowed
	done
}

# --- Bash ------------------------------------------------------------------

@test "Bash readers of a real env file: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local cmd
	while IFS= read -r cmd; do
		_probe_bash "$cmd"
		_assert_denied || { echo "command: $cmd" >&2; return 1; }
	done <<'EOF'
cat .envrc
head -5 .env
tail -n 3 .env.local
sed -n 1p .env.production
awk 1 .dev.vars
awk '{ print }' .dev.vars
grep TOKEN .envrc
rg TOKEN .envrc
less .envrc
source .envrc
. ./.envrc
cat ".envrc"
sudo cat /srv/app/.env
cat .env*
base64 .envrc
cp .envrc /tmp/x
ls && cat .envrc
git status; head .envrc | wc -l
while read -r l; do echo "$l"; done < .envrc
direnv exec . cat .envrc
EOF
	done
}

@test "Bash writes to a real env file: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local cmd
	while IFS= read -r cmd; do
		_probe_bash "$cmd"
		_assert_denied || { echo "command: $cmd" >&2; return 1; }
	done <<'EOF'
echo X >> .envrc
echo X >.env
printf 'A=1\n' > apps/web/.dev.vars
echo X | tee .env
echo X | tee -a .envrc
sed -i '' s/a/b/ .envrc
EOF
	done
}

@test "Bash redirect glued to the preceding word: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local cmd
	while IFS= read -r cmd; do
		_probe_bash "$cmd"
		_assert_denied || { echo "command: $cmd" >&2; return 1; }
	done <<'EOF'
echo X>.env
echo FOO=1>>.envrc
cat<.envrc
echo X>|.env.local
echo X&>.dev.vars
EOF
	done
}

@test "Bash quoted strings around a reader are paired correctly: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local cmd
	while IFS= read -r cmd; do
		_probe_bash "$cmd"
		_assert_denied || { echo "command: $cmd" >&2; return 1; }
	done <<'EOF'
printf "%s\n" ok; cat .envrc; echo "all done"
echo "x"; cat .envrc; echo "y z"
printf '%s\n' ok; cat .envrc; echo 'all done'
echo "it's"; cat .env; echo 'a "b" c'
EOF
	done
}

@test "Bash ordinary quoting and plain redirects: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local cmd
	while IFS= read -r cmd; do
		_probe_bash "$cmd"
		_assert_allowed || { echo "command: $cmd" >&2; return 1; }
		[ -z "$output" ] || { echo "command: $cmd, output: $output" >&2; return 1; }
	done <<'EOF'
echo "a b" > out.txt
git commit -m "fix .env docs"
echo 'see .envrc docs' >notes.txt
printf "%s\n" "cat .envrc is denied"; echo done
pnpm test 2>&1 | grep env
echo X>out.env.txt
EOF
	done
}

@test "Bash heredoc writing .envrc: deny (the redirect is on the intro line)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe_bash "$(printf 'cat > .envrc <<EOF\nexport A=1\nEOF')"
	_assert_denied
	done
}

@test "direnv exec <dir> env|printenv|export|set, and direnv export/dump: deny" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local cmd
	while IFS= read -r cmd; do
		_probe_bash "$cmd"
		_assert_denied || { echo "command: $cmd" >&2; return 1; }
	done <<'EOF'
direnv exec . env
direnv exec . printenv
direnv exec . printenv GITHUB_TOKEN
direnv exec /some/dir export
direnv exec . set
direnv exec . env | grep TOKEN
direnv export json
direnv dump
EOF
	done
}

@test "Bash on .example files, direnv exec of a real command, direnv allow/reload: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local cmd
	while IFS= read -r cmd; do
		_probe_bash "$cmd"
		_assert_allowed || { echo "command: $cmd" >&2; return 1; }
		[ -z "$output" ] || { echo "command: $cmd, output: $output" >&2; return 1; }
	done <<'EOF'
cat .envrc.example
cp .envrc.example docs/envrc-template.txt
diff .env.example .dev.vars.example
direnv exec . pnpm test
direnv exec . env FOO=1 pnpm build
direnv allow
direnv allow .
direnv reload
direnv status
gh issue comment 794 --body "do not cat .envrc"
git commit -m "docs: never source .envrc in hooks"
cat environment.ts
cat .envrcfoo
ls -la .envrc
test -f .envrc && echo present
rm -f .env.example.tmp
pnpm test
EOF
	done
}

@test "Bash heredoc body that mentions .envrc: allowed" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	_probe_bash "$(printf "cat > notes.md <<'EOF'\nNever cat .envrc or source .env.\nEOF")"
	_assert_allowed
	[ -z "$output" ]
	done
}

@test "the guard holds inside a subagent call" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local envelope="${SILK_TMP}/subagent.json"
	jq '.agent_id = "agent-1" | .agent_type = "general-purpose"' \
		"${FIXTURES_DIR}/pretooluse.env-file-read.json" >"$envelope"
	silk_run "$HOOK" "$envelope"
	_assert_denied
	done
}

@test "other tools: silent no-op" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	silk_run "$HOOK" "${FIXTURES_DIR}/pretooluse.dogfood-mcp-github-push-files.json"
	_assert_allowed
	[ -z "$output" ]
	done
}
