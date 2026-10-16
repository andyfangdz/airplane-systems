import { configDefaults, defineConfig } from "vitest/config";
import config from "./vitest.config.mts";

// Project includes override root selection, so omit the inherited projects.
const { projects: _projects, ...test } = config.test!;

// Reuse the aliases; the deploy suite is explicitly opt-in.
export default defineConfig({
  ...config,
  test: { ...test, include: ["tests/deploy-aws*.test.ts"], exclude: configDefaults.exclude },
});
