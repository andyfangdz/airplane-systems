import * as THREE from "three";
import { box, fRing, fs } from "../geometry";
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
[1, -1].forEach((s) => {
  part(
    () => {
      const g = new THREE.TorusGeometry(0.078, 0.01, 12, 32);
      g.rotateY(Math.PI / 2);
      g.translate(fs(0.47), 0.0, s * 0.26);
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
      const g = new THREE.CircleGeometry(0.078, 32);
      g.rotateY(Math.PI / 2);
      g.translate(fs(0.475), 0.0, s * 0.26);
      return g;
    },
    ["engine", "airframe"],
    { color: "#0B1014", ext: true },
  );
});
part(() => box(0.04, 0.05, 0.16), ["engine", "airframe"], {
  pos: [fs(0.6), -0.27, 0],
  color: "#1E2A33",
  ext: true,
  name: "Lower cowl inlet",
  note: "Third cowling intake (AFM 4A-9 lists 3). Its position is not given in the documents and is assumed here.",
});
