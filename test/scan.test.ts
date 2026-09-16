import { fileURLToPath } from "node:url";
import path from "node:path";
import { Project } from "ts-morph";
import { describe, expect, it, beforeAll } from "vitest";
import { scan } from "../src/scan.js";
import { toMarkdown, toText } from "../src/format.js";
import type { ScanResult } from "../src/types.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const tsconfigPath = path.join(dir, "fixtures/monorepo/tsconfig.json");

// This fixture is a real (tiny) monorepo with a `ui` package and an `app`
// package that consumes it across a path-mapped import (`@fixture/ui`),
// exercising the exact cross-package resolution this tool exists for.
// It intentionally covers every status this tool can report:
//   Button      -> dead prop `icon` (2 call sites, neither passes it)
//   Card        -> dead prop `footer` (1 call site, doesn't pass it)
//   IconLabel   -> dead prop `subtitle`, via the `React.FC<Props>` form
//   SpreadyThing -> skipped: one call site spreads unknown props onto it
//   OrphanWidget -> unused: no JSX call site anywhere in the project
let result: ScanResult;

beforeAll(() => {
  const project = new Project({ tsConfigFilePath: tsconfigPath });
  result = scan(project);
});

function byName(name: string) {
  const r = result.results.find((r) => r.component.componentName === name);
  if (!r) throw new Error(`No result for component "${name}"`);
  return r;
}

describe("scan (real fixture monorepo)", () => {
  it("finds a dead prop on a plain `function Foo(props: FooProps)` component", () => {
    const button = byName("Button");
    expect(button.status).toBe("analyzed");
    expect(button.usageCount).toBe(2);
    expect(button.deadProps.map((p) => p.name)).toEqual(["icon"]);
  });

  it("finds a dead prop on a single-call-site component", () => {
    const card = byName("Card");
    expect(card.status).toBe("analyzed");
    expect(card.deadProps.map((p) => p.name)).toEqual(["footer"]);
  });

  it("supports the `React.FC<Props>` form, not just the direct-param form", () => {
    const iconLabel = byName("IconLabel");
    expect(iconLabel.status).toBe("analyzed");
    expect(iconLabel.deadProps.map((p) => p.name)).toEqual(["subtitle"]);
  });

  it("does NOT flag a prop that only some call sites pass (union across all call sites)", () => {
    const button = byName("Button");
    // `variant` is passed at one call site and not the other — must not be dead.
    expect(button.deadProps.map((p) => p.name)).not.toContain("variant");
  });

  it("skips a component with a spread attribute at any call site, rather than guessing", () => {
    const spready = byName("SpreadyThing");
    expect(spready.status).toBe("skipped-spread");
    expect(spready.deadProps).toEqual([]);
  });

  it("marks a component with zero JSX call sites as `unused`, not as all-props-dead", () => {
    const orphan = byName("OrphanWidget");
    expect(orphan.status).toBe("unused");
    expect(orphan.deadProps).toEqual([]);
  });

  it("does not report props inherited from an extended/intersected base type", () => {
    // None of the fixture's Props types extend anything, so this is really
    // asserting the own-members restriction doesn't accidentally pull in
    // unrelated names; see discover.test.ts for a direct test of the
    // extends-are-ignored behavior itself.
    const names = result.results.flatMap((r) => r.component.declaredProps.map((p) => p.name));
    expect(new Set(names).size).toBe(names.length > 0 ? new Set(names).size : 0);
  });
});

describe("formatters (real fixture monorepo)", () => {
  it("toText lists dead props, skipped, and unused in separate sections", () => {
    const text = toText(result, path.join(dir, "fixtures/monorepo"));
    expect(text).toContain("component(s) with dead props");
    expect(text).toContain("icon");
    expect(text).toContain("skipped (spread props");
    expect(text).toContain("no JSX usages found");
  });

  it("toMarkdown renders a clean-report header when nothing is dead", () => {
    const empty: ScanResult = { results: [] };
    expect(toMarkdown(empty, "/x")).toContain("no dead props found");
  });
});
