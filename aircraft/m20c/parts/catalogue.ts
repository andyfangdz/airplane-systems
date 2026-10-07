/**
 * The M20C parts catalogue (`CAT`) and the helpers the section files share: the `part` / `shell` wrappers, `surface` and
 * `onSurf` with a `tail` flag for pieces that ride in the pivoting empennage group, hinge-relative helpers for that
 * group, and the M20C's own per-frame animations (the shared ones are in lib/anims.ts). No parts are registered here;
 * see index.ts for what is where.
 */
import * as THREE from "three";
import { brakeAmount, brakeAnim, glowAnim, magFires, pushPull, sysNow } from "@/lib/anims";
import { Catalogue, chanOfKey, type PartAnim, type PartSpec } from "@/lib/catalogue";
import { V, type Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { TAIL_PIVOT, loft, paintSkin, withUv } from "../geometry";
import { live } from "../model";
import { useM20C } from "../store";

export const CAT = new Catalogue("m20c", {}, paintSkin);
export const { part, surfacePivot, shell } = CAT;
export { sysNow };

export const P = (v: THREE.Vector3): Vec3 => [v.x, v.y, v.z];
export const sim = () => useM20C.getState();
/** Magneto `mag` is firing: the engine turns and the switch feeds it (OM p. 2). */
export const fires = (mag: "R" | "L") => () => live.rpm > 100 && magFires(mag, sim().s.eng.key);
/** Glows `lit` when cond() is true in the given systems' views. */
export const glow = (base: string, lit: string, cond: () => boolean, sys: SysId[]) => glowAnim(base, cond, sys, lit);
export const brake = (side: "R" | "L") => brakeAnim(() => brakeAmount(sim().s.gear, side));
/** Push-pull knob slides out of the panel with its value (0 = pushed in, 1 = pulled full out). */
export const knobAnim = (x0: number, val: () => number, travel = 0.07): PartAnim =>
  pushPull(x0, () => 1 - val(), travel);
export const trimWheelAnim: PartAnim = (m) => {
  m.rotation.z = sim().s.ctrl.trim * 2.6;
};

/* ---------- the pivoting tail: geometry and positions relative to TAIL_PIVOT ---------- */
export const relT = (g: THREE.BufferGeometry) => {
  g.translate(-TAIL_PIVOT[0], -TAIL_PIVOT[1], -TAIL_PIVOT[2]);
  return g;
};
export const relTv = (v: THREE.Vector3 | Vec3): Vec3 => {
  const a = Array.isArray(v) ? v : [v.x, v.y, v.z];
  return [a[0] - TAIL_PIVOT[0], a[1] - TAIL_PIVOT[1], a[2] - TAIL_PIVOT[2]];
};

/** Control surface lofted through `secs` and hinged on a→b; `tail` places it in the empennage group; `skin` paints it. */
export function surface(
  key: string,
  secs: () => THREE.Vector3[][],
  a: THREE.Vector3,
  b: THREE.Vector3,
  sys: SysId[],
  name: string,
  note: string,
  tail = false,
  skin?: () => THREE.Texture,
) {
  const pv = tail ? V(...relTv(a)) : a;
  CAT.surface({
    key,
    pivot: P(pv),
    axis: P(b.clone().sub(a).normalize()),
    sys,
    name,
    note,
    skin,
    geo: () => {
      const g = withUv(loft(secs()));
      g.translate(-a.x, -a.y, -a.z);
      return g;
    },
  });
}
/** Part attached to a moving control surface; `world` is converted to hinge-relative coordinates (through the tail group when `tail`). */
export function onSurf(
  key: string,
  world: THREE.Vector3,
  geo: () => THREE.BufferGeometry,
  o: Omit<PartSpec, "id" | "geo" | "sys"> & { sys?: SysId[] },
  tail = false,
) {
  const pv = surfacePivot(key),
    w = tail ? relTv(world) : P(world);
  part(geo, o.sys || ["controls"], {
    chan: chanOfKey(key),
    ...o,
    parent: "surf:" + key,
    pos: [w[0] - pv[0], w[1] - pv[1], w[2] - pv[2]],
  });
}
