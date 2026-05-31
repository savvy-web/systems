/**
 * Helpers that build the JSON output the bash hooks pass through to Claude.
 *
 * @internal
 */

export type HookOutput = Record<string, unknown> | null;

export function preToolUseAllow(reason: string): HookOutput {
	return {
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			permissionDecision: "allow",
			permissionDecisionReason: reason,
		},
	};
}

export function preToolUseDeny(reason: string): HookOutput {
	return {
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			permissionDecision: "deny",
			permissionDecisionReason: reason,
		},
	};
}

export function preToolUseAdvise(message: string): HookOutput {
	return {
		hookSpecificOutput: {
			hookEventName: "PreToolUse",
			additionalContext: message,
		},
	};
}

export function preToolUseSilent(): HookOutput {
	return null;
}

export function sessionStartContext(message: string): HookOutput {
	return {
		hookSpecificOutput: {
			hookEventName: "SessionStart",
			additionalContext: message,
		},
	};
}

export function postToolUseAdvise(message: string): HookOutput {
	return {
		hookSpecificOutput: {
			hookEventName: "PostToolUse",
			additionalContext: message,
		},
	};
}

export function userPromptSubmitContext(message: string): HookOutput {
	return {
		hookSpecificOutput: {
			hookEventName: "UserPromptSubmit",
			additionalContext: message,
		},
	};
}
