#!/usr/bin/env bats
# __test__/session-start-env.bats
#
# Coverage for silk's session variables (pluginfinity.config.ts `env`):
# SILK_PACKAGE_MANAGER and SILK_SKIP_CHANGESET_NUDGE, both defaulting to "".
#
# The PRODUCER is the generated SessionStart runner, lib/pluginfinity/env-run.sh,
# which pluginfinity adds as the first SessionStart entry. It runs
# scripts/env-setup.sh from the project (detect_package_manager, shared with
# startup-only.sh through hooks/lib/silk/hook-env.sh), applies the project's
# .env/.env.local and the ambient environment, writes the session values file,
# points the project at the session and, on Claude Code only, appends the
# exports to CLAUDE_ENV_FILE. This replaces orientation.sh's hand-rolled
# ~/.claude/session-env/<id>/silk-hook.sh file.
#
# The READERS are every hook (the hook library applies the session values
# before the body) and the changeset skill's list.sh (which sources env.sh).
# Reader tests seed the values with --session-env, or run the runner first.

load common

RUNNER="lib/pluginfinity/env-run.sh"

silk_file_setup() {
	common_setup
}

# values_file <session id> — the session values file the runner writes.
values_file() {
	printf '%s' "${XDG_STATE_HOME}/pluginfinity/silk/session/$1/env"
}

# run_runner [cwd] — run the env runner on the orientation fixture (session
# sess-orient-1) with .cwd set to [cwd] (default: CLAUDE_PROJECT_DIR).
run_runner() {
	local envelope
	envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json" "${1:-${CLAUDE_PROJECT_DIR:-}}")"
	silk_run "$RUNNER" "$envelope"
}

# --- the producer: env-run.sh + scripts/env-setup.sh ------------------------

@test "runner: detects pnpm from package.json, writes the values file, prints nothing" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	printf '{"packageManager":"pnpm@9.0.0"}\n' > "${CLAUDE_PROJECT_DIR}/package.json"
	run_runner
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	local values
	values="$(values_file sess-orient-1)"
	[ "$(cat "$values")" = $'SILK_PACKAGE_MANAGER=pnpm\nSILK_SKIP_CHANGESET_NUDGE=' ]
	# Only the declared names: no SILK_PROJECT_DIR, SILK_PLUGIN_ROOT,
	# SILK_SESSION_ID or SILK_DATA_DIR.
	! grep -q 'SILK_PROJECT_DIR\|SILK_PLUGIN_ROOT\|SILK_SESSION_ID\|SILK_DATA_DIR' "$values"
	done
}

@test "runner: detects yarn from a lockfile when package.json declares no packageManager" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	printf '{"name":"x"}\n' > "${CLAUDE_PROJECT_DIR}/package.json"
	: > "${CLAUDE_PROJECT_DIR}/yarn.lock"
	run_runner
	[ "$status" -eq 0 ]
	grep -qx 'SILK_PACKAGE_MANAGER=yarn' "$(values_file sess-orient-1)"
	done
}

# savvy-web/systems#274: the envelope's cwd follows a git worktree;
# CLAUDE_PROJECT_DIR is pinned to the primary checkout for the whole session.
# Setup runs in the event's cwd walked to .git, so the worktree's package
# manager is the session's, not the primary checkout's.
@test "runner: envelope cwd outranks CLAUDE_PROJECT_DIR (worktree doctrine)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local primary worktree
	primary="$(init_push_repo)"
	worktree="$(add_worktree "$primary" wt-orient)"
	printf '{"packageManager":"yarn@4.0.0"}\n' > "${primary}/package.json"
	printf '{"packageManager":"pnpm@9.0.0"}\n' > "${worktree}/package.json"
	export CLAUDE_PROJECT_DIR="$primary"
	run_runner "$worktree"
	[ "$status" -eq 0 ]
	grep -qx 'SILK_PACKAGE_MANAGER=pnpm' "$(values_file sess-orient-1)"
	done
}

@test "runner: no cwd in the envelope falls back to CLAUDE_PROJECT_DIR on Claude; no project on Copilot" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	local proj="${SILK_TMP}/fallback-proj"
	mkdir -p "$proj"
	git -C "$proj" init -q -b main
	printf '{"packageManager":"bun@1.1.0"}\n' > "${proj}/package.json"
	local envelope
	envelope="$(envelope_without_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
	if [ "$SILK_TARGET" = claude ]; then
		export CLAUDE_PROJECT_DIR="$proj"
		silk_run "$RUNNER" "$envelope"
		[ "$status" -eq 0 ]
		grep -qx 'SILK_PACKAGE_MANAGER=bun' "$(values_file sess-orient-1)"
	else
		# Copilot never sets CLAUDE_PROJECT_DIR and runs hooks from the plugin
		# root, so a cwd-less event has no project: setup is skipped and the
		# default "" stands, which every reader detects past.
		unset CLAUDE_PROJECT_DIR
		silk_run "$RUNNER" "$envelope"
		[ "$status" -eq 0 ]
		grep -qx 'SILK_PACKAGE_MANAGER=' "$(values_file sess-orient-1)"
		grep -q 'env: the event has no cwd' "$SILK_ERROR_LOG"
	fi
	done
}

# A cwd that no longer exists (stale envelope, deleted worktree): setup cannot
# enter it, so the value keeps its "" default, the runner still exits 0 and
# writes nothing to stdout, and readers detect for themselves (npm).
@test "runner: nonexistent project dir keeps the empty default and fails open" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	run_runner "${SILK_TMP}/gone"
	[ "$status" -eq 0 ]
	[ -z "$output" ]
	grep -qx 'SILK_PACKAGE_MANAGER=' "$(values_file sess-orient-1)"
	done
}

@test "runner: a project .env outranks detection, the ambient environment outranks .env" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	printf '{"packageManager":"pnpm@9.0.0"}\n' > "${CLAUDE_PROJECT_DIR}/package.json"
	printf 'SILK_PACKAGE_MANAGER=yarn\nSILK_SKIP_CHANGESET_NUDGE=1\n' > "${CLAUDE_PROJECT_DIR}/.env"
	run_runner
	[ "$status" -eq 0 ]
	[ "$(cat "$(values_file sess-orient-1)")" = $'SILK_PACKAGE_MANAGER=yarn\nSILK_SKIP_CHANGESET_NUDGE=1' ]
	export SILK_PACKAGE_MANAGER=bun
	run_runner
	[ "$status" -eq 0 ]
	grep -qx 'SILK_PACKAGE_MANAGER=bun' "$(values_file sess-orient-1)"
	done
}

@test "runner: appends the declared exports to CLAUDE_ENV_FILE on Claude only" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	printf '{"packageManager":"pnpm@9.0.0"}\n' > "${CLAUDE_PROJECT_DIR}/package.json"
	export CLAUDE_ENV_FILE="${SILK_TMP}/claude-env.sh"
	: > "$CLAUDE_ENV_FILE"
	run_runner
	[ "$status" -eq 0 ]
	if [ "$SILK_TARGET" = claude ]; then
		grep -qx "export SILK_PACKAGE_MANAGER='pnpm'" "$CLAUDE_ENV_FILE"
		grep -qx "export SILK_SKIP_CHANGESET_NUDGE=''" "$CLAUDE_ENV_FILE"
		# SILK_PROJECT_DIR must never reach the model's shell: it is an explicit
		# override for the skill scripts (resolve-cli-project-dir.sh rule 2).
		! grep -q 'SILK_PROJECT_DIR\|SILK_PLUGIN_ROOT\|SILK_SESSION_ID\|SILK_DATA_DIR' "$CLAUDE_ENV_FILE"
	else
		# Copilot has no env channel to the model's shell (env-shell-unsupported).
		[ ! -s "$CLAUDE_ENV_FILE" ]
	fi
	done
}

# --- the readers ------------------------------------------------------------

# Stub a package-manager runner <pm> as a savvy simulator whose validate-file
# run prints "<pm> validated"; --version succeeds.
_stub_pm_savvy() {
	use_stub_bin
	write_stub "$1" <<STUB
#!/usr/bin/env bash
for a in "\$@"; do
	case "\$a" in
		--version) exit 0 ;;
		validate-file) printf '%s validated\n' "$1"; exit 1 ;;
	esac
done
exit 0
STUB
}

@test "reader hook: changeset-validate-changeset takes SILK_PACKAGE_MANAGER from the session" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	# No lockfile: live detection would say npm. Only the session says yarn.
	_stub_pm_savvy yarn
	local seed="${SILK_TMP}/seed.env"
	printf 'SILK_PACKAGE_MANAGER=yarn\n' > "$seed"
	silk_run "hooks/post-tool-use/changeset-validate-changeset.sh" \
		"${FIXTURES_DIR}/posttooluse.changeset-file.json" --session-env "$seed"
	[ "$status" -eq 0 ]
	[[ "$(_context)" == *"yarn validated"* ]]
	done
}

@test "reader hook: changeset-validate-changeset detects for itself when the session value is empty" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	: > "${CLAUDE_PROJECT_DIR}/pnpm-lock.yaml"
	_stub_pm_savvy pnpm
	local seed="${SILK_TMP}/seed.env"
	printf 'SILK_PACKAGE_MANAGER=\n' > "$seed"
	silk_run "hooks/post-tool-use/changeset-validate-changeset.sh" \
		"${FIXTURES_DIR}/posttooluse.changeset-file.json" --session-env "$seed"
	[ "$status" -eq 0 ]
	[[ "$(_context)" == *"pnpm validated"* ]]
	done
}

@test "reader hook: SILK_SKIP_CHANGESET_NUDGE from the session silences the Stop nudge" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	local envelope="${SILK_TMP}/stop.json"
	jq --arg d "$CLAUDE_PROJECT_DIR" '.cwd = $d' "${FIXTURES_DIR}/stop.changeset-nudge.json" > "$envelope"
	# Control: unseeded, the nudge speaks (Claude Code; Copilot ignores Stop
	# systemMessage and answers {}).
	silk_run "hooks/stop/changeset-nudge.sh" "$envelope"
	[ "$status" -eq 0 ]
	if [ "$SILK_TARGET" = claude ]; then
		[ -n "$(jq -r '.systemMessage // empty' <<<"$output")" ]
		# The debounce marker would silence the next run on its own: clear it.
		rm -rf "${HOME}/.claude/session-env"
	fi
	local seed="${SILK_TMP}/seed.env"
	printf 'SILK_SKIP_CHANGESET_NUDGE=1\n' > "$seed"
	silk_run "hooks/stop/changeset-nudge.sh" "$envelope" --session-env "$seed"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

@test "reader hook: a project .env SILK_SKIP_CHANGESET_NUDGE=1 silences the nudge with no session values" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	init_push_repo >/dev/null
	repo_commit "$CLAUDE_PROJECT_DIR" "feat: work" src/a.ts
	printf 'SILK_SKIP_CHANGESET_NUDGE=1\n' > "${CLAUDE_PROJECT_DIR}/.env"
	local envelope="${SILK_TMP}/stop.json"
	jq --arg d "$CLAUDE_PROJECT_DIR" '.cwd = $d' "${FIXTURES_DIR}/stop.changeset-nudge.json" > "$envelope"
	silk_run "hooks/stop/changeset-nudge.sh" "$envelope"
	[ "$status" -eq 0 ]
	[ "$output" = "{}" ]
	done
}

# Stub `pnpm` as a changesets CLI: --version succeeds, `status --output=<f>`
# writes JSON naming the runner.
_stub_pnpm_changeset() {
	use_stub_bin
	write_stub pnpm <<'STUB'
#!/usr/bin/env bash
for a in "$@"; do
	case "$a" in
		--version) exit 0 ;;
		--output=*) printf '{"changesets":[],"releases":[],"via":"pnpm"}\n' > "${a#--output=}"; exit 0 ;;
	esac
done
exit 0
STUB
}

@test "skill script: list.sh takes SILK_PACKAGE_MANAGER from a seeded session" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	mkdir -p "${CLAUDE_PROJECT_DIR}/.changeset"
	_stub_pnpm_changeset
	cd "$CLAUDE_PROJECT_DIR"
	local seed="${SILK_TMP}/seed.env"
	printf 'SILK_PACKAGE_MANAGER=pnpm\n' > "$seed"
	# No lockfile: without the session value list.sh would pick npx.
	silk_script skills/changeset/scripts/list.sh --session-env "$seed"
	[ "$status" -eq 0 ]
	[ "$(jq -r .via <<<"$output")" = pnpm ]
	done
}

@test "skill script: list.sh finds the runner's session through the project pointer" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	mkdir -p "${CLAUDE_PROJECT_DIR}/.changeset"
	_stub_pnpm_changeset
	# The runner resolves pnpm from the ambient environment (rung 5); the
	# script then runs with no SILK_* at all, so only the session can say pnpm.
	export SILK_PACKAGE_MANAGER=pnpm
	run_runner
	[ "$status" -eq 0 ]
	unset SILK_PACKAGE_MANAGER
	cd "$CLAUDE_PROJECT_DIR"
	silk_script skills/changeset/scripts/list.sh
	[ "$status" -eq 0 ]
	[ "$(jq -r .via <<<"$output")" = pnpm ]
	done
}

@test "skill script: list.sh with no session and no lockfile falls back to npm (control)" {
	for SILK_TARGET in $SILK_TARGETS; do
	silk_setup "$SILK_TARGET"
	make_repo_project >/dev/null
	mkdir -p "${CLAUDE_PROJECT_DIR}/.changeset"
	_stub_pnpm_changeset
	write_stub npx <<'STUB'
#!/usr/bin/env bash
exit 1
STUB
	cd "$CLAUDE_PROJECT_DIR"
	silk_script skills/changeset/scripts/list.sh
	# The npm runner (npx, stubbed to fail) cannot find the CLI: the pnpm stub
	# above was never chosen.
	[ "$status" -eq 1 ]
	[[ "$stderr" == *"@changesets/cli is not installed"* ]]
	done
}
