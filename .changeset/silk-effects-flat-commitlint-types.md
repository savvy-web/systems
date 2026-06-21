---
"@savvy-web/silk-effects": minor
---

## Features

- The commitlint config types reachable from `CommitlintUserConfig` are now exported flat from the package entry, in addition to the `Commitlint` namespace: `CommitlintPlugin`, `PromptConfig`, `PromptSettings`, `RuleApplicability`, `RuleConfigTuple`, `RuleSeverity`, and `RulesConfig`. This lets a generated `commitlint.config.ts` name them directly for declaration emit.
