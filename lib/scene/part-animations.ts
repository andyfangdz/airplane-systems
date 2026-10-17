import type * as THREE from "three";
import { animatePart } from "../anims";
import { buildingIn } from "../build";
import type { PartSpec } from "../catalogue";
import { mats } from "../materials";

export interface PartAppearance {
  material: THREE.Material;
  active: boolean;
  focused: boolean;
  ghost: boolean;
}

interface Entry {
  mesh: THREE.Mesh;
  spec: PartSpec;
  appearance: PartAppearance;
  highlight: THREE.Material;
  canGlow: boolean;
}

/** One scene loop visits live animations and temporary build glows; settled static parts need no frame work. */
export class PartAnimations {
  private readonly animated = new Map<THREE.Mesh, Entry>();
  private readonly glowing = new Map<THREE.Mesh, Entry>();

  register(mesh: THREE.Mesh, spec: PartSpec, appearance: PartAppearance, color: string) {
    const entry: Entry = {
      mesh,
      spec,
      appearance,
      highlight: mats(color).hi,
      canGlow: appearance.active && !appearance.focused && !appearance.ghost && !spec.plate,
    };
    mesh.material = appearance.material;
    if (appearance.focused) mesh.visible = true;
    const list = spec.anim ? this.animated : this.glowing;
    if (spec.anim || (entry.canGlow && buildingIn(spec))) {
      list.set(mesh, entry);
      if (!spec.anim) mesh.material = entry.highlight;
    }
    return () => {
      if (list.get(mesh) === entry) list.delete(mesh);
    };
  }

  step(time: number) {
    let updated = 0;
    for (const entry of this.animated.values()) {
      animatePart(entry.mesh, time, entry.spec, entry.appearance);
      if (entry.canGlow && buildingIn(entry.spec)) entry.mesh.material = entry.highlight;
      updated++;
    }
    for (const [mesh, entry] of this.glowing) {
      if (!buildingIn(entry.spec)) {
        mesh.material = entry.appearance.material;
        this.glowing.delete(mesh);
      }
      updated++;
    }
    return updated;
  }

  get counts() {
    return { animated: this.animated.size, glowing: this.glowing.size };
  }

  clear() {
    this.animated.clear();
    this.glowing.clear();
  }
}
