import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterAll, beforeAll, expect, it } from "vitest";

// Read through ts.readConfigFile below. Listing it to Vite (never loading it) makes it a dependency, so `vitest --changed`
// reruns this file when it changes.
import.meta.glob("../tsconfig.json");

// `next dev` writes .next/dev/types/validator.ts with imports this app never uses, and `next dev`/`next build` re-add the
// .next/dev/types include to tsconfig.json (node_modules/next/dist/lib/typescript/writeConfigurationDefaults.js), so the
// dev-only directory has to leave the program through `exclude`. Production route types in .next/types stay type-checked.
const fixtureFiles = [
  "next-env.d.ts",
  "app/page.tsx",
  ".next/types/validator.ts",
  ".next/types/routes.d.ts",
  ".next/dev/types/validator.ts",
  ".next/dev/types/routes.d.ts",
];
let directory = "";
let program: string[] = [];

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "tsconfig-dev-types-"));
  for (const file of fixtureFiles) {
    mkdirSync(dirname(join(directory, file)), { recursive: true });
    writeFileSync(join(directory, file), "export {};\n");
  }
  const config = ts.readConfigFile(fileURLToPath(new URL("../tsconfig.json", import.meta.url)), ts.sys.readFile);
  expect(config.error).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, directory);
  expect(parsed.errors).toEqual([]);
  program = parsed.fileNames.map((name) => relative(directory, name).split("\\").join("/")).sort();
});

afterAll(() => {
  if (directory) rmSync(directory, { recursive: true });
});

it("drops the dev server's generated types from the typecheck program and keeps the production build's route types", () => {
  expect(program.filter((name) => name.startsWith(".next/dev/"))).toEqual([]);
  expect(program).toEqual(
    expect.arrayContaining(["next-env.d.ts", "app/page.tsx", ".next/types/routes.d.ts", ".next/types/validator.ts"]),
  );
});
