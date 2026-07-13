---
"@savvy-web/silk-effects": patch
---

## Documentation

- Corrected the `ShellScripts` lint handler's TSDoc: the exec-bit strip is now explained as intentional normalization (scripts run via `bash <script>`, so the mode is never needed at runtime), and the `.claude/scripts/` default exclude is now described as a consumer escape-hatch convention rather than something Silk itself requires — the previous comment incorrectly claimed it was needed "for lint-staged hooks to work."
