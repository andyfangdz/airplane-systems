/** Build-time only. Exact indexing preserves seams, normals, UVs and triangle order; no quantization or simplification. */
import type { BufferGeometry } from "three";
import { MeshoptEncoder } from "meshoptimizer/encoder";
import { MAGIC, type MeshHeader, type PackedMesh, type Stream } from "./format";

export async function encodeMeshes(aircraft: string, entries: { key: string; geometry: BufferGeometry }[]) {
  await MeshoptEncoder.ready;
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const stream = (bytes: Uint8Array, count: number, stride: number, index = false): Stream => {
    const encoded = index
      ? MeshoptEncoder.encodeIndexSequence(bytes, count, stride)
      : MeshoptEncoder.encodeVertexBuffer(bytes, count, stride);
    const descriptor = { offset, length: encoded.length, count, stride };
    offset += encoded.length;
    chunks.push(encoded);
    return descriptor;
  };
  const meshes: PackedMesh[] = entries.map(({ key, geometry: g }) => {
    if (Object.keys(g.morphAttributes).length || g.drawRange.start !== 0 || g.drawRange.count !== Infinity)
      throw new Error(`${key}: unsupported partial/morph geometry`);
    const attributes = Object.entries(g.attributes).map(([name, a]) => {
      if (!(a.array instanceof Float32Array) || "isInterleavedBufferAttribute" in a)
        throw new Error(`${key}/${name}: expected Float32 vertex attributes`);
      return { name, itemSize: a.itemSize, normalized: a.normalized, array: a.array };
    });
    const count = g.getAttribute("position").count;
    if (attributes.some((a) => a.array.length !== count * a.itemSize))
      throw new Error(`${key}: attribute count mismatch`);
    let index = g.index?.array as Uint16Array | Uint32Array | undefined;
    // Small geometry is cheaper to leave alone. Key on every attribute's bits, including signed zero.
    const unindexedSource = !index && count >= 300;
    if (unindexedSource) {
      const seen = new Map<string, number>();
      const words = attributes.map((a) => new Uint32Array(a.array.buffer, a.array.byteOffset, a.array.length));
      const unique = attributes.map(() => [] as number[]);
      const indices = new Uint32Array(count);
      for (let i = 0; i < count; i++) {
        let key = "";
        for (let a = 0; a < attributes.length; a++)
          for (let j = 0; j < attributes[a].itemSize; j++) key += `${words[a][i * attributes[a].itemSize + j]},`;
        let v = seen.get(key);
        if (v === undefined) {
          v = seen.size;
          seen.set(key, v);
          for (let a = 0; a < attributes.length; a++)
            for (let j = 0; j < attributes[a].itemSize; j++) unique[a].push(words[a][i * attributes[a].itemSize + j]);
        }
        indices[i] = v;
      }
      attributes.forEach((a, i) => (a.array = new Float32Array(new Uint32Array(unique[i]).buffer)));
      index = seen.size <= 65535 ? Uint16Array.from(indices) : indices;
    }
    return {
      key,
      attributes: attributes.map((a) => ({
        name: a.name,
        normalized: a.normalized,
        ...stream(
          new Uint8Array(a.array.buffer, a.array.byteOffset, a.array.byteLength),
          a.array.length / a.itemSize,
          a.itemSize * 4,
        ),
      })),
      index: index
        ? stream(
            new Uint8Array(index.buffer, index.byteOffset, index.byteLength),
            index.length,
            index.BYTES_PER_ELEMENT,
            true,
          )
        : null,
      groups: g.groups.map((group) => ({ ...group })),
      unindexedSource,
    };
  });
  const header: MeshHeader = { version: 1, aircraft, meshes };
  const json = new TextEncoder().encode(JSON.stringify(header));
  const result = new Uint8Array(8 + json.length + offset);
  const view = new DataView(result.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, json.length, true);
  result.set(json, 8);
  let at = 8 + json.length;
  for (const chunk of chunks) {
    result.set(chunk, at);
    at += chunk.length;
  }
  return result;
}
