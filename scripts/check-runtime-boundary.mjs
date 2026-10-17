#!/usr/bin/env node
/** Inspect emitted Turbopack chunk membership, not source-import text. Requires next build --experimental-analyze. */
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

const root = resolve(process.argv[2] || ".next/diagnostics/analyze/data");
async function files(path) {
  return (
    await Promise.all(
      (await readdir(path, { withFileTypes: true })).map((entry) =>
        entry.isDirectory() ? files(resolve(path, entry.name)) : [resolve(path, entry.name)],
      ),
    )
  ).flat();
}
const paths = (await files(root)).filter((path) => path.endsWith("/analyze.data"));
if (!paths.length) throw new Error("No Turbopack analysis artifacts; build with --experimental-analyze first");
const forbidden =
  /(?:node_modules\/(?:cdt2d|polygon-clipping|robust-in-sphere)\/|\/authoring\/|\/lib\/mesh\/encode\.ts$)/;
const failures = new Set();
let checked = 0;
for (const path of paths) {
  const bytes = await readFile(path);
  const length = bytes.readUInt32BE(0);
  const header = JSON.parse(bytes.toString("utf8", 4, 4 + length));
  const binary = bytes.subarray(4 + length);
  const fullPath = (i) => {
    const source = header.sources[i];
    return source.parent_source_index === null ? source.path : fullPath(source.parent_source_index) + source.path;
  };
  const edges = (reference, index) => {
    if (!reference.length) return [];
    const offset = reference.offset;
    const count = binary.readUInt32BE(offset);
    if (index >= count) return [];
    const previous = index ? binary.readUInt32BE(offset + index * 4) : 0;
    const end = binary.readUInt32BE(offset + 4 + index * 4);
    const start = offset + 4 + count * 4;
    return Array.from({ length: end - previous }, (_, i) => binary.readUInt32BE(start + (previous + i) * 4));
  };
  header.sources.forEach((_, i) => {
    const source = fullPath(i);
    for (const part of edges(header.source_chunk_parts, i)) {
      const chunk = header.chunk_parts[part];
      const output = header.output_files[chunk.output_file_index];
      if (!output.filename.startsWith("[client-fs]/") || chunk.size === 0) continue;
      checked++;
      if (forbidden.test(source)) failures.add(`${relative(root, path)}: ${source} in ${output.filename}`);
    }
  });
}
if (!checked) throw new Error("Analysis contains no emitted client modules; boundary check cannot establish coverage");
if (failures.size) throw new Error(`Authoring code entered production client chunks:\n${[...failures].join("\n")}`);
console.log(
  `Runtime boundary: ${paths.length} route graphs, ${checked} emitted client module memberships; no triangulation, polygon clipping, geometry encoder or authoring modules.`,
);
