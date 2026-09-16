import * as React from "react";

export interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  icon?: React.ReactNode;
}

export function Button({ label, onClick, variant }: ButtonProps) {
  return React.createElement("button", { onClick, className: variant }, label);
}
