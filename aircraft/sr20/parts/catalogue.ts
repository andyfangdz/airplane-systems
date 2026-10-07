/**
 * SR20 catalogue: `CAT` with its label lists, and the helpers the section files share: the `part` / `shell` /
 * `surface` / `onSurf` wrappers and the per-frame part animations (no parts). The parts register in the section files;
 * `index.ts` imports them in order.
 */
import * as THREE from "three";
import { Catalogue, chanOfKey, type PartAnim, type PartSpec } from "@/lib/catalogue";
import { mats } from "@/lib/materials";
import { clamp, toVec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { sysNow } from "@/lib/anims";
import { loft, paintSkin, wingP } from "../geometry";
import { live } from "../model";
import { useSR20 } from "../store";

export { chanOfKey };

// The ADAHRS and GIAs sit behind the displays, and the bezels frame them: listed under "tap to locate" but not labelled, so
// their pins don't cover the screens (which carry their own labels on the top bezel edge, Airplane.tsx SCREENS).
export const CAT = new Catalogue("sr20", {
  quiet: { avionics: ["GSU 75 ADAHRS", "GIA 63W/64W ×2", "PFD bezel", "MFD bezel"] },
});
export const { part, surfacePivot } = CAT;
export const shell = (geo: () => THREE.BufferGeometry, name: string, note: string, skin = false) =>
  CAT.shell(geo, name, note, skin ? paintSkin : undefined);

/* ---------- per-frame part animations ---------- */
const firing = () => live.rpm > 100 && useSR20.getState().s.eng.key !== "OFF";
const keyFires = (mag: "R" | "L") => {
  const k = useSR20.getState().s.eng.key;
  return k === "BOTH" || k === "START" || k === mag;
};
export const fires = (mag: "R" | "L") => () => firing() && keyFires(mag);
/** Engine parts are live in the Overview and Engine views; the plugs also show (unlit) in the Propeller view. */
export const ENGINE: SysId[] = ["engine", "overview"];
export const altAnim =
  (which: "alt1" | "alt2"): PartAnim =>
  (m) => {
    const up = useSR20.getState().E[which],
      sys = sysNow();
    const show = sys === "overview" || sys === "electrical" || sys === "engine";
    m.material = !show ? mats("#D9960F").dim : up ? mats("#D9960F").hi : mats("#5A5040").on;
  };
export const selPtrAnim: PartAnim = (m) => {
  const sel = useSR20.getState().s.fuel.sel;
  m.rotation.y = sel === "L" ? Math.PI / 2 : sel === "R" ? -Math.PI / 2 : Math.PI;
};
export const altDoorAnim =
  (x0: number): PartAnim =>
  (m) => {
    m.position.x = x0 - (useSR20.getState().s.eng.altAir ? 0.05 : 0);
  };
/** Stall warning inlet span station (pitot.ts); here so `suctionAnim` doesn't import a later section. */
export const STALL_Z = 3.0;
export const suctionAnim: PartAnim = (m) => {
  const aoa = useSR20.getState().s.stall.aoa,
    xc = clamp(0.32 - (aoa / 14) * 0.32, 0, 0.32);
  m.position.copy(wingP(STALL_Z, xc, aoa >= 14 ? 0 : 1));
  m.visible = sysNow() === "pitot";
};

/* ---------- shell and control-surface helpers ---------- */
export const sided = (secs: THREE.Vector3[][], s: number) => (s < 0 ? secs.map((r) => r.reverse()) : secs);
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
/** Part attached to a moving control surface; `world` is converted to hinge-relative coords. */
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
