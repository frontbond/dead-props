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
  }

  return { usageCount, hasSpread, usedProps };
}
