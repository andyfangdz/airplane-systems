import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import sharedTests from "./tests/setup/shared-tests.json" with { type: "json" };

const exclude = [...configDefaults.exclude, "tests/deploy-aws*.test.ts"];

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    setupFiles: ["tests/setup/geometry-cache.ts"],
    // `vitest run --changed <ref>` runs the test files whose imports reach a changed file (a test that reads files
    // through fs lists them with `import.meta.glob`); a change to one of these runs them all.
    forceRerunTriggers: [
      ...configDefaults.forceRerunTriggers,
      "**/package-lock.json",
      "**/vendor/**",
      "**/tests/setup/shared-tests.json",
    ],
    projects: [
      // Isolation is the default, including for tests added later. Sharing catalogue construction is an explicit
      // contract recorded in one allowlist, never inferred from how a test happens to spell a mutation or mock.
      {
        extends: true,
        test: {
          name: "isolated",
          include: ["tests/**/*.test.ts"],
          exclude: [...exclude, ...sharedTests],
          isolate: true,
        },
      },
      { extends: true, test: { name: "shared", include: sharedTests, exclude, isolate: false } },
    ],
  },
});
