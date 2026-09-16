import type { ScanResult } from "./types.js";

function relPath(filePath: string, cwd: string): string {
  return filePath.startsWith(cwd) ? filePath.slice(cwd.length + 1) : filePath;
}

export function toText(result: ScanResult, cwd: string): string {
  const withDead = result.results.filter((r) => r.status === "analyzed" && r.deadProps.length > 0);
  const skipped = result.results.filter((r) => r.status === "skipped-spread");
  const unused = result.results.filter((r) => r.status === "unused");

  const out: string[] = [];

  if (withDead.length === 0) {
    out.push("No dead props found.");
  } else {
    out.push(`${withDead.length} component(s) with dead props:`);
    for (const r of withDead) {
      out.push(`  ${r.component.componentName}  ${relPath(r.component.filePath, cwd)}:${r.component.line}`);
      for (const p of r.deadProps) {
        out.push(`    - ${p.name}  (declared at line ${p.line}, never passed by any of ${r.usageCount} call site(s))`);
      }
    }
  }

  if (skipped.length > 0) {
    out.push("");
    out.push(`${skipped.length} component(s) skipped (spread props at a call site — can't verify):`);
    for (const r of skipped) {
      out.push(`  ${r.component.componentName}  ${relPath(r.component.filePath, cwd)}:${r.component.line}`);
    }
  }

  if (unused.length > 0) {
    out.push("");
    out.push(`${unused.length} component(s) with no JSX usages found (that's a Knip-shaped question, not this tool's):`);
    for (const r of unused) {
      out.push(`  ${r.component.componentName}  ${relPath(r.component.filePath, cwd)}:${r.component.line}`);
    }
  }

  return out.join("\n");
}

export function toMarkdown(result: ScanResult, cwd: string): string {
  const withDead = result.results.filter((r) => r.status === "analyzed" && r.deadProps.length > 0);
  const skipped = result.results.filter((r) => r.status === "skipped-spread");
  const unused = result.results.filter((r) => r.status === "unused");

  const out: string[] = [];

  if (withDead.length === 0) {
    out.push("### ✅ dead-props: no dead props found");
  } else {
    out.push(`### ⚠️ dead-props: ${withDead.length} component(s) with props nobody passes`);
    out.push("");
    for (const r of withDead) {
      out.push(`- \`${r.component.componentName}\` — \`${relPath(r.component.filePath, cwd)}:${r.component.line}\` (${r.usageCount} call site(s) checked)`);
      for (const p of r.deadProps) {
        out.push(`  - \`${p.name}\` — declared line ${p.line}, never passed`);
      }
    }
  }

  if (skipped.length > 0) {
    out.push("");
    out.push(`<details><summary>${skipped.length} component(s) skipped — spread props at a call site, can't verify</summary>\n`);
    for (const r of skipped) {
      out.push(`- \`${r.component.componentName}\` — \`${relPath(r.component.filePath, cwd)}:${r.component.line}\``);
    }
    out.push("\n</details>");
  }

  if (unused.length > 0) {
    out.push("");
    out.push(`<details><summary>${unused.length} component(s) with no JSX usages found — check with Knip, not this tool</summary>\n`);
    for (const r of unused) {
      out.push(`- \`${r.component.componentName}\` — \`${relPath(r.component.filePath, cwd)}:${r.component.line}\``);
    }
    out.push("\n</details>");
  }

  out.push("");
  out.push("<sub>Reported by dead-props.</sub>");

  return out.join("\n");
}

export function toJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}
