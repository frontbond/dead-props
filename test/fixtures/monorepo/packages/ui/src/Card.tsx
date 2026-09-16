import * as React from "react";

export interface CardProps {
  title: string;
  footer?: React.ReactNode;
  elevated?: boolean;
}

export function Card({ title, footer, elevated }: CardProps) {
  return React.createElement("div", { className: elevated ? "elevated" : "" }, title, footer);
}
