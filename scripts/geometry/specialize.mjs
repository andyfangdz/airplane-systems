/** Production specialization resolves Catalogue signatures; it never matches call names as text. */
import { createHash } from "node:crypto";
import ts from "typescript";

export const digest = (value) => createHash("sha256").update(value).digest("hex");

export function specializeSource(program, source) {
  const checker = program.getTypeChecker();
  let changes = 0;
  const unavailable = () =>
    ts.factory.createArrowFunction(
      undefined,
      undefined,
      [],
      undefined,
      ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
      ts.factory.createBlock([
        ts.factory.createThrowStatement(
          ts.factory.createNewExpression(ts.factory.createIdentifier("Error"), undefined, [
            ts.factory.createStringLiteral("Compiled geometry is not ready; retry the aircraft load"),
          ]),
        ),
      ]),
    );
  const dynamic = (options) => {
    if (!options) return false;
    const type = checker.getTypeAtLocation(options);
    // Unknown/spread arguments are conservative: never discard a possible dynamic factory.
    if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return true;
    const prop = type.getProperty("dynamicGeo");
    if (!prop) return false;
    const value = checker.getTypeOfSymbolAtLocation(prop, options);
    return !(value.flags & ts.TypeFlags.BooleanLiteral && value.intrinsicName === "false");
  };
  const result = ts.transform(source, [
    (context) => {
      const visit = (node) => {
        // A spread can supply geometry, systems and options together. Replacing that syntax as one positional
        // factory would erase forwarded arguments; leave forwarding wrappers intact.
        if (ts.isCallExpression(node) && !node.arguments.some(ts.isSpreadElement)) {
          const declaration = checker.getResolvedSignature(node)?.getDeclaration();
          const owner = declaration?.parent;
          if (
            declaration?.getSourceFile().fileName.replaceAll("\\", "/").endsWith("/lib/catalogue.ts") &&
            owner &&
            ts.isPropertyDeclaration(owner)
          ) {
            const method = owner.name.getText();
            const index =
              method === "part" || method === "shell"
                ? 0
                : method === "loftSurface"
                  ? 1
                  : method === "onSurface"
                    ? 2
                    : -1;
            const options =
              method === "part" ? node.arguments[2] : method === "onSurface" ? node.arguments[3] : undefined;
            if (index >= 0 && node.arguments[index] && !dynamic(options)) {
              changes++;
              const args = node.arguments.map((arg, i) => (i === index ? unavailable() : ts.visitNode(arg, visit)));
              return ts.factory.updateCallExpression(node, node.expression, node.typeArguments, args);
            }
            if (method === "surface" && node.arguments[0] && ts.isObjectLiteralExpression(node.arguments[0])) {
              const object = node.arguments[0];
              const properties = object.properties.map((property) => {
                if (ts.isPropertyAssignment(property) && property.name.getText() === "geo") {
                  changes++;
                  return ts.factory.updatePropertyAssignment(property, property.name, unavailable());
                }
                return ts.visitNode(property, visit);
              });
              return ts.factory.updateCallExpression(node, node.expression, node.typeArguments, [
                ts.factory.updateObjectLiteralExpression(object, properties),
                ...node.arguments.slice(1),
              ]);
            }
          }
        }
        // Analytic surface helpers remain usable; triangulation belongs to the independent recovery bundle.
        if (
          source.fileName.replaceAll("\\", "/").endsWith("/lib/skin-patch.ts") &&
          ts.isFunctionDeclaration(node) &&
          node.name?.text === "curvedSkinPatch"
        ) {
          changes++;
          return ts.factory.updateFunctionDeclaration(
            node,
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.typeParameters,
            node.parameters,
            node.type,
            unavailable().body,
          );
        }
        // These authoring refinements replace static factories after registration. Their notes/animation bindings stay.
        const refinement =
          /\/(lib\/hardware|aircraft\/cessna\/cabin-trim|aircraft\/[^/]+\/parts\/(hardware-detail|door-motion))\.ts$/.test(
            source.fileName.replaceAll("\\", "/"),
          );
        if (
          refinement &&
          ts.isBinaryExpression(node) &&
          node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
          ts.isPropertyAccessExpression(node.left) &&
          node.left.name.text === "geo"
        ) {
          changes++;
          return ts.factory.updateBinaryExpression(node, node.left, node.operatorToken, unavailable());
        }
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit);
    },
  ]);
  try {
    if (!changes) return null;
    const printed = ts.createPrinter().printFile(result.transformed[0]);
    // Erase imports made unused by stripping factories. Original TS is typechecked separately.
    const output = ts.transpileModule(printed, {
      fileName: source.fileName,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve },
    });
    return { code: output.outputText, changes, sourceDigest: digest(source.text) };
  } finally {
    result.dispose();
  }
}
