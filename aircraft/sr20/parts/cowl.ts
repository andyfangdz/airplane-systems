/** Cowl inlets: induction (right) and cooling (left). */
import * as THREE from "three";
import { cowlOpeningGeo } from "@/lib/geometry";
import { COWL_INLETS } from "../../cowl-inlets";
import { part } from "./catalogue";

/* ---------- cowl inlets ---------- */
COWL_INLETS.sr20.forEach(({ y, z, width, height, exponent }) => {
  const s = Math.sign(z);
  part(
    () => {
      const g = new THREE.TorusGeometry(0.075, 0.018, 8, 20);
      g.rotateY(Math.PI / 2);
      g.translate(3.748, y, z);
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
      return cowlOpeningGeo(() => 3.743, y, z, width, height, exponent);
    },
    ["engine", "airframe"],
    { color: "#0B1014", ext: true },
  );
});
