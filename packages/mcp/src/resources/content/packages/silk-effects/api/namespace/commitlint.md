---
id: packages/silk-effects/api/namespace/commitlint
title: "Commitlint — silk-effects namespace"
summary: "namespace Commitlint from @savvy-web/silk-effects."
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# Commitlint

## Members

### BranchInfo

```ts
interface BranchInfo
```

### buildSigningDiagnostic

```ts
function buildSigningDiagnostic(raw: RawSigningInputs): SigningDiagnostic;
```

### ClosesTrailerCtx

```ts
interface ClosesTrailerCtx
```

### ClosesTrailerInput

```ts
interface ClosesTrailerInput
```

### closesTrailerRule

```ts
closesTrailerRule: Rule<ClosesTrailerInput, ClosesTrailerCtx>
```

### COMMIT_TYPE_DEFINITIONS

```ts
COMMIT_TYPE_DEFINITIONS: readonly CommitTypeDefinition[]
```

Commit type definitions with metadata for prompts and changelogs.

### COMMIT_TYPES

```ts
COMMIT_TYPES: readonly ["ai", "build", "chore", "ci", "docs", "feat", "fix", "perf", "refactor", "release", "revert", "style", "tdd", "test"]
```

Allowed commit types for conventional commits.

### CommitlintConfig

```ts
class CommitlintConfig
```

Dynamic commitlint configuration factory.

### CommitlintPlugin

```ts
interface CommitlintPlugin
```

[Commitlint](silk://packages/silk-effects/api/namespace/commitlint) plugin interface.

### CommitlintUserConfig

```ts
interface CommitlintUserConfig
```

[Commitlint](silk://packages/silk-effects/api/namespace/commitlint) user configuration.

### CommitType

```ts
type CommitType = (typeof COMMIT_TYPES)[number];
```

Union type of all valid commit types.

### CommitTypeDefinition

```ts
interface CommitTypeDefinition
```

Commit type definition with metadata for prompts and documentation.

### ConfigOptions

```ts
interface ConfigOptions
```

Configuration options for CommitlintConfig.

### createPromptConfig

```ts
function createPromptConfig(options?: PromptConfigOptions): ResolvedPromptConfig;
```

Create prompt configuration for commitizen adapters.

### createTypeEnum

```ts
function createTypeEnum(emojis: boolean): Record<CommitType, TypeEnumEntry>;
```

Create type enum configuration for prompts.

### DCO_SIGNOFF_TEXT

```ts
DCO_SIGNOFF_TEXT = "Signed-off-by:"
```

DCO (Developer Certificate of Origin) signoff text.

### DEFAULT_BODY_MAX_LINE_LENGTH

```ts
DEFAULT_BODY_MAX_LINE_LENGTH = 300
```

Default maximum line length for commit body.

### default

```ts
class CommitlintConfig
```

Dynamic commitlint configuration factory.

### defaultPromptConfig

```ts
defaultPromptConfig: ResolvedPromptConfig
```

Default prompt configuration (no emojis).

### detectDCO

```ts
function detectDCO(cwd?: string): boolean;
```

Detect if DCO signoff should be required.

### detectFromLockfiles

```ts
function detectFromLockfiles(presence: LockfilePresence): PackageManager;
```

### detectPackageManager

```ts
function detectPackageManager(root: string): Promise<PackageManager>;
```

### detectScopes

```ts
detectScopes: Effect.Effect<string[], WorkspaceDiscoveryError, WorkspaceDiscovery>
```

Detect package scopes from workspace configuration.

### emojiPromptConfig

```ts
emojiPromptConfig: ResolvedPromptConfig
```

Prompt configuration with emojis enabled.

### ERROR_EXPLANATIONS

```ts
ERROR_EXPLANATIONS: Record<string, string>
```

Detailed error explanations for common rule failures.

### ERROR_SUGGESTIONS

```ts
ERROR_SUGGESTIONS: Record<string, string>
```

Suggestions for fixing common errors.

### fetchAndCacheOpenIssues

```ts
function fetchAndCacheOpenIssues(cachePath: string): Effect.Effect<OpenIssue[] | null>;
```

### ForbiddenContentInput

```ts
interface ForbiddenContentInput
```

### forbiddenContentRule

```ts
forbiddenContentRule: Rule<ForbiddenContentInput, never>
```

### format

```ts
function format(formatterResult: FormatterResult): string;
```

Format lint results for display.

### FormatterResult

```ts
interface FormatterResult
```

Formatter result structure passed by commitlint.

### getExplanation

```ts
function getExplanation(ruleName: string): string | undefined;
```

Get explanation for a rule failure.

### getSuggestion

```ts
function getSuggestion(ruleName: string): string | undefined;
```

Get suggestion for fixing a rule failure.

### getTypeEmoji

```ts
function getTypeEmoji(type: CommitType, unicode?: boolean): string;
```

Get emoji for a commit type.

### hasClosingTrailer

```ts
function hasClosingTrailer(message: string, ticketId: number): boolean;
```

### HookRuleSeverity

```ts
type RuleSeverity = "deny" | "advise";
```

### HookSilencer

```ts
HookSilencer: Layer.Layer<never, never, never>
```

Combined hook logger layer: stderr redirect merged with the Warning minimum log level. Provided by hook command wrappers to keep stdout corruption-proof.

### inferTicketId

```ts
function inferTicketId(branch: string): number | null;
```

### Inquirer

```ts
interface Inquirer
```

Inquirer instance provided by commitizen.

### ISSUES_CACHE_RELATIVE_PATH

```ts
ISSUES_CACHE_RELATIVE_PATH = ".claude/cache/issues.json"
```

Relative path under CLAUDE_PROJECT_DIR where the open-issues cache lives.

### ISSUES_CACHE_TTL_SECONDS

```ts
ISSUES_CACHE_TTL_SECONDS = 600
```

### LintOutcome

```ts
interface LintOutcome
```

[Lint](silk://packages/silk-effects/api/namespace/lint) result from commitlint.

### LockfilePresence

```ts
interface LockfilePresence
```

### OpenIssue

```ts
interface OpenIssue
```

### PackageManager

```ts
type PackageManager = "pnpm" | "yarn" | "bun" | "npm";
```

### parseBashCommand

```ts
function parseBashCommand(command: string): ParsedCommit;
```

### ParsedCommit

```ts
interface ParsedCommit
```

### ParsedKind

```ts
type ParsedKind = "git-commit" | "git-commit-amend" | "gh-pr-create" | "gh-pr-edit" | "unknown";
```

### parseGpgKeyExpiry

```ts
function parseGpgKeyExpiry(colonsOutput: string): string | null;
```

### parseHuskyConfigPath

```ts
function parseHuskyConfigPath(huskyContent: string, root: string): string | null;
```

### parsePackageManagerField

```ts
function parsePackageManagerField(packageJsonContent: string): PackageManager | null;
```

### partitionHits

```ts
function partitionHits(hits: ReadonlyArray<RuleHit>): {
    deny: RuleHit[];
    advise: RuleHit[];
};
```

### PlanLeakageInput

```ts
interface PlanLeakageInput
```

### planLeakageRule

```ts
planLeakageRule: Rule<PlanLeakageInput, never>
```

### postToolUseAdvise

```ts
function postToolUseAdvise(message: string): HookOutput;
```

### PostToolUseEnvelope

```ts
type PostToolUseEnvelope = Schema.Schema.Type<typeof PostToolUseEnvelope>;
```

### PostToolUseEnvelope

```ts
PostToolUseEnvelope: Schema.Struct<{
    hook_event_name: Schema.Literal<["PostToolUse"]>;
    tool_name: typeof Schema.String;
    tool_input: Schema.Record$<typeof Schema.String, typeof Schema.Unknown>;
    tool_response: Schema.Struct<{
        interrupted: Schema.optional<typeof Schema.Boolean>;
        exit_code: Schema.optional<typeof Schema.Number>;
        stdout: Schema.optional<typeof Schema.String>;
        stderr: Schema.optional<typeof Schema.String>;
    }>;
}>
```

### PostToolUseEnvelopeType

```ts
type PostToolUseEnvelope = Schema.Schema.Type<typeof PostToolUseEnvelope>;
```

### PostToolUseEnvelopeType

```ts
PostToolUseEnvelope: Schema.Struct<{
    hook_event_name: Schema.Literal<["PostToolUse"]>;
    tool_name: typeof Schema.String;
    tool_input: Schema.Record$<typeof Schema.String, typeof Schema.Unknown>;
    tool_response: Schema.Struct<{
        interrupted: Schema.optional<typeof Schema.Boolean>;
        exit_code: Schema.optional<typeof Schema.Number>;
        stdout: Schema.optional<typeof Schema.String>;
        stderr: Schema.optional<typeof Schema.String>;
    }>;
}>
```

### preToolUseAdvise

```ts
function preToolUseAdvise(message: string): HookOutput;
```

### preToolUseAllow

```ts
function preToolUseAllow(reason: string): HookOutput;
```

### preToolUseDeny

```ts
function preToolUseDeny(reason: string): HookOutput;
```

### PreToolUseEnvelope

```ts
type PreToolUseEnvelope = Schema.Schema.Type<typeof PreToolUseEnvelope>;
```

### PreToolUseEnvelope

```ts
PreToolUseEnvelope: Schema.Struct<{
    hook_event_name: Schema.Literal<["PreToolUse"]>;
    tool_name: typeof Schema.String;
    tool_input: Schema.Record$<typeof Schema.String, typeof Schema.Unknown>;
}>
```

### PreToolUseEnvelopeType

```ts
type PreToolUseEnvelope = Schema.Schema.Type<typeof PreToolUseEnvelope>;
```

### PreToolUseEnvelopeType

```ts
PreToolUseEnvelope: Schema.Struct<{
    hook_event_name: Schema.Literal<["PreToolUse"]>;
    tool_name: typeof Schema.String;
    tool_input: Schema.Record$<typeof Schema.String, typeof Schema.Unknown>;
}>
```

### preToolUseSilent

```ts
function preToolUseSilent(): HookOutput;
```

### PromptConfig

```ts
interface PromptConfig
```

[Commitlint](silk://packages/silk-effects/api/namespace/commitlint) prompt configuration.

### PromptConfigOptions

```ts
interface PromptConfigOptions
```

Options for creating a prompt configuration.

### prompter

```ts
function prompter(cz: Inquirer, commit: (message: string) => void, options?: PrompterOptions): void;
```

Commitizen prompter function.

### PrompterOptions

```ts
interface PrompterOptions
```

Options for the prompter.

### PromptQuestion

```ts
interface PromptQuestion
```

Question definition for the prompt configuration.

### PromptSettings

```ts
interface PromptSettings
```

[Commitlint](silk://packages/silk-effects/api/namespace/commitlint) prompt settings.

### Question

```ts
interface Question
```

Inquirer question type.

### RawSigningInputs

```ts
interface RawSigningInputs
```

### readBranchInfo

```ts
function readBranchInfo(): Effect.Effect<BranchInfo>;
```

### readCache

```ts
function readCache<T>(path: string, ttlSeconds: number): Effect.Effect<T | null>;
```

### readCommitlintConfigPath

```ts
function readCommitlintConfigPath(root: string): Promise<string | null>;
```

### readOpenIssuesFromCache

```ts
function readOpenIssuesFromCache(cachePath: string, ttlSeconds?: number): Effect.Effect<OpenIssue[] | null>;
```

### readOrFetchOpenIssues

```ts
function readOrFetchOpenIssues(cachePath: string): Effect.Effect<OpenIssue[] | null>;
```

### readSigningDiagnostic

```ts
function readSigningDiagnostic(): Effect.Effect<SigningDiagnostic>;
```

### ReleaseFormat

```ts
type ReleaseFormat = "semver" | "packages" | "scoped";
```

Release format type for the release commit type.

### ResolvedPromptConfig

```ts
interface ResolvedPromptConfig
```

Resolved prompt configuration returned by createPromptConfig.

### Rule

```ts
interface Rule<Input, Ctx, E = never, R = never>
```

### RuleApplicability

```ts
type RuleApplicability = "always" | "never";
```

Rule applicability.

### RuleConfigTuple

```ts
type RuleConfigTuple<T = unknown> = readonly [RuleSeverity] | readonly [RuleSeverity, RuleApplicability] | readonly [RuleSeverity, RuleApplicability, T];
```

Rule configuration tuple.

### RuleHit

```ts
interface RuleHit
```

### RuleResult

```ts
interface RuleResult
```

Individual rule result.

### RulesConfig

```ts
interface RulesConfig
```

[Commitlint](silk://packages/silk-effects/api/namespace/commitlint) rules configuration.

### RuleSeverity

```ts
type RuleSeverity = 0 | 1 | 2;
```

Rule severity level. - 0: Disabled - 1: Warning - 2: Error

### sessionStartContext

```ts
function sessionStartContext(message: string): HookOutput;
```

### SessionStartEnvelope

```ts
type SessionStartEnvelope = Schema.Schema.Type<typeof SessionStartEnvelope>;
```

### SessionStartEnvelope

```ts
SessionStartEnvelope: Schema.Struct<{
    hook_event_name: Schema.Literal<["SessionStart"]>;
    source: Schema.optional<typeof Schema.String>;
}>
```

### SessionStartEnvelopeType

```ts
type SessionStartEnvelope = Schema.Schema.Type<typeof SessionStartEnvelope>;
```

### SessionStartEnvelopeType

```ts
SessionStartEnvelope: Schema.Struct<{
    hook_event_name: Schema.Literal<["SessionStart"]>;
    source: Schema.optional<typeof Schema.String>;
}>
```

### SigningDiagnostic

```ts
interface SigningDiagnostic
```

### signingFlagConflictRule

```ts
signingFlagConflictRule: Rule<SigningFlagInput, SigningFlagCtx>
```

### SigningFlagCtx

```ts
interface SigningFlagCtx
```

### SigningFlagInput

```ts
interface SigningFlagInput
```

### SoftWrapInput

```ts
interface SoftWrapInput
```

### softWrapRule

```ts
softWrapRule: Rule<SoftWrapInput, never>
```

### staticConfig

```ts
staticConfig: CommitlintUserConfig
```

Static commitlint configuration.

### TDD_SCOPE_PATTERN

```ts
TDD_SCOPE_PATTERN: RegExp
```

Pattern for valid TDD commit scope.

### TDD_STATES

```ts
TDD_STATES: readonly ["spike", "red", "green", "refactor"]
```

Valid TDD states for commit scope.

### TYPE_EMOJIS_UNICODE

```ts
TYPE_EMOJIS_UNICODE: Record<CommitType, string>
```

Unicode emoji mapping for commit types.

### TYPE_EMOJIS

```ts
TYPE_EMOJIS: Record<CommitType, string>
```

Emoji shortcode mapping for commit types.

### TypeEnumEntry

```ts
interface TypeEnumEntry
```

Type enum entry for prompt configuration.

### userPromptSubmitContext

```ts
function userPromptSubmitContext(message: string): HookOutput;
```

### UserPromptSubmitEnvelope

```ts
type UserPromptSubmitEnvelope = Schema.Schema.Type<typeof UserPromptSubmitEnvelope>;
```

### UserPromptSubmitEnvelope

```ts
UserPromptSubmitEnvelope: Schema.Struct<{
    hook_event_name: Schema.Literal<["UserPromptSubmit"]>;
    prompt: typeof Schema.String;
}>
```

### UserPromptSubmitEnvelopeType

```ts
type UserPromptSubmitEnvelope = Schema.Schema.Type<typeof UserPromptSubmitEnvelope>;
```

### UserPromptSubmitEnvelopeType

```ts
UserPromptSubmitEnvelope: Schema.Struct<{
    hook_event_name: Schema.Literal<["UserPromptSubmit"]>;
    prompt: typeof Schema.String;
}>
```

### VERBOSITY_LINE_THRESHOLD

```ts
VERBOSITY_LINE_THRESHOLD = 25
```

### VERBOSITY_WORD_THRESHOLD

```ts
VERBOSITY_WORD_THRESHOLD = 400
```

### VerbosityInput

```ts
interface VerbosityInput
```

### verbosityRule

```ts
verbosityRule: Rule<VerbosityInput, never>
```

### writeCache

```ts
function writeCache<T>(path: string, data: T, when?: Date): Effect.Effect<void>;
```
