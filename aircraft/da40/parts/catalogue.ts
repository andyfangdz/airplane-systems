/**
 * The DA40 parts catalogue (`CAT`) and the helpers the section files share: the `part` / `shell` / `surface`
 * wrappers, `onSurf` for parts riding on a control surface, hinge-relative helpers for the canopy and door, and the
 * DA40's own per-frame part animations (the shared ones are in lib/anims.ts). No parts are registered here; see
 * index.ts for what is where.
 */
import * as THREE from "three";
import { Catalogue, chanOfKey, type PartAnim, type PartSpec } from "@/lib/catalogue";
import { mats } from "@/lib/materials";
import { toVec3, type Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { glowAnim } from "@/lib/anims";
import { loft, paintSkin } from "../geometry";
import { live } from "../model";
import { useDA40 } from "../store";

export const CAT = new Catalogue("da40");
export const { part, surfacePivot } = CAT;
export const shell = (geo: () => THREE.BufferGeometry, name: string, note: string, skin = false) =>
  CAT.shell(geo, name, note, skin ? paintSkin : undefined);

/* ---------- per-frame part animations ---------- */
export const sim = () => useDA40.getState();
const firing = () => live.rpm > 100 && sim().s.eng.key !== "OFF";
const keyFires = (mag: "R" | "L") => {
  const k = sim().s.eng.key;
  return k === "BOTH" || k === "START" || k === mag;
};
export const fires = (mag: "R" | "L") => () => firing() && keyFires(mag);
/** Glows `lit` when cond() is true in the given systems' views. */
export const glow = (base: string, lit: string, cond: () => boolean, sys: SysId[]) => glowAnim(base, cond, sys, lit);
export const selPtrAnim: PartAnim = (m) => {
  const sel = sim().s.fuel.sel;
  m.rotation.y = sel === "L" ? Math.PI * 0.75 : sel === "R" ? Math.PI * 0.25 : -Math.PI * 0.25;
};
/** Throttle-quadrant lever knob slides fore/aft with its value. */
export const leverAnim =
  (x0: number, val: () => number): PartAnim =>
  (m) => {
    m.position.x = x0 - 0.05 + val() * 0.1;
  };
/** Nose-up trim rolls the top of the wheel aft (AFM 7-8: forward = nose down). */
export const trimWheelAnim: PartAnim = (m) => {
  m.rotation.z = live.afcs.trim * 2.6;
};
export const flapLight =
  (pos: 0 | 1 | 2, lit: string): PartAnim =>
  (m) => {
    const { E } = sim(),
      a = live.flapAng,
      th = [0, 20, 42][pos];
    const on =
      E.flapsPwr &&
      (Math.abs(a - th) < 1 ||
        (pos === 0 && a > 1 && a < 19) ||
        (pos === 1 && ((a > 1 && a < 19) || (a > 21 && a < 41))) ||
        (pos === 2 && a > 21 && a < 41));
    m.material = on ? mats(lit).hi : mats("#3A4249").on;
  };

/* ---------- hinge-relative helpers (canopy, door and the parts riding on them) ---------- */
export const rel = (g: THREE.BufferGeometry, o: Vec3) => {
  g.translate(-o[0], -o[1], -o[2]);
  return g;
};
export const relTo = (v: THREE.Vector3, o: Vec3): Vec3 => [v.x - o[0], v.y - o[1], v.z - o[2]];

/* ---------- control surfaces (pivot on their hinge lines) ---------- */
export function surface(
  key: string,
  secs: () => THREE.Vector3[][],
  a: THREE.Vector3,
  b: THREE.Vector3,
  sys: SysId[],
  name: string,
  note: string,
) {
  CAT.surface({
    key,
    pivot: toVec3(a),
    axis: toVec3(b.clone().sub(a).normalize()),
    sys,
    name,
    note,
    geo: () => {
      const g = loft(secs());
      g.translate(-a.x, -a.y, -a.z);
      return g;
    },
  });
}
/** Part attached to a moving control surface; `world` is converted to hinge-relative coordinates. */
export function onSurf(
  key: string,
  world: THREE.Vector3,
  geo: () => THREE.BufferGeometry,
  o: Omit<PartSpec, "id" | "geo" | "sys"> & { sys?: SysId[] },
) {
  const pv = surfacePivot(key);
  part(geo, o.sys || ["controls"], {
    chan: chanOfKey(key),
    ...o,
    parent: "surf:" + key,
    pos: [world.x - pv[0], world.y - pv[1], world.z - pv[2]],
  });
}
