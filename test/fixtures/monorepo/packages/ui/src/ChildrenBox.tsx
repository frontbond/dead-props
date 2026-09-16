import * as React from "react";

export interface ChildrenBoxProps {
  children?: React.ReactNode;
  label: string;
  hint?: string;
}

export function ChildrenBox({ children, label }: ChildrenBoxProps) {
  return React.createElement("div", null, label, children);
}
