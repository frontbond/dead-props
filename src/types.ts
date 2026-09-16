export interface DeclaredProp {
  name: string;
  line: number;
  column: number;
}

export interface ComponentCandidate {
  /** Exported identifier name, e.g. "Button". */
  componentName: string;
  /** Name of the props interface/type, e.g. "ButtonProps". */
  propsTypeName: string;
  filePath: string;
  line: number;
  declaredProps: DeclaredProp[];
}

export type ComponentStatus = "analyzed" | "skipped-spread" | "unused";

export interface ComponentResult {
  component: ComponentCandidate;
  status: ComponentStatus;
  /** JSX call sites found across the project (import references excluded). */
  usageCount: number;
  /** Only meaningful when status is "analyzed". */
  deadProps: DeclaredProp[];
}

export interface ScanResult {
  results: ComponentResult[];
}
