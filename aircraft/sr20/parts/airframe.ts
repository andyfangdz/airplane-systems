/** Airframe shells: fuselage, spinner, wings, trailing edges, stabilizers and fin. */
import * as THREE from "three";
import { EF, HF, HZ, SSPAN, WR, finCut, finHs, finSec, fuselageGeo, loft, stabSec, wingSec } from "../geometry";
import { shell, sided } from "./catalogue";

/* ---------- airframe shells ---------- */
shell(
  fuselageGeo,
  "Fuselage",
  "Composite monocoque with integral roll cage. Cabin runs from the firewall (FS 100) to the aft baggage bulkhead (FS 222).",
  true,
);
shell(
  () => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      pts.push(new THREE.Vector2(0.155 * Math.sqrt(1 - t * t * 0.97), t * 0.42));
    }
    const g = new THREE.LatheGeometry(pts, 32);
    g.rotateZ(-Math.PI / 2);
    g.translate(3.74, -0.13, 0);
    return g;
  },
  "Spinner",
  "Covers the constant-speed propeller hub.",
);
const wingSpanSt = [WR, 0.9, 1.6, 2.4, 3.2, 4.0, 4.6, 5.2, 5.45, 5.65, 5.78, 5.84];
[1, -1].forEach((s) => {
  shell(
    () =>
      loft(
        sided(
          wingSpanSt.map((z) => wingSec(s * z, 0, 0.75)),
          s,
        ),
      ),
    s > 0 ? "Right wing" : "Left wing",
    "Composite torsion box: carbon spar, ribs and bonded skins. Holds a 29.3 gal integral fuel tank and the main gear.",
  );
  [
    [WR, 0.94],
    [3.62, 3.68],
    [5.0, 5.2, 5.45, 5.65, 5.78, 5.84],
  ].forEach((st) =>
    shell(
      () =>
        loft(
          sided(
            st.map((z) => wingSec(s * z, 0.75, 1)),
            s,
          ),
        ),
      "Wing trailing edge",
      "",
    ),
  );
  shell(
    () =>
      loft(
        sided(
          [
            ...[0, 0.3, 1.0, 1.7, HZ - 0.002].map((z) => stabSec(s * z, 0, EF)),
            ...[HZ, SSPAN].map((z) => stabSec(s * z, 0, HF)),
          ],
          s,
        ),
      ),
    "Horizontal stabilizer",
    "Single composite structure tip to tip.",
  );
});
shell(
  () => loft(finHs.map((h) => finSec(h, 0, finCut(h)))),
  "Vertical stabilizer",
  "Composite, integral with the fuselage shell; swept leading edge blends into a dorsal fillet.",
);
