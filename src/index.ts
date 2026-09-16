export { scan } from "./scan.js";
export { findComponentCandidates } from "./discover.js";
export { analyzeUsage } from "./analyze.js";
export { toText, toMarkdown, toJson } from "./format.js";
export type {
  ComponentCandidate,
  ComponentResult,
  ComponentStatus,
  DeclaredProp,
  ScanResult,
} from "./types.js";
