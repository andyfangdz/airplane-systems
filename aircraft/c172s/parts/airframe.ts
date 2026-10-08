import { sidePaintUV } from "@/lib/livery";
import { TAIL_PAINT_BOX, paintTail } from "../geometry";
/** C172S catalogue: airframe shells — fuselage, spinner, wings, wing tips, horizontal and vertical stabilizers. */
import * as THREE from "three";
import {
  AIL_C,
  BL,
  EF,
  FLAP_C,
  HF,
  HZ,
  X,
  Y,
  Z,
  fuselageGeo,
  finCut,
  finSec,
  loft,
  sided,
  stabSec,
  wingSec,
} from "../geometry";
import { IN } from "../../cessna/airframe";
import { shell } from "./catalogue";

/* ---------- airframe shells ---------- */
shell(
  fuselageGeo,
  "Fuselage",
  "All-metal semimonocoque: formed bulkheads, stringers and skin. Front and rear carry-through spars take the wings; a bulkhead and forgings at the base of the rear door posts take the main gear; four engine mount stringers run from the forward door posts to the firewall (POH 7-5).",
  true,
);
shell(
  () => {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 18; i++) {
      const t = i / 18;
      pts.push(new THREE.Vector2(Math.max(1e-4, 7.6 * IN * Math.sqrt(Math.max(0, 1 - t * t))), t * 9.6 * IN));
    }
    const g = new THREE.LatheGeometry(pts, 32);
    g.rotateZ(-Math.PI / 2);
    g.translate(X(-37.4), 0, 0);
    return g;
  },
  "Spinner",
  "Spinner dome FS −42.6, forward bulkhead −40.8, aft bulkhead −37.3 (POH 6-23). Covers the McCauley fixed-pitch propeller hub.",
).finish = "polished";

const tipS = [BL.ail1, 209, 211, 212.5, 213.5];
[1, -1].forEach((s) => {
  const side = s > 0 ? "Right" : "Left";
  const zs = (bls: number[]) => bls.map((b) => Z(b));
  shell(
    () =>
      loft(
        sided(
          zs([0, 10, 21.5, 40, 60, 80, BL.flap1, BL.ail0]).map((z) => wingSec(s * z, 0, FLAP_C)),
          s,
        ),
      ),
    side + " wing",
    "Externally braced all-metal wing with an integral fuel tank. Front spar with wing-to-fuselage and wing-to-strut fittings; partial-span rear spar (POH 7-5). Constant chord inboard, tapered outboard panel, conical-camber tip.",
  );
  shell(
    () =>
      loft(
        sided(
          zs([BL.ail0, 125, 150, 175, 195, BL.ail1, ...tipS.slice(1)]).map((z) => wingSec(s * z, 0, AIL_C)),
          s,
        ),
      ),
    side + " wing",
    "Outboard tapered panel carrying the aileron and the wing-tip lights.",
  );
  shell(
    () =>
      loft(
        sided(
          zs([0, 10, BL.flap0]).map((z) => wingSec(s * z, FLAP_C, 1)),
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
          zs([BL.flap1, BL.ail0]).map((z) => wingSec(s * z, FLAP_C, 1)),
          s,
        ),
      ),
    "Wing trailing edge",
    "",
  );
  shell(
    () =>
      loft(
        sided(
          zs(tipS).map((z) => wingSec(s * z, AIL_C, 1)),
          s,
        ),
      ),
    "Wing tip",
    "Fiberglass conical-camber tip; carries the position light and strobe.",
  );
  shell(
    () =>
      loft(
        sided(
          [
            ...[0, 0.12, 0.3, 0.5, 0.75, 1.0].map((b) => stabSec(s * Z(b * (HZ - 0.05)), 0, EF)),
            ...[HZ, 62, 64.5, 66.5, 67.6, 68].map((b) => stabSec(s * Z(b), 0, HF)),
          ],
          s,
        ),
      ),
    "Horizontal stabilizer",
    "Forward and aft spars, ribs and wraparound skins; it also houses the elevator trim tab actuator (POH 7-6). Span 11'-4\" (POH 1-3).",
  );
});
const finHs = [44.5, 52, 59, 60, 61.5, 64, 70, 78, 85, 92, 100, 103, 104.4].map(Y);
shell(
  () => sidePaintUV(loft(finHs.map((h) => finSec(h, 0, finCut(h)))), TAIL_PAINT_BOX),
  "Vertical stabilizer",
  "Spar, ribs, wraparound skin and a dorsal fin (POH 7-5). The rudder hinges on its rear spar.",
  paintTail,
);
