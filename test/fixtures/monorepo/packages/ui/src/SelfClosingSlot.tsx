import * as React from "react";

export interface SelfClosingSlotProps {
  children?: React.ReactNode;
  label: string;
}

export function SelfClosingSlot({ label }: SelfClosingSlotProps) {
  return React.createElement("div", null, label);
}
