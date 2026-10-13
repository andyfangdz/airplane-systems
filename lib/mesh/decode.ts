import { MeshoptDecoder } from "meshoptimizer/decoder";
import { MAGIC, type BuiltMesh, type MeshHeader, type Stream } from "./format";

/** A corrupt, stale or unsupported asset is rejected as a whole; the caller retains procedural generation. */
export async function decodeMeshes(data: ArrayBuffer, aircraft: string): Promise<BuiltMesh[]> {
  const view = new DataView(data);
  if (data.byteLength < 8 || view.getUint32(0, true) !== MAGIC) throw new Error("Invalid geometry asset");
  const size = view.getUint32(4, true);
  if (size > data.byteLength - 8) throw new Error("Truncated geometry header");
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 8, size))) as MeshHeader;
  if (header.version !== 1 || header.aircraft !== aircraft || !Array.isArray(header.meshes))
    throw new Error("Geometry version/aircraft mismatch");
  await MeshoptDecoder.ready;
  const payload = 8 + size;
  let allocated = 0;
  const read = (s: Stream, index: boolean) => {
    if (
      ![s.offset, s.length, s.count, s.stride].every(Number.isSafeInteger) ||
      s.offset < 0 ||
      s.length <= 0 ||
      s.count <= 0 ||
      s.stride <= 0 ||
      (index ? ![2, 4].includes(s.stride) : s.stride % 4 !== 0 || s.stride > 16) ||
      s.offset + s.length > data.byteLength - payload
    )
      throw new Error("Invalid geometry stream");
    allocated += s.count * s.stride;
    if (allocated > 256 * 1024 * 1024) throw new Error("Geometry allocation limit exceeded");
    const result = new Uint8Array(s.count * s.stride);
    const source = new Uint8Array(data, payload + s.offset, s.length);
    if (index) MeshoptDecoder.decodeIndexSequence(result, s.count, s.stride, source);
    else MeshoptDecoder.decodeVertexBuffer(result, s.count, s.stride, source);
    return result.buffer;
  };
  const keys = new Set<string>();
  return header.meshes.map((m) => {
    if (typeof m.key !== "string" || keys.has(m.key) || !Array.isArray(m.attributes) || !Array.isArray(m.groups))
      throw new Error("Invalid geometry entry");
    keys.add(m.key);
    const names = new Set<string>();
    const attributes = m.attributes.map((a) => {
      if (typeof a.name !== "string" || names.has(a.name)) throw new Error("Invalid geometry attribute");
      names.add(a.name);
      return {
        name: a.name,
        array: new Float32Array(read(a, false)),
        itemSize: a.stride / 4,
        normalized: !!a.normalized,
      };
    });
    const position = attributes.find((a) => a.name === "position");
    if (!position || position.itemSize !== 3) throw new Error("Missing geometry positions");
    const count = position.array.length / 3;
    if (attributes.some((a) => a.array.length / a.itemSize !== count))
      throw new Error("Inconsistent geometry attributes");
    const index = m.index
      ? m.index.stride === 2
        ? new Uint16Array(read(m.index, true))
        : new Uint32Array(read(m.index, true))
      : null;
    if (index?.some((i) => i >= count) || (index?.length ?? count) % 3) throw new Error("Invalid triangle indices");
    if (
      m.groups.some(
        (g) =>
          !Number.isSafeInteger(g.start) ||
          !Number.isSafeInteger(g.count) ||
          g.start < 0 ||
          g.count < 0 ||
          g.start + g.count > (index?.length ?? count),
      )
    )
      throw new Error("Invalid geometry groups");
    return { key: m.key, attributes, index, groups: m.groups, unindexedSource: !!m.unindexedSource };
  });
}
