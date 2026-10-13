import { decodeMeshes } from "./decode";
import { meshTransfers } from "./format";

self.onmessage = async ({ data }: MessageEvent<{ path: string; aircraft: string }>) => {
  try {
    const response = await fetch(data.path);
    if (!response.ok || !response.body) throw new Error(`Geometry download: HTTP ${response.status}`);
    // Explicit gzip assets also work on static hosts without Content-Encoding configuration.
    const bytes = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
    const meshes = await decodeMeshes(bytes, data.aircraft);
    postMessage({ meshes }, { transfer: meshTransfers(meshes) });
  } catch (error) {
    postMessage({ error: String(error) });
  }
};
