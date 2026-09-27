---
"@savvy-web/silk-effects": minor
---

## Features

### `ReleasePlanner` snapshot releases

`ReleasePlanner.apply` and `.preview` accept a new `snapshot` option, giving `changeset version --snapshot` parity for callers driving the release engine programmatically:

```ts
const planner = yield* ReleasePlanner;
yield* planner.apply(root, {
	snapshot: {
		tag: "next",
		useCalculatedVersion: true,
		prereleaseTemplate: "{tag}-{commit}",
		commit: "abc1234"
	}
});
```

* `tag` — like the bare `changeset version --snapshot <tag>` argument; omit it or pass `""` for the bare `--snapshot` flag
* `useCalculatedVersion` / `prereleaseTemplate` — per-call overrides of the matching `config.snapshot` settings
* `commit` — value substituted for `{commit}`/`{commit-short}` prerelease-template placeholders (this service does not shell out to git to compute one)

Setting `snapshot` fails typed with `ReleasePlanError` when the workspace is in `pre` mode (snapshot releases are refused there, matching the CLI) or when the resolved `prereleaseTemplate` references a placeholder with no value.

Also exports the new `Changesets.SnapshotOptions` type describing this option's shape.
