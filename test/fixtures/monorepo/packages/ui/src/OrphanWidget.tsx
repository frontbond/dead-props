import * as React from "react";

export interface OrphanWidgetProps {
  value: string;
  onChange?: (v: string) => void;
}

export function OrphanWidget({ value }: OrphanWidgetProps) {
  return React.createElement("span", null, value);
}
