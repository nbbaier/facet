# Ultracite migration report (phase 1)

Date: 2026-11-18. Branch: `chore/ultracite-migration`. Ultracite 8.3.0, oxlint 1.90, oxfmt 0.75.

## Init command

```sh
bunx ultracite@latest init --linter oxlint --pm bun --frameworks react next --yes
```

Init only touched `package.json`, `bun.lock`, `eslint.config.mjs` (deleted) and the two new configs. No `AGENTS.md`, `CLAUDE.md`, editor or git hook edits.

## Removed

- `eslint.config.mjs` (FlatCompat `next/core-web-vitals`)
- `eslint` (removed by init) and `eslint-config-next` (removed by hand)
- `lint` script (`next lint`). It was already broken: Next 16 dropped `next lint`, so it treated `lint` as a project dir and exited 1.

No Prettier config, CI workflows, or README/AGENTS lines invoked the old tools. `plans/feat-facet-bookmarking-app.md` mentions `create-next-app --eslint` as history and was left alone.

## Added

- `oxlint.config.mts`: extends `core`, `react`, `next`, with a parked-rules block.
- `oxfmt.config.mts`: spreads the Ultracite preset.
- Dev deps: `ultracite`, `oxlint`, `oxfmt`.
- Scripts: `check` (`ultracite check`), `fix` (`ultracite fix`).
- `.git-blame-ignore-revs` listing the formatting commit.

## Preferences carried over

There was no Prettier config. The source already used double quotes, semicolons and 2-space indent, which match Ultracite's defaults, so no style options were overridden. `sortImports` and `sortPackageJson` are off (deferred to phase 2). The old ESLint config had no custom rules to carry over.

Extra ignores in both configs: `.cachebro/**` (cache) and `.oc/**` (commit-message tool config; tracked, but tool state, not source).

## Baseline before vs after

| Command | Before | After |
| --- | --- | --- |
| `bunx tsc --noEmit` | pass | pass |
| `bun run build` | fail: compiles, then page-data collection fails with libsql `URL_INVALID` because `TURSO_DATABASE_URL` is unset (no `.env`) | same failure, same cause |
| `bun run lint` (`next lint`) | fail: command removed in Next 16 | removed |
| `bunx eslint .` | fail: `@eslint/eslintrc` not installed | removed |
| `bun run check` | n/a | pass (exit 0) |

No tests exist. `db:push` was not run.

## Formatting commit

`ultracite fix` reformatted 12 files, including `SPEC.md` and `plans/*.md` (Markdown), `tsconfig.json`, sorted Tailwind classes (Ultracite's `sortTailwindcss` default, left on), and applied safe lint fixes: `curly` braces, `switch` case braces, and one flipped negated ternary in `page.tsx`. Typecheck still passes.

## Parked rules

All in one `rules` block in `oxlint.config.mts`. None was cleared by `ultracite fix`, so none is safely autofixable.

| Rule | Violations | Autofix | Suggested phase 2 order |
| --- | --- | --- | --- |
| `react/button-has-type` | 5 | no | 1 (trivial, add `type="button"`) |
| `typescript/no-non-null-assertion` | 2 | no | 2 (`src/lib/db.ts` env vars; validate them) |
| `no-await-in-loop` | 1 | no | 3 (`src/lib/review.ts`) |
| `no-new` | 1 | no | 4 (`new URL()` used for validation in `actions.ts`) |
| `no-nested-ternary` | 1 | no | 5 |
| `no-alert` | 1 | no | 6 (`confirm()` before delete; needs a UI decision) |
| `no-inline-comments` | 2 | no | 7 (one is created by oxfmt collapsing `next.config.ts`'s placeholder comment onto one line) |
| `func-style` | 20 | no | 8 (large, stylistic, touches every component; consider keeping off) |

Total: 8 rules, 33 violations.

## Surprises and left undone

- `next.config.ts`: oxfmt collapsed `{\n  /* config options here */\n}` to `{/* config options here */}`, which then trips `no-inline-comments`. Deleting the placeholder comment fixes both.
- The build cannot be verified without Turso env vars. That is pre-existing and was not changed.
