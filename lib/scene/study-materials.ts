import type { MeshStandardMaterial } from "three";
import { mats } from "../materials";
import type { Theme } from "../systems";

const study = new Map<string, MeshStandardMaterial>();

/** Keep each system's hue, but give its selected X-ray path more contrast against the pale airframe. */
export function studyMaterial(color: string, theme: Theme) {
  if (theme === "dark") return mats(color).on;
  let material = study.get(color);
  if (!material) {
    material = mats(color).on.clone();
    material.color.multiplyScalar(0.6);
    material.emissive.multiplyScalar(0.25);
    study.set(color, material);
  }
  return material;
}
