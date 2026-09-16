import { ChildrenBox } from "@fixture/ui";

export function Nested() {
  return (
    <ChildrenBox label="Wrapped">
      <span>hello</span>
    </ChildrenBox>
  );
}
