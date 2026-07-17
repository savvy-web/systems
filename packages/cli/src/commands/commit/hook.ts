/**
 * `savvy commit hook` parent command — internal CLI surface used by the
 * commitlint plugin's bash hooks.
 *
 * @internal
 */
import { Command } from "effect/unstable/cli";
import { postCommitVerifyCommand } from "./hooks/post-commit-verify.js";
import { preCommitMessageCommand } from "./hooks/pre-commit-message.js";
import { sessionStartCommand } from "./hooks/session-start.js";

export const hookCommand = Command.make("hook")
	.pipe(Command.withSubcommands([sessionStartCommand, preCommitMessageCommand, postCommitVerifyCommand]))
	.pipe(Command.withDescription("Internal hook handlers used by the @savvy-web/commitlint plugin"));
