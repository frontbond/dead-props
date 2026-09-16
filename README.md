# dead-props

Find component props that are declared in a `*Props` interface/type but
**never passed by any JSX call site in the project** — cross-file,
TypeScript-aware, and monorepo-friendly.

## The problem

ESLint's `no-unused-prop-types` and the newer `no-unused-props` (from
[eslint-react](https://eslint-react.xyz/docs/rules/no-unused-props)) both
check whether a declared prop is used *inside the component's own body*.
That's a different bug than the one this tool looks for: a prop the
component happily reads and uses, but that **no caller anywhere ever
bothers to pass** — a customization point nobody exercises anymore. On a
shared design-system package consumed by several apps, these accumulate for
years: an old `variant` value nobody picked, an `onSomething` callback from
a feature that shipped once and was never reused, an `icon` slot that got
replaced by a different pattern. Nothing flags them, because the prop is
"used" in the sense every linter checks — read inside the function — just
never supplied by anyone.

[`react-scanner`](https://github.com/moroshko/react-scanner) already
collects, per component, which prop names are passed at JSX call sites
across a codebase — but it doesn't know what a component's TypeScript props
type declares, so it can't compute the difference. `dead-props` does both
halves: it reads the declared props from the `*Props` interface/type, finds
every JSX call site project-wide (including across package boundaries in a
monorepo, the same way "Find All References" does in an editor), and
reports the props declared but never passed by any of them.

## Install

```bash
npm install --save-dev dead-props
```

Or run it without installing: `npx dead-props scan --tsconfig ./tsconfig.json`.

## Usage

```bash
dead-props scan --tsconfig ./tsconfig.json
```

For a monorepo, point `--tsconfig` at whichever tsconfig already resolves
cross-package imports (path aliases, workspace symlinks) — usually a shared
root config, or one package's config if its `paths` mapping covers the
others. `dead-props` builds a single project from that config and walks
every file it includes; it doesn't need one run per package.

Options:

| Flag | Description | Default |
| --- | --- | --- |
| `--tsconfig <path>` | tsconfig.json to load (required) | — |
| `--format <fmt>` | `text`, `markdown`, or `json` | `text` |
| `--out <path>` | Write to a file instead of stdout | stdout |
| `--fail-on <mode>` | `dead-props` (exit 1 if any found) or `never` | `dead-props` |

## What it detects

A function or arrow-function component is a candidate when its props come
from a type named `*Props` — the near-universal convention in React +
TypeScript codebases — in any of these forms:

```tsx
function Button(props: ButtonProps) { ... }
const Button = (props: ButtonProps) => { ... }
const Button: React.FC<ButtonProps> = (props) => { ... }
```

For each candidate, it finds every JSX call site project-wide and unions
the prop names passed across all of them. Anything declared but never in
that union is reported.

Every result lands in exactly one of three buckets:

- **Dead props** — the component has at least one JSX call site, none of
  them spread unknown props onto it, and some declared prop was never
  passed by any of them.
- **Skipped** — at least one call site spreads props onto the component
  (`<Foo {...rest} />`). There's no way to know what `rest` contains
  without evaluating the program, so rather than guess and risk a false
  positive, the whole component is skipped and reported separately.
- **Unused** — the component has *zero* JSX call sites anywhere in the
  project. That's a different question ("is this component itself dead
  code?") that a tool like [Knip](https://knip.dev) already answers well —
  `dead-props` reports it separately rather than claiming every declared
  prop is "dead."

## Scope and limitations

- **Only a component's own declared members are checked.** Props inherited
  via `extends`/intersection (e.g. `ButtonProps extends
  React.HTMLAttributes<HTMLButtonElement>`) are deliberately ignored — most
  of those are unavoidably unused by most callers and checking them would
  drown real findings in noise.
- **Detection is convention-based** (`*Props` naming), not a full
  heuristic for "what is a React component." A component whose props type
  is named something else won't be picked up.
- **Static analysis only.** A prop passed via a runtime-computed object
  spread is invisible to this tool by construction (see "Skipped" above).

## Programmatic use

```ts
import { Project } from "ts-morph";
import { scan, toMarkdown } from "dead-props";

const project = new Project({ tsConfigFilePath: "./tsconfig.json" });
const result = scan(project);
console.log(toMarkdown(result, process.cwd()));
```

## Development

```bash
npm ci
npm run build   # tsc -> dist/
npm test        # vitest, against a real tiny fixture monorepo in test/fixtures/
```

The fixture in `test/fixtures/monorepo` is a real two-package project (a
`ui` package and an `app` package wired together with a `paths` alias) —
tests run `ts-morph` against it directly rather than against hand-built
in-memory data, so the cross-package resolution this tool depends on is
actually exercised, not assumed.

## License

MIT
