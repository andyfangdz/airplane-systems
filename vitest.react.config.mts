import { fileURLToPath } from "node:url";
import { transformSync } from "@babel/core";
import { defineConfig } from "vitest/config";
import compiler from "babel-plugin-react-compiler";

// Exercise the memoized code that Next ships, rather than testing only the uncompiled source.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  plugins: [
    {
      name: "react-compiler-regressions",
      enforce: "pre",
      transform(source, id) {
        if (
          (!/\/(aircraft|components|lib)\/.*\.tsx?$/.test(id) && !id.endsWith("/tests/react/fixtures.tsx")) ||
          !/use[A-Z]|<[A-Za-z]/.test(source)
        )
          return;
        const result = transformSync(source, {
          filename: id,
          configFile: false,
          babelrc: false,
          parserOpts: { plugins: ["typescript", ...(id.endsWith(".tsx") ? ["jsx" as const] : [])] },
          plugins: [[compiler, { target: "19", panicThreshold: "all" }]],
          sourceMaps: true,
        });
        return { code: result!.code!, map: result!.map };
      },
    },
  ],
  test: {
    include: ["tests/react/**/*.test.tsx"],
    environment: "jsdom",
    maxWorkers: 1,
  },
});
