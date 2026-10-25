/** Prepare the offline library before a hosting adapter seals its deployment asset inventory. */
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildOffline } from "./build-offline.mjs";

const adapterPath = fileURLToPath(import.meta.url);
const require = createRequire(import.meta.url);

async function loadPlatform() {
  const configured = process.env.NEXT_ADAPTER_PATH;
  if (!configured) throw new Error("The offline adapter requires NEXT_ADAPTER_PATH from the hosting platform.");
  const resolved = require.resolve(configured, { paths: [process.cwd()] });
  if (resolved === adapterPath) throw new Error("The hosting adapter cannot be the offline adapter itself.");
  const module = await import(pathToFileURL(resolved).href);
  return module.default ?? module;
}

/** Compose the platform's public Next adapter hooks, keeping all of its configuration and output handling. */
export function createOfflineAdapter(loadAdapter, prepare = buildOffline) {
  return {
    name: "Airplane Systems offline library",
    async modifyConfig(config, context) {
      const platform = await loadAdapter();
      const modified = platform.modifyConfig ? await platform.modifyConfig(config, context) : config;
      // Retain this hook even if the platform returns a new config object with its own adapter path.
      return { ...modified, adapterPath };
    },
    async onBuildComplete(context) {
      const platform = await loadAdapter();
      await prepare(context.projectDir, { adapterContext: context });
      // Next's default immutable route only lists its own emitted directories, not this content-addressed pack.
      context.routing.onMatch.push({
        sourceRegex: "^/_next/static/offline/[a-f0-9]{64}/.+$",
        headers: { "cache-control": "public,max-age=31536000,immutable" },
      });
      await platform.onBuildComplete?.(context);
    },
  };
}

export default createOfflineAdapter(loadPlatform);
