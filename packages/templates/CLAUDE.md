# @savvy-web/templates

`@savvy-web/templates` provides pure-function TypeScript project scaffolding for the Silk Suite. Built via `@savvy-web/bundler`.

## Key surface

- Content generation is pure functions; templates produce file content with no side effects.
- Effect `Schema` validation throughout; the `TemplateEntry` abstraction models each emitted file.
- A workspace compositor assembles templates into a project.
- All Effect code uses class-based `Context.Tag`, `Schema.Class`/`Schema.TaggedClass`, `Data.TaggedError`.

## Design

Load for the template inventory, the pure-function content-generation approach, and design decisions:
→ `@../../.claude/design/templates/architecture.md`
Load when adding a template, changing the `TemplateEntry` abstraction, or working on the workspace compositor.
