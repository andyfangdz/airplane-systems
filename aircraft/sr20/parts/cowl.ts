/** Cowl inlets: induction (right) and cooling (left). */
import * as THREE from "three";
import { part } from "./catalogue";

/* ---------- cowl inlets ---------- */
[1, -1].forEach((s) => {
  part(
    () => {
      const g = new THREE.TorusGeometry(0.075, 0.018, 8, 20);
      g.rotateY(Math.PI / 2);
      g.translate(3.7, -0.13, s * 0.22);
      return g;
    },
    ["engine", "airframe"],
    {
      color: "#1E2A33",
      ext: true,
      pin: true,
      name: s > 0 ? "Right cowl inlet — induction" : "Left cowl inlet — cooling",
      note:
        s > 0
          ? "Primary induction intake: air passes the filter screen just inside this inlet. Cooling air also enters here. If it clogs, use ALT AIR. (Costanzo deck)"
          : "Cooling air over the cylinder baffles.",
    },
  );
  part(
    () => {
      const g = new THREE.CircleGeometry(0.075, 20);
      g.rotateY(Math.PI / 2);
      g.translate(3.695, -0.13, s * 0.22);
      return g;
    },
    ["engine", "airframe"],
    { color: "#0B1014", ext: true },
  );
});
