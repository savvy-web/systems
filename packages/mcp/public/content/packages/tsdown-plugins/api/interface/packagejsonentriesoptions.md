---
id: packages/tsdown-plugins/api/interface/packagejsonentriesoptions
title: "PackageJsonEntriesOptions — tsdown-plugins interface"
summary: "interface PackageJsonEntriesOptions from @savvy-web/tsdown-plugins."
tier: packages
source: generated
tags: [tsdown-plugins, api]
priority: 0.3
related: []
---

# PackageJsonEntriesOptions

```ts
interface PackageJsonEntriesOptions extends ExtractOptions
```

## Members

### cwd

```ts
readonly cwd?: string;
```

Working directory for reading package.json. Defaults to process.cwd().

### pkg

```ts
readonly pkg?: PackageJsonLike;
```

In-memory package.json. If omitted, reads `<cwd>/package.json`.
