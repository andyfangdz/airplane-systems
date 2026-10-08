import * as THREE from "three";
import { cowlOpeningGeo, mergeGeos } from "@/lib/geometry";
import { COWL_INLETS } from "../../cowl-inlets";
import { FUSE, fRing, fs } from "../geometry";
import { part, shell } from "./catalogue";

/* ---------- cowling inlets, exhaust ---------- */
shell(
  () => {
    const x0 = fs(0.465),
      ring = fRing(x0, 1, 64, 0, 2 * Math.PI, false);
    const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(-p.z, p.y)));
    const hole = (cz: number, cy: number, r: number) => {
      const h = new THREE.Path();
      h.absarc(-cz, cy, r, 0, Math.PI * 2, true);
      return h;
    };
    shape.holes.push(hole(0, 0, 0.168), hole(0.26, 0, 0.076), hole(-0.26, 0, 0.076));
    const g = new THREE.ShapeGeometry(shape, 24);
    g.rotateY(Math.PI / 2);
    g.translate(x0, 0, 0);
    return g;
  },
  "Cowling nose",
  "Front face of the cowling around the spinner, with the two round cooling-air inlets (AFM 4A-9).",
);
COWL_INLETS.da40.slice(0, 2).forEach(({ y, z, width, height, exponent }) => {
  const s = Math.sign(z);
  part(
    () => {
      const g = new THREE.TorusGeometry(0.078, 0.01, 12, 32);
      g.rotateY(Math.PI / 2);
      g.translate(fs(0.47), y, z);
      return g;
    },
    ["engine", "airframe"],
    {
      color: "#1E2A33",
      ext: true,
      pin: true,
      name: s > 0 ? "Right cowl inlet" : "Left cowl inlet",
      note:
        s > 0
          ? "One of the 3 cowling air intakes (AFM 4A-9). An unofficial DA40 technical description says the right intake feeds the engine induction, the oil cooler, cabin heat and battery/alternator cooling."
          : "Cooling-air inlet beside the spinner (AFM 4A-9: 3 air intakes … clear).",
    },
  );
  part(
    () => {
      return cowlOpeningGeo(() => fs(0.478), y, z, width, height, exponent);
    },
    ["engine", "airframe"],
    { color: "#0B1014", ext: true },
  );
});
part(
  () => {
    const { y, z, width, height, exponent } = COWL_INLETS.da40[2];
    return mergeGeos([true, false].map((lip) => cowlOpeningGeo(FUSE.frontX, y, z, width, height, exponent, lip)));
  },
  ["engine", "airframe"],
  {
    color: "#1E2A33",
    ext: true,
    name: "Lower cowl inlet",
    note: "Third cowling intake (AFM 4A-9 lists 3). Its position is not given in the documents and is assumed here.",
  },
);
