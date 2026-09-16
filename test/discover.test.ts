import { Project } from "ts-morph";
import { describe, expect, it } from "vitest";
import { findComponentCandidates } from "../src/discover.js";

function projectFrom(source: string) {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { jsx: 4 /* ReactJSX */, strict: false },
  });
  project.createSourceFile("component.tsx", source);
  return project;
}

describe("findComponentCandidates", () => {
  it("ignores props inherited from an extended base interface", () => {
    const project = projectFrom(`
      interface BaseProps { id: string; className?: string; }
      interface FooProps extends BaseProps { label: string; }
      export function Foo({ label }: FooProps) { return null; }
    `);
    const [found] = findComponentCandidates(project);
    expect(found.candidate.declaredProps.map((p) => p.name)).toEqual(["label"]);
  });

  it("ignores props from an intersected base type in a type alias", () => {
    const project = projectFrom(`
      type BaseProps = { id: string };
      type FooProps = { label: string } & BaseProps;
      export function Foo({ label }: FooProps) { return null; }
    `);
    const [found] = findComponentCandidates(project);
    expect(found.candidate.declaredProps.map((p) => p.name)).toEqual(["label"]);
  });

  it("captures method-signature props (`onClick(): void`), not just property signatures", () => {
    const project = projectFrom(`
      interface FooProps { label: string; onClick(): void; }
      export function Foo({ label, onClick }: FooProps) { return null; }
    `);
    const [found] = findComponentCandidates(project);
    expect(found.candidate.declaredProps.map((p) => p.name).sort()).toEqual(["label", "onClick"]);
  });

  it("does not treat a non-exported function as a component candidate", () => {
    const project = projectFrom(`
      interface FooProps { label: string; }
      function Foo({ label }: FooProps) { return null; }
    `);
    expect(findComponentCandidates(project)).toHaveLength(0);
  });

  it("does not treat a parameter type not ending in `Props` as a props type", () => {
    const project = projectFrom(`
      interface FooOptions { label: string; }
      export function Foo({ label }: FooOptions) { return null; }
    `);
    expect(findComponentCandidates(project)).toHaveLength(0);
  });
});
