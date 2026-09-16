import { SpreadyThing } from "@fixture/ui";

const rest = { b: "x" };

export function Weird() {
  return <SpreadyThing a="hi" {...rest} />;
}
