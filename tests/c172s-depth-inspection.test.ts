import * as THREE from "three";
import { afterEach, describe, expect, it } from "vitest";
import { CAT } from "@/aircraft/c172s/parts";
import { animatePart } from "@/lib/anims";
import { partSide, spotsPart } from "@/lib/spot";
import { useView } from "@/lib/view";

const names = ["Wing tip", "Wing leading edge", "Cowling inspection region"],
  patches = CAT.parts.filter((p) => names.includes(p.name ?? ""));
const prior = useView.getState();
afterEach(() => useView.setState({ spot: prior.spot, focus: prior.focus, xray: prior.xray }));
describe("C172S narrow inspection overlays", () => {
  it.each([false, true])("leave the normal finish unobstructed with X-ray=%s", (xray) => {
    useView.setState({ spot: null, focus: null, xray });
    expect(patches).toHaveLength(5);
    for (const spec of patches) {
      const mesh = new THREE.Mesh();
      const material = new THREE.MeshBasicMaterial();
      animatePart(mesh, 0, spec, { material, active: true, focused: false, ghost: xray });
      expect(mesh.visible, spec.name).toBe(false);
      material.dispose();
    }
  });
  it("reveals only the requested side and restores hiding after a spotlight clears", () => {
    const material = new THREE.MeshBasicMaterial();
    for (const name of names)
      for (const side of [-1, 1] as const) {
        const spot = { names: [name], side };
        useView.setState({ spot, focus: null });
        for (const spec of patches) {
          const geo = spec.geo(),
            mesh = new THREE.Mesh(geo);
          const spotted = spotsPart(spot, spec, geo, CAT);
          animatePart(mesh, 0, spec, { material, active: spotted, focused: spotted, ghost: false });
          expect(mesh.visible, `${name}/${side}/${spec.name}/${partSide(spec, geo, CAT)}`).toBe(spotted);
          useView.setState({ spot: null });
          animatePart(mesh, 0, spec, { material, active: true, focused: false, ghost: false });
          expect(mesh.visible).toBe(false);
          useView.setState({ spot });
          geo.dispose();
        }
      }
    material.dispose();
  });
  it("allows tap-to-locate focus to reveal a hidden region using the scene animation policy", () => {
    useView.setState({ spot: null });
    const material = new THREE.MeshBasicMaterial();
    for (const spec of patches) {
      const mesh = new THREE.Mesh();
      animatePart(mesh, 0, spec, { material, active: false, focused: false, ghost: false });
      expect(mesh.visible).toBe(false);
      animatePart(mesh, 0, spec, { material, active: true, focused: true, ghost: false });
      expect(mesh.visible).toBe(true);
      expect(mesh.material).toBe(material);
      animatePart(mesh, 0, spec, { material, active: true, focused: false, ghost: false });
      expect(mesh.visible).toBe(false);
    }
    material.dispose();
  });
});
