import { resolve } from "node:path";
import { expect, it } from "vitest";
import ts from "typescript";
import { specializeSource } from "../scripts/geometry/specialize.mjs";

// Compiler reads these through TypeScript's host; keep changed-test dependency tracking explicit.
import.meta.glob([
  "../lib/catalogue.ts",
  "../lib/skin-patch.ts",
  "../aircraft/sr20/parts/controls-trim.ts",
  "../aircraft/sr20/parts/avionics.ts",
  "../aircraft/c182t/parts/systems-depth.ts",
  "../lib/cabin-trim.ts",
]);

it("specializes only Catalogue factories, preserving dynamic geometry and runtime animation closures", () => {
  const root = resolve(".");
  const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram([resolve(root, "aircraft/sr20/parts/index.ts")], parsed.options);
  const source = program.getSourceFile(resolve(root, "aircraft/sr20/parts/controls-trim.ts"))!;
  const result = specializeSource(program, source)!;
  const code = ts.createSourceFile("runtime.js", result.code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let dynamic = 0,
    staticFactories = 0;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(code) === "part") {
      const factory = node.arguments[0];
      const opts = node.arguments[2];
      if (
        opts &&
        ts.isObjectLiteralExpression(opts) &&
        opts.properties.some(
          (p) =>
            ts.isPropertyAssignment(p) &&
            p.name.getText(code) === "dynamicGeo" &&
            p.initializer.kind === ts.SyntaxKind.TrueKeyword,
        )
      ) {
        dynamic++;
        expect(factory.getText(code)).not.toContain("Compiled geometry is not ready");
      } else {
        staticFactories++;
        expect(factory.getText(code)).toContain("Compiled geometry is not ready");
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(code);
  expect(dynamic).toBeGreaterThan(0);
  expect(staticFactories).toBeGreaterThan(0);
  expect(result.code).toContain("anim:");
  const skin = specializeSource(program, program.getSourceFile(resolve(root, "lib/skin-patch.ts"))!)!;
  expect(skin.code).not.toContain('from "cdt2d"');
  const trim = specializeSource(program, program.getSourceFile(resolve(root, "lib/cabin-trim.ts"))!)!;
  expect(trim.code).not.toContain('from "polygon-clipping"');
}, 20_000);

it("preserves spread forwarding of Catalogue geometry, systems and options", () => {
  const root = resolve(".");
  const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram([resolve(root, "aircraft/c182t/parts/index.ts")], parsed.options);
  const source = program.getSourceFile(resolve(root, "aircraft/c182t/parts/systems-depth.ts"))!;
  const output = specializeSource(program, source)?.code ?? source.text;
  expect(output).toContain("part(...args)");
  // The actual helper must still receive its factory, system tags and required authored identity.
  const js = ts.transpileModule(output, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const compiled = ts.createSourceFile("compiled.js", js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  let wrapper: string | undefined;
  const findWrapper = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(compiled) === "add")
      wrapper = node.initializer!.getText(compiled);
    ts.forEachChild(node, findWrapper);
  };
  findWrapper(compiled);
  expect(wrapper).toBeDefined();
  const registration = new Function("part", "SYSTEM_DEPTH_PARTS", `return (${wrapper});`);
  const records: unknown[] = [];
  const factory = () => "geometry";
  const options = { id: "fixture", name: "Contactor" };
  const add = registration((geo: unknown, sys: unknown, opts: unknown) => ({ geo, sys, opts }), records);
  expect(add(factory, ["electrical"], options)).toEqual({ geo: factory, sys: ["electrical"], opts: options });
  expect(records).toHaveLength(1);
}, 20_000);
