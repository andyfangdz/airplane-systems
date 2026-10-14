import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

const exclude = [...configDefaults.exclude, "tests/deploy-aws*.test.ts"];
// Files that mock or stub, touch a zustand store or an airplane's mutable `live` object, or ask with `// vitest: isolate`
// keep a fresh module graph each. The rest (geometry and pure logic) share workers, so each worker imports the
// catalogues once and later files reuse them; such a file must not leave module state changed.
const MOCKS =
  /\bvi\.(mock|doMock|spyOn|stubGlobal|stubEnv|useFakeTimers)\b|\b(getState|setState|getInitialState)\(|\.update\(|\blive\.|\/\/ vitest: isolate/;
const isolated = readdirSync("tests", { recursive: true, encoding: "utf8" })
  .filter(
    (f) => f.endsWith(".test.ts") && !f.startsWith("deploy-aws") && MOCKS.test(readFileSync(`tests/${f}`, "utf8")),
  )
  .map((f) => `tests/${f}`);

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    setupFiles: ["tests/setup/geometry-cache.ts"],
    // `vitest run --changed <ref>` runs the test files whose imports reach a changed file (a test that reads files
    // through fs lists them with `import.meta.glob`); a change to one of these runs them all.
    forceRerunTriggers: [...configDefaults.forceRerunTriggers, "**/package-lock.json", "**/vendor/**"],
    projects: [
      { extends: true, test: { name: "isolated", include: isolated, exclude } },
      {
        extends: true,
        test: { name: "shared", include: ["tests/**/*.test.ts"], exclude: [...exclude, ...isolated], isolate: false },
      },
    ],
  },
});
