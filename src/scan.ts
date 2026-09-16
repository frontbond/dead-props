import { Project } from "ts-morph";
import { findComponentCandidates } from "./discover.js";
import { analyzeUsage } from "./analyze.js";
import type { ComponentResult, ScanResult } from "./types.js";

export function scan(project: Project): ScanResult {
  const found = findComponentCandidates(project);
  const results: ComponentResult[] = [];

  for (const { nameNode, candidate } of found) {
    const { usageCount, hasSpread, usedProps } = analyzeUsage(nameNode);

    if (usageCount === 0) {
      results.push({ component: candidate, status: "unused", usageCount, deadProps: [] });
      continue;
    }

    if (hasSpread) {
      results.push({ component: candidate, status: "skipped-spread", usageCount, deadProps: [] });
      continue;
    }

    const deadProps = candidate.declaredProps.filter((p) => !usedProps.has(p.name));
    results.push({ component: candidate, status: "analyzed", usageCount, deadProps });
  }

  results.sort((a, b) => a.component.componentName.localeCompare(b.component.componentName));

  return { results };
}
