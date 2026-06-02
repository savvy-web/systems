---
id: packages/silk-effects/api/class/managedsection
title: "ManagedSection — silk-effects class"
summary: "Service for managing delimited sections in user-editable files. All methods use dual API (data-first and data-last). Identity-only operations (`read`, `isManag…"
tier: packages
source: generated
tags: [silk-effects, api]
priority: 0.3
related: []
---

# ManagedSection

Service for managing delimited sections in user-editable files. All methods use dual API (data-first and data-last). Identity-only operations (`read`, `isManaged`) take a [SectionDefinition](silk://packages/silk-effects/api/class/sectiondefinition). Content operations (`write`, `sync`, `check`) take a [SectionBlock](silk://packages/silk-effects/api/class/sectionblock).

```ts
class ManagedSection extends ManagedSection_base
```
