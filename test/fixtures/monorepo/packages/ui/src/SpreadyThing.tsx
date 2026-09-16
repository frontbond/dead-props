import * as React from "react";

export interface SpreadyThingProps {
  a: string;
  b?: string;
  c?: string;
}

export function SpreadyThing({ a, b, c }: SpreadyThingProps) {
  return React.createElement("div", null, a, b, c);
}
