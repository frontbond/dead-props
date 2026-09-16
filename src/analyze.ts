import { Identifier, Node } from "ts-morph";

export interface UsageAnalysis {
  usageCount: number;
  hasSpread: boolean;
  usedProps: Set<string>;
}

/** Finds every JSX call site of a component (via its declaration's name
 * identifier) across the whole project and collects which prop names are
 * passed. Project-wide reference resolution is what makes this work across
 * package boundaries in a monorepo, the same way "Find All References" does
 * in an editor — as long as the ts-morph Project's compiler options can
 * resolve the cross-package import (path mapping, workspace symlinks, ...),
 * usages in any other package are found too. */
export function analyzeUsage(nameNode: Identifier): UsageAnalysis {
  let usageCount = 0;
  let hasSpread = false;
  const usedProps = new Set<string>();

  const refs = nameNode.findReferencesAsNodes();
  for (const ref of refs) {
    const parent = ref.getParent();
    if (!parent) continue;
    if (!Node.isJsxOpeningElement(parent) && !Node.isJsxSelfClosingElement(parent)) {
      continue;
    }

    usageCount++;
    for (const attr of parent.getAttributes()) {
      if (Node.isJsxSpreadAttribute(attr)) {
        hasSpread = true;
      } else if (Node.isJsxAttribute(attr)) {
        usedProps.add(attr.getNameNode().getText());
      }
    }

    // `children` is almost always passed as nested JSX content
    // (`<Foo>...</Foo>`), not as a `children={...}` attribute — a
    // self-closing element (`<Foo />`) can never have nested content, so
    // this only applies to the opening/closing-tag form.
    if (Node.isJsxOpeningElement(parent) && hasNonEmptyJsxChildren(parent)) {
      usedProps.add("children");
    }
  }

  return { usageCount, hasSpread, usedProps };
}

/** A JsxOpeningElement's sibling closing tag holds the nested content; this
 * checks whether there's anything there beyond insignificant whitespace
 * text (indentation/newlines from formatting), which doesn't count as
 * "children" any more than an empty `<Foo></Foo>` would. */
function hasNonEmptyJsxChildren(openingElement: Node): boolean {
  const jsxElement = openingElement.getParent();
  if (!jsxElement || !Node.isJsxElement(jsxElement)) return false;

  return jsxElement.getJsxChildren().some((child) => {
    if (Node.isJsxText(child)) return child.getText().trim().length > 0;
    return true;
  });
}
