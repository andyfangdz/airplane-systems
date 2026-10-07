/**
 * The DA40 parts catalogue (`CAT`) and the helpers the section files share: the `part` / `shell` / `surface`
 * wrappers, `onSurf` for parts riding on a control surface, hinge-relative helpers for the canopy and door, and the
 * DA40's own per-frame part animations (the shared ones are in lib/anims.ts). No parts are registered here; see
 * index.ts for what is where.
 */
import * as THREE from "three";
import { Catalogue, type PartAnim, type PartSpec } from "@/lib/catalogue";
import { mats } from "@/lib/materials";
import { type Vec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { glowAnim, magFires } from "@/lib/anims";
import { paintSkin } from "../geometry";
import { live } from "../model";
import { useDA40 } from "../store";

export const CAT = new Catalogue("da40", {}, paintSkin);
export const { part, surfacePivot, shell, loftSurface: surface, onSurface: onSurf } = CAT;

/* ---------- per-frame part animations ---------- */
export const sim = () => useDA40.getState();
export const fires = (mag: "R" | "L") => () => live.rpm > 100 && magFires(mag, sim().s.eng.key);
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
