/** M20C airframe shells: fuselage, spinner, wings and tips, and the empennage shells that live in the pivoting tail group. */
import * as THREE from "three";
import { type ShellSpec } from "@/lib/catalogue";
import { sided } from "@/lib/geometry";

import {
  EF,
  FLAP,
  SSPAN,
  WR,
  WTIP,
  finCut,
  finHs,
  finSec,
  flatPaint,
  fuselageGeo,
  LIGHT_BLUE,
  NAVY,
  withUv,
  loft,
  stabSec,
  wingSec,
  wingCut,
} from "../geometry";

import { shell } from "./catalogue";
import { cutMainWell, cutNoseWell } from "../placement";

/* ---------- airframe shells ---------- */
shell(
  () => cutNoseWell(fuselageGeo()),
  "Fuselage",
  "Cabin: welded 4130 steel-tube truss covered with aluminium skins; stainless-steel firewall. Tail cone: conventional aluminium monocoque (OM p. 5–6; Ranger 1-2). Short-body M20C fuselage, unchanged 1962–77.",
  true,
);
shell(
  () => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      pts.push(new THREE.Vector2(0.19 * Math.pow(Math.max(0, 1 - t * t), 0.6) + 0.001, t * 0.3));
    }
    const g = new THREE.LatheGeometry(pts, 32);
    g.rotateZ(-Math.PI / 2);
    g.translate(2.98, 0, 0);
    return g;
  },
  "Spinner",
  "Spinner over the Hartzell hub (navy on N6947N).",
  flatPaint(NAVY),
);
const wingSt = [WR, 0.62, 1.0, 1.6, 2.2, 2.95, 3.02, 3.6, 4.2, 4.8, 5.1];
const tipSt = [5.1, 5.18, 5.24, 5.29, WTIP];
[1, -1].forEach((s) => {
  shell(
    () =>
      cutMainWell(
        loft(
          sided(
            wingSt.map((z) => wingSec(s * z, 0, wingCut(z))),
            s,
          ),
        ),
        s,
      ),
    s > 0 ? "Right wing" : "Left wing",
    "One-piece laminar-flow wing (NACA 63-215 root / 64-412 tip): main spar and auxiliary spar with stressed skins, full wrap-around skins flush-riveted over the forward top two-thirds (Ranger 1-2; OM p. 5). Integral fuel bay in the forward inboard section. Dihedral 5.5°.",
  );
  shell(
    () =>
      loft(
        sided(
          tipSt.map((z) => wingSec(s * z, 0, 1)),
          s,
        ),
      ),
    "Wing tip",
    "Rounded tip carrying the navigation light.",
  );
  shell(
    () =>
      loft(
        sided(
          [WR, FLAP.z0].map((z) => wingSec(s * z, wingCut(z), 1)),
          s,
        ),
      ),
    "Wing root trailing edge",
    "",
  );
  shell(
    () =>
      loft(
        sided(
          [FLAP.z1, 3.02].map((z) => wingSec(s * z, wingCut(z), 1)),
          s,
        ),
      ),
    "Wing trailing edge",
    "",
  );
});

/* ---------- empennage: lives in the pivoting tail group (positions relative to TAIL_PIVOT) ---------- */
import { relT } from "./catalogue";
export const TAIL_SHELLS: ShellSpec[] = [
  {
    id: "m20c/stab",
    geo: () => relT(loft([-SSPAN, -1.2, -0.6, 0, 0.6, 1.2, SSPAN].map((z) => stabSec(z, 0, EF(z))))),
    name: "Horizontal stabilizer",
    note: "Main and auxiliary spar with stressed skin (OM p. 5). Span 11 ft 9 in. The whole empennage pivots for trim, so the stabilizer has no separate trim tab (OM p. 6).",
  },
  {
    id: "m20c/fin",
    geo: () => withUv(relT(loft(finHs.map((h) => finSec(h, 0, finCut(h)))))),
    skin: flatPaint(LIGHT_BLUE),
    name: "Vertical fin",
    note: "Narrow fixed fin ahead of a near-vertical rudder hinge; the leading edge rakes slightly forward — Mooney's hallmark. Main and auxiliary spar, stressed skin (OM p. 5). It moves with the stabilizer when the tail is trimmed.",
  },
];
