import {
  Node,
  Project,
  SourceFile,
  FunctionDeclaration,
  VariableDeclaration,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  Identifier,
  TypeNode,
} from "ts-morph";
import type { ComponentCandidate, DeclaredProp } from "./types.js";

/** By-convention heuristic: a component's props type is named `<X>Props`.
 * This is what basically every React + TypeScript codebase does (including
 * every component in the codebases this tool was built against), and
 * matching on it avoids having to guess "is this function a component" from
 * JSX-return-shape analysis, which is far less reliable. */
function looksLikePropsTypeName(name: string): boolean {
  return /Props$/.test(name);
}

/** A component's own declared prop names — deliberately NOT resolving
 * `extends`/intersected base types. Real prop interfaces frequently extend
 * things like `React.HTMLAttributes<...>` or `AriaAttributes`, which have
 * dozens of members no one ever passes explicitly and never will; walking
 * up to those would drown every real finding in noise. Only members written
 * directly on the component's own Props declaration are considered. */
function getOwnDeclaredProps(
  decl: InterfaceDeclaration | TypeAliasDeclaration,
): DeclaredProp[] {
  const members: Node[] = [];

  if (Node.isInterfaceDeclaration(decl)) {
    members.push(...decl.getMembers());
  } else {
    // TypeAliasDeclaration: only handle `type X = { ... }` and
    // `type X = { ... } & Base` — pull members from the object-literal
    // operand(s) only, ignore intersected/base type references.
    const typeNode = decl.getTypeNode();
    if (!typeNode) return [];
    if (Node.isTypeLiteral(typeNode)) {
      members.push(...typeNode.getMembers());
    } else if (Node.isIntersectionTypeNode(typeNode)) {
      for (const t of typeNode.getTypeNodes()) {
        if (Node.isTypeLiteral(t)) members.push(...t.getMembers());
      }
    }
  }

  const props: DeclaredProp[] = [];
  for (const member of members) {
    if (!Node.isPropertySignature(member) && !Node.isMethodSignature(member)) {
      continue;
    }
    const nameNode = member.getNameNode();
    const { line, column } = member
      .getSourceFile()
      .getLineAndColumnAtPos(nameNode.getStart());
    props.push({ name: nameNode.getText(), line, column });
  }
  return props;
}

/** Resolves a type reference's text (e.g. "ButtonProps") to the
 * interface/type-alias declaration it names, if any, within this project. */
function resolvePropsDeclaration(
  typeNode: TypeNode,
): InterfaceDeclaration | TypeAliasDeclaration | undefined {
  const type = typeNode.getType();
  // `interface Foo` and `type Foo = { ... }` (object-literal aliases) expose
  // their declaration via getSymbol(). `type Foo = A & B` (and other
  // aliases whose resolved type doesn't carry its own symbol, e.g. unions)
  // only expose it via getAliasSymbol() — the alias's own symbol, as
  // opposed to the symbol of whatever type it happens to resolve to.
  const symbol = type.getSymbol() ?? type.getAliasSymbol();
  if (!symbol) return undefined;
  for (const declNode of symbol.getDeclarations()) {
    if (Node.isInterfaceDeclaration(declNode) || Node.isTypeAliasDeclaration(declNode)) {
      return declNode;
    }
  }
  return undefined;
}

/** Extracts the bare type name a TypeNode refers to, e.g. "ButtonProps" out
 * of a `ButtonProps` reference, or "ButtonProps" out of `FC<ButtonProps>`'s
 * first type argument. Returns undefined for anything else. */
function getPropsTypeNameFromDirectParam(typeNode: TypeNode): string | undefined {
  if (!Node.isTypeReference(typeNode)) return undefined;
  return typeNode.getTypeName().getText();
}

interface FoundComponent {
  nameNode: Identifier;
  candidate: ComponentCandidate;
}

function buildCandidate(
  componentName: string,
  propsTypeName: string,
  propsDecl: InterfaceDeclaration | TypeAliasDeclaration,
  file: SourceFile,
  line: number,
): ComponentCandidate {
  return {
    componentName,
    propsTypeName,
    filePath: file.getFilePath(),
    line,
    declaredProps: getOwnDeclaredProps(propsDecl),
  };
}

/** Finds exported function/arrow-function components whose single
 * parameter (or, for the `React.FC<Props>` form, whose variable's type
 * annotation) references a `*Props`-named interface or type alias. */
export function findComponentCandidates(project: Project): FoundComponent[] {
  const found: FoundComponent[] = [];

  for (const file of project.getSourceFiles()) {
    if (file.getFilePath().includes("/node_modules/")) continue;

    // Form 1: `export function Foo(props: FooProps) { ... }`
    for (const fn of file.getFunctions()) {
      if (!fn.isExported()) continue;
      const nameNode = fn.getNameNode();
      if (!nameNode) continue;
      const result = tryFromParam(fn, nameNode.getText(), nameNode, file);
      if (result) found.push(result);
    }

    // Form 2/3: `export const Foo = (props: FooProps) => ...`
    //           `export const Foo: React.FC<FooProps> = (props) => ...`
    for (const varStatement of file.getVariableStatements()) {
      if (!varStatement.isExported()) continue;
      for (const decl of varStatement.getDeclarations()) {
        const nameNode = decl.getNameNode();
        if (!Node.isIdentifier(nameNode)) continue;
        const result = tryFromVariableDeclaration(decl, nameNode.getText(), nameNode, file);
        if (result) found.push(result);
      }
    }
  }

  return found;
}

function tryFromParam(
  fn: FunctionDeclaration,
  componentName: string,
  nameNode: Identifier,
  file: SourceFile,
): FoundComponent | undefined {
  const param = fn.getParameters()[0];
  const typeNode = param?.getTypeNode();
  if (!typeNode) return undefined;
  const propsTypeName = getPropsTypeNameFromDirectParam(typeNode);
  if (!propsTypeName || !looksLikePropsTypeName(propsTypeName)) return undefined;

  const propsDecl = resolvePropsDeclaration(typeNode);
  if (!propsDecl) return undefined;

  return {
    nameNode,
    candidate: buildCandidate(
      componentName,
      propsTypeName,
      propsDecl,
      file,
      fn.getStartLineNumber(),
    ),
  };
}

function tryFromVariableDeclaration(
  decl: VariableDeclaration,
  componentName: string,
  nameNode: Identifier,
  file: SourceFile,
): FoundComponent | undefined {
  const initializer = decl.getInitializer();
  if (!initializer || (!Node.isArrowFunction(initializer) && !Node.isFunctionExpression(initializer))) {
    return undefined;
  }

  // Form 3: variable's own type annotation is `React.FC<FooProps>` / `FC<FooProps>`.
  const varTypeNode = decl.getTypeNode();
  if (varTypeNode && Node.isTypeReference(varTypeNode)) {
    const typeArgs = varTypeNode.getTypeArguments();
    const first = typeArgs[0];
    if (first) {
      const propsTypeName = getPropsTypeNameFromDirectParam(first);
      if (propsTypeName && looksLikePropsTypeName(propsTypeName)) {
        const propsDecl = resolvePropsDeclaration(first);
        if (propsDecl) {
          return {
            nameNode,
            candidate: buildCandidate(
              componentName,
              propsTypeName,
              propsDecl,
              file,
              decl.getStartLineNumber(),
            ),
          };
        }
      }
    }
  }

  // Form 2: the arrow function's own first parameter carries the type.
  const param = initializer.getParameters()[0];
  const typeNode = param?.getTypeNode();
  if (!typeNode) return undefined;
  const propsTypeName = getPropsTypeNameFromDirectParam(typeNode);
  if (!propsTypeName || !looksLikePropsTypeName(propsTypeName)) return undefined;

  const propsDecl = resolvePropsDeclaration(typeNode);
  if (!propsDecl) return undefined;

  return {
    nameNode,
    candidate: buildCandidate(
      componentName,
      propsTypeName,
      propsDecl,
      file,
      decl.getStartLineNumber(),
    ),
  };
}
