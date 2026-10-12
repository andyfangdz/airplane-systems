/** Small skin-conformal selection regions for POH4-7–10 external inspection. */
import * as THREE from "three";
import { AF, onSkin, X, Y, Z } from "../geometry";
import { part } from "./catalogue";
function patch(at: (u: number, v: number) => THREE.Vector3) {
  const a: number[] = [],
    ix: number[] = [];
  for (let j = 0; j <= 8; j++) for (let i = 0; i <= 16; i++) a.push(...at(i / 16, j / 8).toArray());
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 16; i++) {
      const n = j * 17 + i;
      ix.push(n, n + 1, n + 17, n + 1, n + 18, n + 17);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(a, 3));
  g.setIndex(ix);
  g.computeVertexNormals();
  return g;
}
for (const side of [-1, 1]) {
  part(
    () => patch((u, v) => AF.wingP(Z(side * (207 + 6 * u)), 0.03 + 0.8 * v, 1).add(new THREE.Vector3(0, 0.0005, 0))),
    ["airframe"],
    {
      name: "Wing tip",
      note: "Narrow wing-tip inspection surface: POH4-7/4-10 requires lights and general condition. Skin region is a visual selection aid, not an added structural component.",
      pin: side > 0,
      ext: true,
      fairing: true,
      color: "#D3DCE2",
    },
  );
  part(
    () => patch((u, v) => AF.wingP(Z(side * (27 + 179 * u)), 0.008 + 0.06 * v, 1).add(new THREE.Vector3(0, 0.0005, 0))),
    ["airframe"],
    {
      name: "Wing leading edge",
      note: "Narrow upper leading-edge inspection surface for condition checks (POH4-7/4-10). Each side is a separate selection mesh; no unsupported stall strip is added.",
      pin: side > 0,
      ext: true,
      fairing: true,
      color: "#D3DCE2",
    },
  );
}
part(() => patch((u, v) => onSkin(X(-15 + 10 * u), Y(54 + 7 * v), 1, 1.001)), ["airframe", "engine"], {
  name: "Cowling inspection region",
  note: "Narrow right-upper cowling/oil-access inspection region (POH4-8). Conformal selection surface, not a second cowling or a service-door dimension claim.",
  pin: true,
  ext: true,
  fairing: true,
  color: "#D3DCE2",
});
