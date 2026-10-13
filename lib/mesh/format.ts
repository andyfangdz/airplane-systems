/** Portable geometry only: no scene, materials, source closures or simulation state crosses this boundary. */
export interface MeshAttribute {
  name: string;
  array: Float32Array;
  itemSize: number;
  normalized: boolean;
}
export interface BuiltMesh {
  key: string;
  attributes: MeshAttribute[];
  index: Uint16Array | Uint32Array | null;
  groups: { start: number; count: number; materialIndex?: number }[];
  /** Rendering can index repeated vertices; validation can recover the original triangle stream exactly. */
  unindexedSource: boolean;
}
export interface Stream {
  offset: number;
  length: number;
  count: number;
  stride: number;
}
export interface PackedMesh {
  key: string;
  attributes: (Stream & { name: string; normalized: boolean })[];
  index: Stream | null;
  groups: BuiltMesh["groups"];
  unindexedSource: boolean;
}
export interface MeshHeader {
  version: 1;
  aircraft: string;
  meshes: PackedMesh[];
}
export const MAGIC = 0x31475341; // ASG1, little endian

export function meshTransfers(meshes: BuiltMesh[]): ArrayBuffer[] {
  return meshes.flatMap((m) => [
    ...m.attributes.map((a) => a.array.buffer as ArrayBuffer),
    ...(m.index ? [m.index.buffer as ArrayBuffer] : []),
  ]);
}
