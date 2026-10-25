---
type: Gotcha
status: draft
title: The tsgo generator fails with "No TypeScript Go project found" when the dts-emit tsconfig does not describe the package's files canonically
description: "rolldown-plugin-dts's tsgo generator opens the temp-dir dts tsconfig as a TypeScript project and looks each entry up by realpath'd module id, so a symlinked package dir or a base tsconfig with no include makes every entry look like it is outside the project; writeDtsEmitTsconfig restates the base canonically to prevent it."
resource: ../../packages/tsdown-plugins/src/dts/resolved-tsconfig.ts
tags: [build, compat]
stale_after: 2027-04-25T00:00:00Z
generated:
  by: okfit/claude-code
  at: 2026-10-25T14:59:20Z
sources:
  - id: resolved-tsconfig
    resource: ../../packages/tsdown-plugins/src/dts/resolved-tsconfig.ts
integrity:
  generated:
    body: 444b1b05451847a2
---

# The tsgo generator fails with "No TypeScript Go project found" when the dts-emit tsconfig does not describe the package's files canonically

## What you see

A declaration pass under the tsgo generator fails on every entry with
`No TypeScript Go project found`, or — worse — succeeds while the project
it opened contains none of the package's sources. The same package built
fine under the old tsc generator, and the tsconfig the pass wrote to the OS
temp dir looks correct when opened by hand.

## What you will wrongly conclude

That the tsconfig is malformed, that TypeScript 7.1 cannot see the package,
or that the temp-dir placement of the dts tsconfig is itself the bug and
should be moved next to the source tree.

## What is actually true

The tsgo generator does not compile a file list handed to it; it opens the
tsconfig as a TypeScript **project** and then looks each entry up by the
realpath'd module id rolldown gives it. Two latent properties of the
temp-dir wrapper, harmless under tsc, break that lookup:[^resolved-tsconfig]

- **A symlinked base directory.** On macOS `/var` resolves to
  `/private/var`, and a linked checkout is a symlink too. If the wrapper
  names the base tsconfig by a non-canonical path, the project's root
  files are keyed under that non-canonical name, rolldown's ids are keyed
  under the canonical one, and every entry fails membership.
- **A base with neither `files` nor `include`.** TypeScript's default
  `**/*` is resolved against the directory of the config that declares
  it — the wrapper's directory, which is the OS temp dir. The project
  becomes every stray temp file on the machine and never the package.

`writeDtsEmitTsconfig` therefore `extends` the base by its canonical
(`realpathSync.native`) path and restates the base's `files`/`include`/
`exclude` — resolved through the whole `extends` chain by
`@effected/tsconfig-json`'s `TsconfigLoaderSync` — as absolute canonical
paths, preserving glob tails and realpath'ing the literal prefix; a base
that declares neither gets `<baseDir>/**/*` explicitly. Do not remove that
restatement as redundant, and do not move the wrapper out of the temp dir
to "fix" it: the wrapper stays there so an in-tree `tsconfig.json` base is
never polluted.[^resolved-tsconfig]

The generator choice this guards is
[decisions/typescript-7-1-dts-api.md](../decisions/typescript-7-1-dts-api.md).

[^resolved-tsconfig]: `../../packages/tsdown-plugins/src/dts/resolved-tsconfig.ts`
