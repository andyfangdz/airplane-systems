#!/usr/bin/env node
/** Keep application-wide compilation working: no silent skipped components or opt-out directives. */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { transformSync } from "@babel/core";
import compiler from "babel-plugin-react-compiler";

const root = resolve(import.meta.dirname, "..");
let compiled = 0;
let failures = 0;
for (const dir of ["app", "components", "aircraft", "lib"]) {
  for (const entry of readdirSync(join(root, dir), { recursive: true })) {
    if (!/\.tsx?$/.test(entry) || entry.endsWith(".d.ts")) continue;
    const file = join(dir, entry);
    const source = readFileSync(join(root, file), "utf8");
    if (!/use[A-Z]|<[A-Za-z]/.test(source)) continue;
    try {
      transformSync(source, {
        filename: file,
        configFile: false,
        babelrc: false,
        parserOpts: { plugins: ["typescript", ...(file.endsWith(".tsx") ? ["jsx"] : [])] },
        plugins: [
          [
            compiler,
            {
              target: "19",
              panicThreshold: "all",
              logger: {
                logEvent(filename, event) {
                  if (event.kind === "CompileSuccess") compiled++;
                  if (event.kind === "CompileSkip") throw new Error(`${filename}: ${event.reason}`);
                },
              },
            },
          ],
        ],
      });
    } catch (error) {
      failures++;
      console.error(`${file}: ${error.message}`);
    }
  }
}
console.log(`React Compiler: ${compiled} functions compiled; ${failures} files failed.`);
if (failures) process.exitCode = 1;
