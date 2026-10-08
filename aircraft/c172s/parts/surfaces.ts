import { TAIL_PAINT_BOX, paintTail } from "../geometry";
/** C172S catalogue: control surfaces (flaps, ailerons, elevator, rudder) and the details that ride on them. */
import { V } from "@/lib/math";
import {
  AIL_C,
  BL,
  EF,
  FLAP_C,
  HF,
  HZ,
  SY,
  Y,
  Z,
  box,
  cyl,
  finCut,
  finSec,
  fLE,
  fC,
  hingeX,
  sC,
  sLE,
  sided,
  stabSec,
  wC,
  wLE,
  wY,
  wingP,
  wingSec,
} from "../geometry";
import { live } from "../model";
import { RIG } from "../rig";
import { PV, part, surface, onSurf } from "./catalogue";

/* ---------- control surfaces (pivot on their hinge lines) ---------- */
/** Hinge point on the wing at BL, chord fraction c, dropped below the mean line by `drop` m. */
const hp = (s: number, bl: number, c: number, drop = 0) => {
  const z = Z(bl);
  return V(wLE(z) - c * wC(z), wY(z) - drop, s * z);
};
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L",
    Side = s > 0 ? "Right" : "Left";
  const fz = [BL.flap0, 40, 60, 80, BL.flap1].map(Z),
    az = [BL.ail0, 130, 160, 185, BL.ail1].map(Z);
  // single-slot flap rides aft and down: the hinge axis sits below the wing so rotation moves it aft as it deflects
  surface(
    "flap" + side,
    () =>
      sided(
        fz.map((z) => wingSec(s * z, FLAP_C, 1)),
        s,
      ),
    hp(s, BL.flap0, 0.69, 0.07),
    hp(s, BL.flap1, 0.69, 0.07),
    ["flaps", "controls"],
    Side + " flap",
    "Single-slot flap: built like the ailerons but without balance weights, with a formed leading edge (POH 7-5). UP, 10°, 20°, FULL (30°).",
  );
  surface(
    "ail" + side,
    () =>
      sided(
        az.map((z) => wingSec(s * z, AIL_C, 1)),
        s,
      ),
    hp(s, BL.ail0, AIL_C + 0.02),
    hp(s, BL.ail1, AIL_C + 0.02),
    ["controls"],
    Side + " aileron",
    "Conventional hinged aileron (modified Frise): forward spar with balance weights, “V” corrugated skins. Travel up 20° / down 15° (TCDS 3A12).",
  );
  const ez = [2, 20, 40, HZ - 0.05].map(Z);
  surface(
    "elev" + side,
    () =>
      sided(
        [
          ...(s > 0 ? RIG.trimTab.notch(ez, () => EF) : ez.map((z) => stabSec(-z, EF, 1))),
          ...[HZ, 62, 64.5, 66.5, 67.6, 68].map((b) => stabSec(s * Z(b), HF, 1)),
        ],
        s,
      ),
    V(sLE(ez[0]) - EF * sC(ez[0]), SY, s * ez[0]),
    V(sLE(Z(HZ)) - EF * sC(Z(HZ)), SY, s * Z(HZ)),
    ["controls"],
    "Elevator (" + (s > 0 ? "right" : "left") + " half)",
    "Torque tube and bellcrank; tip leading-edge extensions carry balance weights (POH 7-6). Travel up 28° / down 23° (TCDS 3A12)." +
      (s > 0 ? " Right half has the trim-tab cutout." : ""),
  );
});
surface(
  "rudder",
  () => [44.5, 52, 59, 64, 72, 82, 92, 100, 103, 104.4].map(Y).map((h) => finSec(h, finCut(h), 1)),
  V(hingeX(Y(44.5)), Y(44.5), 0),
  V(hingeX(Y(103)), Y(103), 0),
  ["controls"],
  "Rudder",
  "Formed leading edge, spar, hinge brackets, wraparound skin; the top has a leading-edge extension with a balance weight; ground-adjustable trim tab at the base of the trailing edge (POH 7-6). Travel ±16°10′ (TCDS 3A12).",
  { box: TAIL_PAINT_BOX, skin: paintTail },
);

/* ---------- surface details ---------- */
const WICK =
  "Static discharger: bleeds static charge off the trailing edge to cut radio noise. A set of 10 is installed (POH 7-78, 6-19); the distribution and stations shown are illustrative, not a maintenance drawing.";
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  [195, 175].forEach((bl, i) =>
    onSurf("ail" + side, wingP(s * Z(bl), 1.0, 0).add(V(-0.05, 0, 0)), () => cyl(0.004, 0.12, "x", 6), {
      color: "#2A2F33",
      name: "Static discharger",
      note: WICK,
      ext: true,
      pin: s > 0 && i === 0,
    }),
  );
  [52, 40].forEach((bl) =>
    onSurf("elev" + side, V(sLE(Z(bl)) - sC(Z(bl)) - 0.05, SY, s * Z(bl)), () => cyl(0.004, 0.11, "x", 6), {
      color: "#2A2F33",
      name: "Static discharger",
      note: WICK,
      ext: true,
    }),
  );
  onSurf("elev" + side, V(sLE(Z(64)) - 0.04, SY, s * Z(64)), () => box(0.07, 0.03, 0.12), {
    color: "#6E7A84",
    name: "Elevator balance weight",
    note: "In the elevator tip leading-edge extension ahead of the hinge (horn balance) — reduces stick force and prevents flutter (POH 7-6).",
    pin: s > 0,
  });
  onSurf("ail" + side, wingP(s * Z(150), AIL_C + 0.035, 0), () => box(0.05, 0.025, 0.5), {
    color: "#6E7A84",
    name: "Aileron balance weights",
    note: "Carried in the aileron forward spar (POH 7-6).",
    pin: s > 0,
  });
  // flap tracks / rollers and aileron hinges
  [30, 60, 92].forEach((b, i) =>
    part(() => box(0.32, 0.05, 0.03), ["flaps"], {
      pos: PV(wingP(s * Z(b), 0.74, -1).add(V(-0.03, -0.03, 0))),
      color: "#B9C1C7",
      name: "Flap track and rollers",
      note: "The flap rolls aft and down along curved tracks as it extends, opening the slot (single-slot flap).",
      ext: true,
      pin: s > 0 && i === 0,
    }),
  );
  [118, 165, 200].forEach((b) =>
    part(() => box(0.1, 0.03, 0.022), ["controls"], {
      pos: PV(wingP(s * Z(b), 0.78, -1).add(V(-0.01, -0.012, 0))),
      color: "#C9D0D5",
      name: "Aileron hinge",
      note: "Aileron hinge bracket on the rear spar.",
      ext: true,
      chan: ["aileron"],
    }),
  );
});
// elevator trim tab on the right elevator (anim: deflects with trim), ground-adjustable rudder tab
{
  const tab = RIG.trimTab,
    axis = V(...tab.axis);
  const animate = (m: import("three").Mesh) => {
    m.quaternion.setFromAxisAngle(axis, RIG.surfaceAngles({ ...live.ctl, trim: live.afcs.trim }, 0).tab);
  };
  onSurf("elevR", V(...tab.pivot), tab.geo, {
    color: "#9F85E6",
    name: "Elevator trim tab",
    pin: true,
    ext: true,
    sys: ["controls", "autopilot"],
    note: "On the right elevator trailing-edge cutout (POH 7-6). Driven by the actuator in the stabilizer through a push-pull rod. Travel up 22° / down 19° (TCDS). Forward wheel = nose down. Tab span/chord and clearances are illustrative.",
    anim: animate,
  });
  onSurf("elevR", V(...tab.pivot), () => box(0.02, 0.05, 0.01).translate(-0.02, 0.025, 0), {
    color: "#7C57CF",
    name: "Trim tab horn",
    anim: animate,
  });
}
onSurf("rudder", V(fLE(Y(49)) - fC(Y(49)) + 0.055, Y(49), 0), () => box(0.1, 0.13, 0.005), {
  color: "#8C99A3",
  name: "Rudder trim tab (ground adjustable)",
  note: "“A ground adjustable trim tab at the base of the trailing edge” (POH 7-6) — the only rudder trim. Bent on the ground to trim out a constant yaw.",
  ext: true,
  pin: true,
});
onSurf("rudder", V(fLE(Y(103.5)) - 0.12, Y(103.5), 0), () => box(0.12, 0.04, 0.03), {
  color: "#6E7A84",
  name: "Rudder balance weight",
  note: "In the leading-edge extension at the top of the rudder (horn balance, POH 7-6).",
  pin: true,
});
[95, 80].forEach((h) =>
  onSurf("rudder", V(fLE(Y(h)) - fC(Y(h)) - 0.04, Y(h), 0), () => cyl(0.004, 0.11, "x", 6), {
    color: "#2A2F33",
    name: "Static discharger",
    note: WICK,
    ext: true,
  }),
);
