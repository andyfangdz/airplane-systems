import * as THREE from "three";
import type { Catalogue } from "@/lib/catalogue";
import { loft, mergeGeos, roundPoly } from "@/lib/geometry";
import { FUSE } from "../geometry";
import { FALCON_PEARL } from "../paint";

// The rollout close-up and overhead drawing show a shallow centerline installation
// just forward of the windshield. Outline, glazing rake and lens spacing are schematic.
const centerX = 11.46;
const rake = 0.48;
const smokedOptic = new THREE.MeshPhysicalMaterial({
  color: "#152831",
  roughness: 0.16,
  metalness: 0.25,
  clearcoat: 1,
});
const windowPlane = (x: number, z: number, offset: number) =>
  new THREE.Vector3(x, FUSE.topY(centerX) + 0.02 - (x - centerX) * rake - z * z * 0.45 + offset, z);

function face(scale: number, offset: number) {
  return roundPoly(
    [
      [-0.107, -0.14],
      [-0.107, 0.14],
      [0.083, 0.128],
      [0.083, -0.128],
    ],
    0.27,
    3,
  ).map(([x, z]) => windowPlane(centerX + x * scale, z * scale, offset));
}

export function addFalconEye(cat: Catalogue) {
  cat.part(
    () => {
      const crown = face(1.12, 0);
      const base = crown.map((p) => {
        const x = p.x + (p.x < centerX ? -0.036 : 0.042);
        return new THREE.Vector3(x, FUSE.topY(x) - 0.03, p.z * 1.08);
      });
      return loft([base, crown]);
    },
    ["avionics", "airframe"],
    {
      id: "avionics.falconeye-camera",
      name: "FalconEye nose camera",
      note: "Four lenses serve six sensors. Daylight, low-light and thermal imagery feed the enhanced-vision layer of the head-up display.",
      solidColor: FALCON_PEARL,
      pin: true,
      ext: true,
    },
  );
  cat.part(() => loft([face(1.03, 0.001), face(1, 0.005)]), ["avionics", "airframe"], {
    id: "avionics.falconeye-window",
    name: "Camera optical window",
    solidColor: "#152331",
    ext: true,
  });
  // The four optical paths are represented behind the dark face. The site's camera
  // photographs establish the window outline, but do not resolve individual lens diameters.
  cat.part(
    () =>
      mergeGeos(
        [-0.091, -0.03, 0.03, 0.091].map((z) => {
          const p = windowPlane(centerX - 0.01, z, 0.006);
          const lensProfile = [
            [0.018, -0.002],
            [0.019, 0],
            [0.017, 0.0015],
            [0.009, 0.003],
            [0, 0.0032],
          ];
          return new THREE.LatheGeometry(
            lensProfile.map(([r, y]) => new THREE.Vector2(r, y)),
            24,
          )
            .rotateZ(-Math.atan(rake))
            .translate(p.x, p.y, p.z);
        }),
      ),
    ["avionics", "airframe"],
    { id: "avionics.falconeye-optics", name: "FalconEye optics", solidMaterial: () => smokedOptic, ext: true },
  );
}
