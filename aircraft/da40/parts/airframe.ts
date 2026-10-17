import { sidePaintUV } from "@/lib/livery";
import { TAIL_PAINT_BOX, paintTail } from "../geometry";
import * as THREE from "three";
import type { ShellSpec } from "@/lib/catalogue";
import { sided } from "@/lib/geometry";
import type { Vec3 } from "@/lib/math";
import {
  AIL,
  CANOPY,
  DOOR,
  EF,
  FLAP,
  HF,
  HZ,
  SSPAN,
  WJ,
  WR,
  WTIP,
  wingCut,
  canopyGeo,
  doorGeo,
  finCut,
  finHs,
  finSec,
  fixedFuselageGeo,
  fs,
  loft,
  onSkin,
  paintSkin,
  stabSec,
  doorHingeY,
  wingSec,
} from "../geometry";
import { shell, rel } from "./catalogue";

/* ---------- airframe shells ---------- */
shell(
  fixedFuselageGeo,
  "Fuselage",
  "GFRP semi-monocoque moulded shell with GFRP/CFRP main bulkheads (AFM 7-3). The cabin pod tapers into a slim tail boom; the whole airplane is painted white to keep the composite structure cool (AFM 8-9).",
  true,
  "parts.airframe.fuselage.001",
);
shell(
  () => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      pts.push(new THREE.Vector2(0.17 * Math.pow(Math.max(0, 1 - t * t), 0.55) + 0.001, t * 0.4));
    }
    const g = new THREE.LatheGeometry(pts, 32);
    g.rotateZ(-Math.PI / 2);
    g.translate(fs(0.46), 0, 0);
    return g;
  },
  "Spinner",
  "Polished spinner over the MT propeller hub (XLS package).",
  false,
  "parts.airframe.spinner.002",
).finish = "polished";
const wingSt = [WR, 0.58, 0.8, WJ, FLAP.z0, 1.8, 2.6, 3.4, FLAP.z1, AIL.z0, 4.6, 5.2, AIL.z1];
const tipSt = [AIL.z1, 5.6, 5.67, 5.75, 5.83, 5.9, 5.95, WTIP];
[1, -1].forEach((s) => {
  shell(
    () =>
      loft(
        sided(
          wingSt.map((z) => wingSec(s * z, 0, wingCut(z))),
          s,
        ),
      ),
    s > 0 ? "Right wing" : "Left wing",
    "Front and rear spar with separate top and bottom shells — a fail-safe GFRP/CFRP sandwich structure. An aluminium fuel tank sits in each wing (AFM 7-3). Bolts to the stub wing at the root rib; removable for road transport (AFM 8-8).",
    false,
    "parts.airframe.shell.003",
    [s],
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
    "Raked, upturned wing tip carrying the Whelen position/strobe unit.",
    false,
    "parts.airframe.wing-tip.004",
    [s],
  );
  (
    [
      ["member-1", [WR, 0.58, 0.8, WJ, FLAP.z0]],
      ["member-2", [FLAP.z1, AIL.z0]],
    ] as const
  ).forEach(([instance1, st]) =>
    shell(
      () =>
        loft(
          sided(
            st.map((z) => wingSec(s * z, wingCut(z), 1)),
            s,
          ),
        ),
      "Wing trailing edge",
      "",
      false,
      "parts.airframe.wing-trailing-edge.005",
      [s, instance1],
    ),
  );
  shell(
    () =>
      loft(
        sided(
          [
            ...[0, 0.5, 1.0, HZ - 0.002].map((z) => stabSec(s * z, 0, EF(z))),
            ...[HZ, 1.56, SSPAN].map((z) => stabSec(s * z, 0, HF)),
          ],
          s,
        ),
      ),
    "Horizontal stabilizer",
    "GFRP twin-spar T-tail stabilizer with an un-sandwiched skin; incidence about −3° (AFM 1-6, 7-3). Removable for transport.",
    false,
    "parts.airframe.horizontal-stabilizer.006",
    [s],
  );
});
shell(
  () => sidePaintUV(loft(finHs.map((h) => finSec(h, 0, finCut(h)))), TAIL_PAINT_BOX),
  "Vertical stabilizer",
  "GFRP twin-spar fin carrying the T-tail. The levelling wedge (600:31) sits on the tail boom just ahead of it (AFM 6-3).",
  paintTail,
  "parts.airframe.vertical-stabilizer.007",
);

/* ---------- moving shells: front canopy and rear passenger door ---------- */
/** Canopy and door shells live in their own hinged groups (Airplane.tsx); geometry is hinge-relative. */
export const CANOPY_HINGE = CANOPY.hinge;
export const DOOR_HINGE: Vec3 = (() => {
  const x = (DOOR.x0 + DOOR.x1) / 2;
  // A straight hinge axis must clear the curved roof edge over the whole door span.
  // The former midpoint at y=0.42 sat below the door's y=0.46 top edge.
  // Ten-millimetre bracket stand-off is illustrative (AFM 7-18), not a rigging dimension.
  const edge = Array.from({ length: 33 }, (_, i) => {
    const at = DOOR.x0 + ((DOOR.x1 - DOOR.x0) * i) / 32;
    return onSkin(at, doorHingeY(at), -1, 1);
  });
  return [x, Math.max(...edge.map((p) => p.y)) + 0.01, Math.min(...edge.map((p) => p.z)) - 0.01];
})();
export const CANOPY_SHELL: ShellSpec = {
  id: "da40/canopy",
  geo: () => rel(canopyGeo(), CANOPY_HINGE),
  name: "Front canopy",
  note: "Large one-piece canopy, hinged at the front. Pull the frame down and lock it with the handle on the left; steel bolts lock into polyethylene blocks. A second latch setting leaves a 'cooling gap' — ground only (AFM 7-17).",
  skin: paintSkin,
};
export const DOOR_SHELL: ShellSpec = {
  id: "da40/door",
  geo: () => rel(doorGeo(), DOOR_HINGE),
  name: "Rear passenger door (left)",
  note: "Opens upward; a gas-pressure damper holds it up and an additional safety lever guards against unintentional opening (AFM 7-18). Its front hinge can be released for emergency exit after a roll-over (AFM 3-41).",
  skin: paintSkin,
};
