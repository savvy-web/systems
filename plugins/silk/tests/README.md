# Silk plugin hook tests

BATS coverage and a `shellcheck` pass for the hook scripts under
`plugins/silk/hooks/`. This directory is the canonical harness — new silk hooks
get a suite here, and shared conventions live in `test_helper.bash`.

## Running

From the repo root:

```bash
pnpm test:hooks
```

That runs `plugins/silk/tests/run-hook-tests.sh`, which:

1. Runs `shellcheck` over every shell entry script under `hooks/`, `bin/`, and
   `tests/`, plus the `tests/*.bash` helpers.
2. Runs `bats` over every `tests/*.bats` suite.

Requirements: `bats`, `shellcheck`, `jq`, `git`, and Node.js `24.11.0+` on
`PATH`.

```bash
# macOS
brew install bats-core shellcheck jq
brew install node@24

# Debian / Ubuntu
sudo apt-get install -y bats shellcheck jq git
# Install Node.js 24.11.0+ with your preferred toolchain manager.
```

Run a single suite directly with `bats`:

```bash
bats plugins/silk/tests/pre-tool-use-commit-mcp.bats
```

CI runs the same script via `.github/workflows/hook-tests.yml` (a dedicated
job with shell tooling and Node.js `24.11.0` setup).

## Layout

```text
plugins/silk/
  hooks/
    <event>/<hook-name>.sh     # the hook scripts under test
    lib/*.sh                   # shared helpers (sourced, not standalone)
    fixtures/<event>.<scenario>.json
  tests/
    test_helper.bash           # shared setup + helpers (load 'test_helper')
    <event>-<hook-name>.bats   # one suite per hook
    run-hook-tests.sh          # entry point (shellcheck + bats)
```

Suite files are named `<event>-<hook-name>.bats`, mirroring the hook's path —
e.g. `hooks/pre-tool-use/commit-mcp.sh` is tested by
`tests/pre-tool-use-commit-mcp.bats`.

## Fixtures

Hook input envelopes live in `hooks/fixtures/`, named
`<event>.<scenario>.json` where `<event>` is the lower-cased hook event:

| Event | Prefix |
| --- | --- |
| PreToolUse | `pretooluse.` |
| PostToolUse | `posttooluse.` |
| SessionStart | `sessionstart.` |

Examples: `pretooluse.mcp-gk-read.json`, `posttooluse.changeset-file.json`,
`sessionstart.orientation.json`. Keep each fixture minimal — include only the
envelope fields the hook reads (`tool_name`, `tool_input.command`,
`tool_input.file_path`, `session_id`, `cwd`, `tool_response.interrupted`, ...).
Fixtures are tab-indented JSON to match the repo's Biome style.

When a scenario differs from a fixture by a single field (a command string, an
absolute path), derive it in the test with `jq` rather than adding a near-
duplicate fixture:

```bash
jq --arg c "pnpm biome check" '.tool_input.command = $c' \
  "${FIXTURES_DIR}/pretooluse.bash-safe.json" > "$envelope"
```

## Test helper

Every suite starts with:

```bash
load 'test_helper'

setup() {
 common_setup
}
```

`common_setup` provides two guarantees:

- **HOME isolation.** `HOME` is repointed at `${BATS_TEST_TMPDIR}/home` so hooks
  that write the per-session env file / nudge markers under `~/.claude/` — and
  the hook debug/error logs — never touch the real developer home.
- **Env sanitization.** Any leaked `SILK_*` / `CLAUDE_*` variables are unset.
  This matters because running `bats` from inside a live silk-plugin Claude Code
  session inherits `SILK_PACKAGE_MANAGER`, `SILK_PROJECT_DIR`, etc. from that
  session's SessionStart hook. Left in place, a hook under test would resolve the
  developer's real package manager and shell out to the workspace's real
  `savvy` CLI instead of the isolated fixtures.

It also exposes these paths: `PLUGIN_ROOT`, `HOOKS_DIR`, `FIXTURES_DIR`.

Helpers for hooks that shell out or need a repo:

| Helper | Purpose |
| --- | --- |
| `make_project` | Create an empty throwaway project dir and export `CLAUDE_PROJECT_DIR` to it (no lockfile → npm runner). |
| `force_npm_runner` | Pin package-manager resolution to npm so CLI shell-outs become `npx --no -- ...`. |
| `use_stub_bin` | Prepend a per-test stub dir to `PATH`. Real tools still resolve (prepend only). |
| `write_stub <name>` | Install an executable stub reading its body from stdin. |
| `init_push_repo` | Create a git repo with a committed `main` and a checked-out `feature` branch; export `CLAUDE_PROJECT_DIR`. |
| `repo_commit <repo> <msg> <path> [content]` | Write and commit a file on the current branch. |
| `add_worktree <repo> <branch>` | Add a git worktree on a new branch; `CLAUDE_PROJECT_DIR` deliberately stays on the primary checkout. |
| `envelope_with_cwd <fixture> [dir]` | Copy a fixture, substituting its `__PROJECT_DIR__` cwd token with `[dir]` (default `$CLAUDE_PROJECT_DIR`); echo the copy's path. |
| `envelope_without_cwd <fixture>` | Copy a fixture with `.cwd` deleted; echo the copy's path. Exercises the env-var fallback legs of `resolve_project_dir`. |

### Project-dir resolution in fixtures

Every hook that reasons about a working tree resolves it through
`resolve_project_dir` (`hooks/lib/hook-env.sh`), where the envelope's `.cwd`
**outranks** `CLAUDE_PROJECT_DIR` (savvy-web/systems#274). A fixture therefore
cannot bake in a real cwd — the project dir is a fresh `$BATS_TEST_TMPDIR` tree
per test, and a stale literal would silently win over the dir the test just
built. The SessionStart fixtures (`sessionstart.orientation.json`,
`sessionstart.startup.json`) carry a literal `__PROJECT_DIR__` token instead;
substitute it with `envelope_with_cwd` (or drop the field with
`envelope_without_cwd` to test the fallback):

```bash
make_project >/dev/null
local envelope
envelope="$(envelope_with_cwd "${FIXTURES_DIR}/sessionstart.orientation.json")"
run bash -c "cat '${envelope}' | bash '${HOOK}'"
```

This is the same placeholder pattern the repos-fs-guard deny fixtures use for
`tool_input.file_path` (below), applied to `.cwd`.

### Stubbing the savvy CLI

Hooks that shell out to `savvy` (the commit hooks and the changeset validator)
are tested against a stub, never the real CLI. Pin the runner and install a fake
`npx`:

```bash
make_project >/dev/null
force_npm_runner
use_stub_bin
write_stub npx <<'STUB'
#!/usr/bin/env bash
cat >/dev/null 2>&1 || true
printf 'CLI-RAN\n'
exit 0
STUB
```

The hook resolves its runner to `npx --no -- savvy ...`, which lands on the
stub. Vary the stub's exit code and output to exercise the allow / deny /
context / fail-open paths.

## What each suite covers

| Suite | Hook |
| --- | --- |
| `lib-match-safe-bash.bats` | `lib/match-safe-bash.sh` |
| `pre-tool-use-biome-prefer-mcp.bats` | `pre-tool-use/biome-prefer-mcp.sh` |
| `pre-tool-use-biome-direct-deny.bats` | `pre-tool-use/biome-direct-deny.sh` |
| `pre-tool-use-commit-bash.bats` | `pre-tool-use/commit-bash.sh` |
| `pre-tool-use-commit-mcp.bats` | `pre-tool-use/commit-mcp.sh` |
| `pre-tool-use-commit-fs.bats` | `pre-tool-use/commit-fs.sh` |
| `skill-commit-create-validate-message.bats` | `skills/commit-create/scripts/validate-message.sh` |
| `post-tool-use-commit-bash.bats` | `post-tool-use/commit-bash.sh` |
| `post-tool-use-changeset-validate-changeset.bats` | `post-tool-use/changeset-validate-changeset.sh` |
| `pre-tool-use-repos-fs-guard.bats` | `pre-tool-use/repos-fs-guard.sh` |
| `pre-tool-use-repos-bash-guard.bats` | `pre-tool-use/repos-bash-guard.sh` |
| `pre-tool-use-repos-mcp-guard.bats` | `pre-tool-use/repos-mcp-guard.sh` |
| `pre-tool-use-dogfood-guard.bats` | `pre-tool-use/dogfood-guard.sh` |
| `skill-dogfood-journal-append.bats` | `skills/dogfood/scripts/journal-append.sh` |
| `session-start-orientation.bats` | `session-start/orientation.sh` |
| `session-start-repos-orientation.bats` | `session-start/repos-orientation.sh` |
| `session-start-startup-only.bats` | `session-start/startup-only.sh` |
| `stop-changeset-nudge.bats` | `stop/changeset-nudge.sh` |
| `monitor-dogfood-mail.bats` | `monitors/dogfood-mail.mjs` (not a hook — the fs-only dogfood mail/journal monitor; covered here rather than a separate harness since bats already isolates `CLAUDE_PROJECT_DIR` per test) |

Each suite exercises the real contract: an envelope on stdin, JSON decision /
`additionalContext` and exit code on stdout, across the allow / deny / context
paths, the "not applicable, exit 0 silently" paths, and malformed input.

## Deny-path fixture pattern

`pre-tool-use-repos-fs-guard.bats` is the first suite to exercise
`emit_deny` (`hooks/lib/hook-output.sh`) — copy from it when adding
coverage for a new deny hook. `pre-tool-use-repos-bash-guard.bats` and
`pre-tool-use-repos-mcp-guard.bats` (savvy-web/systems#285) are the next
callers. Two things about it that don't come up in the allow / no-op suites
above:

1. **Placeholder-project fixtures for absolute-path scenarios.** A fixture
   that needs to assert on an absolute path under the project root can't bake
   in a real path — the project dir is a fresh `$BATS_TEST_TMPDIR` tree per
   test. Write the fixture with a literal `__PROJECT_DIR__` token in
   `tool_input.file_path` / `tool_input.notebook_path`
   (`hooks/fixtures/pretooluse.repos-fs-deny.json`,
   `pretooluse.repos-fs-notebook.json`), then have the test substitute it with
   `jq`'s `gsub` before piping the envelope to the hook. Relative-path
   scenarios don't need this — they resolve against `CLAUDE_PROJECT_DIR`
   inside the hook, so the fixture can stay a plain relative path
   (`pretooluse.repos-fs-outside.json`, `pretooluse.repos-fs-config-allow.json`).
2. **`make_project`'s export only lands in the current shell, never a command
   substitution.** `make_project` both `export`s `CLAUDE_PROJECT_DIR` in the
   caller's shell AND echoes the path — but `project="$(make_project)"` runs
   the function in a subshell, so the `export` never reaches the test
   process; only the echoed path is captured, and `CLAUDE_PROJECT_DIR` is
   left unset. Call `make_project >/dev/null` on its own line, then read
   `$CLAUDE_PROJECT_DIR` back, exactly like the existing `make_git_project`
   comment in `skill-commit-create-commit.bats` documents.

Assert both the `permissionDecision: "deny"` value and that
`permissionDecisionReason` names the sanctioned mutation path (e.g.
`repos_manage` / `savvy repos`) — a deny with no actionable reason just
frustrates the agent it blocked.

## Adding a suite for a new hook

1. Add fixtures in `hooks/fixtures/` named `<event>.<scenario>.json`.
2. Create `tests/<event>-<hook-name>.bats` that `load 'test_helper'` and calls
   `common_setup` in `setup()`.
3. Cover every branch: each decision path, the silent no-op paths, and
   malformed input. Assert exit code and exact stdout (`{}` for a no-op).
4. If the hook shells out to the savvy CLI, stub it (see above) — never let a
   test invoke the real CLI or write outside `$HOME` / `$BATS_TEST_TMPDIR`.
5. Run `pnpm test:hooks` and confirm both the shellcheck pass and the new suite
   are green.

## Hook script file modes

Hook scripts commit as `100644` (no exec bit) on purpose. The lint-staged
ShellScripts handler strips the executable bit from staged `.sh` files
(`chmod -x`), so a freshly added hook that starts life as `755` lands in the
commit as `644` while older siblings may still show `755` from before the
handler existed. This is not mode drift and needs no fix: every hook is
invoked as `bash "${CLAUDE_PLUGIN_ROOT}/hooks/..."` (see `hooks/hooks.json`
and `run-hook-tests.sh`), so the exec bit is never exercised, and normalizing
it keeps diffs clean. Do not chmod hook scripts back to `755` or exclude them
from the handler.

## shellcheck strategy

`run-hook-tests.sh` passes only shebang-bearing scripts to `shellcheck` as
top-level inputs and runs with `-x -P SCRIPTDIR`. The sourced-only libraries
(`hooks/lib/hook-output.sh`, `hook-debug.sh`, `hook-env.sh`,
`source-session-env.sh`) carry no shebang; they are validated in context via
follow-source from the scripts that source them, which also avoids the spurious
`SC2148` they raise when linted standalone. `-P SCRIPTDIR` resolves each
`# shellcheck source=` directive relative to the sourcing script's own directory.

`hook-env.sh` is the shared home for envelope and environment resolution —
`read_envelope_or_noop`, `resolve_project_dir`, `detect_package_manager`,
`package_manager_exec`. Put a new shared helper there (or in another
sourced-only lib) rather than in a hook: a private copy in one hook is how the
two SessionStart hooks' package-manager detection drifted apart in the first
place. A helper added there needs **no** change to the shellcheck invocation —
it is linted through its consumers' `# shellcheck source=` directives. A new
sourced-only lib file likewise needs no shebang and no runner change; only a
new *standalone* entry script (shebang + `set -euo pipefail`, like
`lib/run-cli.sh`) becomes a top-level shellcheck input.

## Known gaps

- **Malformed input.** Every jq-parsing hook sources `hook-env.sh` and calls
  `read_envelope_or_noop` before touching the envelope, so invalid or empty
  JSON on stdin fails open — a silent no-op (`{}`), not a jq parse-error abort.
  `read_envelope_or_noop` (PR #276) retrofitted this fail-open behavior across
  every jq-parsing hook that existed at the time; the three
  `repos-*-guard.sh` hooks (savvy-web/systems#285/#286) — the first real
  callers of `emit_deny` — were written against it from the start, so the
  posture is uniform across old and new hooks alike. Each suite's
  `malformed JSON input: no-op (fails open)` case asserts this directly.
  `session-start/startup-only.sh` remains the one true exception: it does not
  call `read_envelope_or_noop`, because its payload is unconditional session
  orientation rather than a decision about a tool call. It reads the body only
  through `resolve_project_dir`, whose jq call is guarded, so a malformed
  envelope degrades to the `CLAUDE_PROJECT_DIR` fallback and the context is
  still emitted. Its suite asserts that (`malformed body with a project dir:
  still emits context`) rather than a no-op.
