import { sidePaintUV } from "@/lib/livery";
import { TAIL_PAINT_BOX, paintTail } from "../geometry";
/** C182T catalogue: airframe shells — fuselage, spinner, wings and tips, horizontal and vertical stabilizers. */
import * as THREE from "three";
import { AF, AIL_C, BL, EF, FLAP_C, HF, HZ, X, Y, Z, finCut, finSec, loft, sided, stabSec, wingSec } from "../geometry";
import { IN } from "../../cessna/airframe";
import { shell } from "./catalogue";

/* ---------- airframe shells ---------- */
shell(
  fuselageGeoOf(),
  "Fuselage",
  "All-metal semimonocoque: formed bulkheads, stringers and skin. Front and rear carry-through spars take the wings; a bulkhead and forgings at the base of the rear door posts take the main gear; a bulkhead with fittings at the base of the forward door posts takes the struts; four engine mount stringers run from the forward door posts to the firewall (POH 7-5).",
  true,
);
function fuselageGeoOf() {
  return AF.fuselageGeo;
}
shell(
  () => {
    // long pointed spinner: tip FS −64 (scaled from Fig 1-1), base ≈ FS −44.5, D-7261-2 (arm −49.9, POH 6-24)
    const pts: THREE.Vector2[] = [],
      L = 19.6 * IN,
      R = 8.2 * IN;
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      pts.push(new THREE.Vector2(Math.max(1e-4, R * Math.pow(1 - t, 0.62) * (1 - 0.05 * t)), t * L));
    }
    const g = new THREE.LatheGeometry(pts, 36);
    g.rotateZ(-Math.PI / 2);
    g.translate(X(-44.4), 0, 0);
    return g;
  },
  "Spinner",
  "D-7261-2 spinner, arm −49.9 (POH 6-24), over the oil-filled hub of the McCauley constant-speed propeller. Preflight: “Propeller and Spinner — CHECK (for nicks, security and no red oil leaks)” (POH 4-10).",
).finish = "polished";

const ailS = [BL.ail0, 125, 150, 175, 195, BL.ail1];
const tipS = [BL.ail1, 209.5, 211, 212.2, 213];
[1, -1].forEach((s) => {
  const side = s > 0 ? "Right" : "Left";
  const zs = (bls: number[]) => bls.map((b) => Z(b));
  shell(
    () =>
      loft(
        sided(
          zs([0, 10, BL.flap0, 40, 60, 80, BL.flap1, BL.ail0]).map((z) => wingSec(s * z, 0, FLAP_C)),
          s,
        ),
      ),
    side + " wing",
    "Externally braced wing with an integral fuel tank: front and rear spar, formed ribs, doublers and stringers, aluminum skin. The front spar has the wing-to-fuselage and wing-to-strut fittings; the rear spar is partial span (POH 7-5). Constant chord inboard, tapered outboard panel.",
  );
  shell(
    () =>
      loft(
        sided(
          zs([...ailS, ...tipS.slice(1)]).map((z) => wingSec(s * z, 0, AIL_C)),
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
    "Slightly down-turned fiberglass tip carrying the position light and the strobe (POH 7-57, Fig 1-1).",
  ).finish = "red";
  shell(
    () =>
      loft(
        sided(
          [
            ...[0, 0.12, 0.3, 0.5, 0.75, 1.0].map((b) => stabSec(s * Z(b * (HZ - 0.05)), 0, EF)),
            ...[HZ, 64.5, 66.8, 68.4, 69.4, 70].map((b) => stabSec(s * Z(b), 0, HF)),
          ],
          s,
        ),
      ),
    "Horizontal stabilizer",
    "Forward and aft spar, ribs and stiffeners, centre upper and lower skins and two left and two right wraparound skins that form the leading edges. It also contains the elevator trim tab actuator (POH 7-6). Span 11'-8\" (POH 1-3).",
  );
});
const finHs = [46.5, 54, 61.8, 63, 64.3, 66, 69.5, 74.2, 80, 85, 92, 100, 106, 108.4, 109.6].map(Y);
shell(
  () => sidePaintUV(loft(finHs.map((h) => finSec(h, 0, finCut(h)))), TAIL_PAINT_BOX),
  "Vertical stabilizer",
  "Forward and aft spar, formed ribs and reinforcements, four skin panels, formed leading-edge skins and a dorsal fin (POH 7-5). The rudder hinges on its aft spar.",
  paintTail,
);
