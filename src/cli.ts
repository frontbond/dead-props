#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import { Project } from "ts-morph";
import { scan } from "./scan.js";
import { toText, toMarkdown, toJson } from "./format.js";

const program = new Command();

program
  .name("dead-props")
  .description(
    "Find component props that are declared in a *Props interface/type but never passed by any JSX call site in the project.",
  )
  .version("0.1.1");

program
  .command("scan")
  .description("Scan a project (single package or monorepo) for dead props")
  .requiredOption(
    "--tsconfig <path>",
    "Path to the tsconfig.json whose compiler options (including any path-alias mapping needed to resolve cross-package imports) should be used",
  )
  .option("--format <format>", "text | markdown | json", "text")
  .option("--out <path>", "Write the report to a file instead of stdout")
  .option(
    "--fail-on <mode>",
    "When to exit non-zero: 'dead-props' (default) or 'never'",
    "dead-props",
  )
  .action((opts) => {
    const project = new Project({ tsConfigFilePath: path.resolve(opts.tsconfig) });
    const result = scan(project);

    const cwd = process.cwd();
    let output: string;
    switch (opts.format) {
      case "json":
        output = toJson(result);
        break;
      case "markdown":
        output = toMarkdown(result, cwd);
        break;
      case "text":
        output = toText(result, cwd);
        break;
      default:
        throw new Error(`Unknown --format "${opts.format}". Expected: text, markdown, json.`);
    }

    if (opts.out) {
      writeFileSync(opts.out, output);
    } else {
      console.log(output);
    }

    const hasDeadProps = result.results.some(
      (r) => r.status === "analyzed" && r.deadProps.length > 0,
    );
    if (opts.failOn === "dead-props" && hasDeadProps) {
      process.exitCode = 1;
    } else if (opts.failOn !== "dead-props" && opts.failOn !== "never") {
      throw new Error(`Unknown --fail-on "${opts.failOn}". Expected: dead-props, never.`);
    }
  });

program.parseAsync(process.argv).catch((error: Error) => {
  console.error(`dead-props: ${error.message}`);
  process.exitCode = 1;
});
