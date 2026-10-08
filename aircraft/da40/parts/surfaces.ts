import { TAIL_PAINT_BOX, paintTail } from "../geometry";
import { sided } from "@/lib/geometry";
import { D2R, V, toVec3 } from "@/lib/math";
import {
  AIL,
  ELEV_HINGE_X,
  EF,
  FIN_TOP,
  FLAP,
  HF,
  HZ,
  RUD_BOT,
  SSPAN,
  SY,
  af,
  box,
  cyl,
  fC,
  fLE,
  finCut,
  finSec,
  hingeX,
  rudHs,
  sC,
  sLE,
  stabSec,
  wC,
  wLE,
  wT,
  wY,
  wingP,
  wingSec,
} from "../geometry";
import { live } from "../model";
import { TAB } from "../rig";
import { part, surfacePivot, surface, onSurf } from "./catalogue";

/* ---------- control surfaces (pivot on their hinge lines) ---------- */
const hp = (s: number, z: number, xc: number) => {
  const c = wC(z),
    [u, l] = af(xc, wT(z), 0.04);
  return V(wLE(z) - xc * c, wY(z) + ((u + l) / 2) * c, s * z);
};
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L",
    nm = s > 0 ? "Right" : "Left";
  const fz = [FLAP.z0, 1.8, 2.6, 3.4, FLAP.z1],
    az = [AIL.z0, 4.6, 5.2, AIL.z1];
  surface(
    "flap" + side,
    () =>
      sided(
        fz.map((z) => wingSec(s * z, FLAP.hinge, 1)),
        s,
      ),
    hp(s, fz[0], FLAP.hinge),
    hp(s, fz[4], FLAP.hinge),
    ["flaps", "controls"],
    nm + " flap",
    "GFRP/CFRP sandwich on 6 hinges (roll-pinned hinge pins in aluminium brackets). UP 0° · T/O 20° · LDG 42° (TCDS). Driven by push rod and rod-end from the fuselage torsion tube (AFM 7-5).",
  );
  surface(
    "ail" + side,
    () =>
      sided(
        az.map((z) => wingSec(s * z, AIL.hinge, 1)),
        s,
      ),
    hp(s, az[0], AIL.hinge),
    hp(s, az[3], AIL.hinge),
    ["controls"],
    nm + " aileron",
    "GFRP/CFRP sandwich on 4 hinges. Differential: up 20°, down 13° (TCDS). A steel push rod with a rod-end bearing drives the aluminium horn, held by 3 screws (AFM 7-4).",
  );
});
{
  const ez = [-SSPAN, -1.56, -HZ - 0.002],
    eh = [-HZ, -1.0, -0.5, 0, 0.5, 1.0, HZ],
    eo = [HZ + 0.002, 1.56, SSPAN];
  surface(
    "elev",
    () => [
      ...ez.map((z) => stabSec(z, HF, 1)),
      ...eh.map((z) => stabSec(z, EF(z), 1)),
      ...eo.map((z) => stabSec(z, HF, 1)),
    ],
    V(ELEV_HINGE_X, SY, -SSPAN),
    V(ELEV_HINGE_X, SY, SSPAN),
    ["controls"],
    "Elevator",
    "One-piece GFRP sandwich elevator on 5 hinges at the top of the T-tail, horn-balanced at the tips. Up 18°, down 16° (TCDS, 1,200 kg rigging). Carries the trim tab.",
  );
}
surface(
  "rudder",
  () => rudHs.map((h) => finSec(h, finCut(h), 1)),
  V(hingeX(RUD_BOT), RUD_BOT, 0),
  V(hingeX(FIN_TOP), FIN_TOP, 0),
  ["controls"],
  "Rudder",
  "GFRP sandwich. Upper hinge is one bolt; the lower bearing bracket holds the rudder stops. Left 24°, right 26° with long-range tanks (TCDS). Cable-driven.",
  { box: TAIL_PAINT_BOX, skin: paintTail },
);

/* ---------- control-surface details ---------- */
const wickNote =
  "Static discharger: bleeds static charge off the trailing edge. Seven are installed and all seven are required for IFR (AFMS p. 20). Exact placement not in the documents.";
const WICK = "#2A2F33";
[1, -1].forEach((s) => {
  const side = s > 0 ? "R" : "L";
  onSurf("ail" + side, wingP(s * 5.0, 1.0, 0).add(V(-0.05, 0, 0)), () => cyl(0.004, 0.12, "x", 6), {
    color: WICK,
    name: "Static discharger",
    note: wickNote,
    ext: true,
    pin: s > 0,
  });
  part(() => cyl(0.004, 0.12, "x", 6), ["controls"], {
    pos: toVec3(wingP(s * 5.9, 1.0, 0).add(V(-0.05, 0, 0))),
    color: WICK,
    name: "Static discharger",
    note: wickNote,
    ext: true,
  });
  onSurf("elev", V(ELEV_HINGE_X - 0.27, SY, s * 1.5), () => cyl(0.004, 0.11, "x", 6), {
    color: WICK,
    name: "Static discharger",
    note: wickNote,
    ext: true,
  });
  [1.6, 2.6, 3.6].forEach((z, i) =>
    part(() => box(0.3, 0.04, 0.02), ["flaps"], {
      pos: toVec3(wingP(s * z, 0.77, -1).add(V(-0.02, -0.02, 0))),
      color: "#C9D0D5",
      name: "Flap hinge bracket",
      note: "Aluminium hinge bracket; the hinge pin is held by a roll pin — a lost roll pin can let the hinge pin walk out (AFM 7-5). Six hinges per flap.",
      ext: true,
      pin: s > 0 && i === 0,
    }),
  );
  [4.2, 5.1].forEach((z, i) =>
    part(() => box(0.28, 0.04, 0.02), ["controls"], {
      chan: ["aileron"],
      pos: toVec3(wingP(s * z, 0.79, -1).add(V(-0.02, -0.02, 0))),
      color: "#C9D0D5",
      name: "Aileron hinge",
      note: "One of 4 hinges per aileron (hinge pin in an aluminium bracket, roll-pinned). Walk-around: aileron hinges and safety pin, no foreign objects in the aileron paddle (AFM 4A-7).",
      ext: true,
      pin: s > 0 && i === 0,
    }),
  );
  // stall strips: 2 per wing (AFM 4A-7)
  [1.6, 2.0].forEach((z, i) =>
    part(() => box(0.03, 0.025, 0.22), ["airframe"], {
      pos: toVec3(wingP(s * z, 0.0, 0).add(V(0.005, 0, 0))),
      color: "#8C959C",
      name: "Stall strips",
      note: "Two per wing on the leading edge (AFM 4A-7); they make the inboard wing stall first. The fuel measuring device is held against a marked bore in the stall strip (AFM 7-38).",
      ext: true,
      pin: s > 0 && i === 0,
    }),
  );
  part(() => box(0.18, 0.012, 0.16), ["airframe", "cabin"], {
    pos: toVec3(wingP(s * 0.75, 0.45, 1).add(V(0, 0.008, 0))),
    color: "#30363B",
    name: "Wing step",
    note: "Walkway step on each stub wing; you board over the wing. Its unpainted latch areas are the grounding points for refuelling (AFM 4A-40).",
    ext: true,
    pin: s > 0,
  });
  part(() => cyl(0.012, 0.03), ["airframe"], {
    pos: toVec3(wingP(s * 5.4, 0.45, -1).add(V(0, -0.02, 0))),
    color: "#9AA3AA",
    name: "Tie-down eyelet",
    note: "An M8 eyelet can be screwed in near each wing tip; the tail tie-down is a hole in the fin (AFM 8-7).",
    ext: true,
  });
});
onSurf("elev", V(ELEV_HINGE_X - 0.27, SY, 0.0), () => cyl(0.004, 0.1, "x", 6), {
  color: WICK,
  name: "Static discharger",
  note: wickNote,
  ext: true,
});
onSurf("rudder", V(fLE(0.3) - fC(0.3) - 0.04, 0.3, 0), () => cyl(0.004, 0.11, "x", 6), {
  color: WICK,
  name: "Static discharger",
  note: wickNote,
  ext: true,
});
[1, -1].forEach((s) =>
  onSurf("elev", V(sLE(1.58) - 0.3 * sC(1.58), SY, s * 1.58), () => box(0.05, 0.03, 0.08), {
    color: "#6E7A84",
    name: "Elevator horn balance",
    note: "The elevator tips reach forward of the hinge line (horn balance), reducing stick forces and helping prevent flutter.",
    pin: s > 0,
  }),
);
onSurf("rudder", V(fLE(0.0) - fC(0.0) - 0.03, 0.0, 0), () => box(0.07, 0.12, 0.004), {
  color: "#8C99A3",
  name: "Rudder trim tab",
  note: "Rudder trim tab — a walk-around item (visual inspection, AFM 4A-7). There is no cockpit rudder trim; the tab's type and position on the rudder are not in the documents, so it is shown as a fixed tab. The GFC 700 out-of-trim check then means 'centre the ball with rudder'.",
  ext: true,
  pin: true,
});
// elevator trim tab rides on the elevator and turns about its own hinge with the trim position
{
  const pv = surfacePivot("elev"),
    xh = ELEV_HINGE_X - 0.22 + TAB.chord,
    zc = (TAB.z0 + TAB.z1) / 2;
  part(
    () => {
      const g = box(TAB.chord, 0.008, Math.abs(TAB.z1 - TAB.z0));
      g.translate(-TAB.chord / 2, 0, 0);
      return g;
    },
    ["controls"],
    {
      parent: "surf:elev",
      chan: ["elevator"],
      pos: [xh - pv[0], SY - pv[1], zc - pv[2]],
      color: "#9F85E6",
      ext: true,
      pin: true,
      // nose-up trim puts the tab trailing edge down, so the air load holds the elevator trailing edge up (+ rotation = TE down)
      anim: (m) => {
        const t = live.afcs.trim;
        m.rotation.z = t > 0 ? t * 12 * D2R : t * 39 * D2R;
      },
      name: "Elevator trim tab",
      note: "One GFRP tab in the middle of the elevator trailing edge, behind the top of the fin. Walk-around: visual inspection, check the locking wire (AFM 4A-7). Two cranked levers from the actuator bracket at the fin top drive it: the left one by the Bowden cable from the trim wheel (also moved by the GFC 700 trim servo), the right one through a friction damper that stops the tab fluttering if the cable fails (AMM 27-38-00). Tab travel with the elevator neutral: nose up 12° trailing edge down, nose down 39° trailing edge up (TCDS +12° / −39°). Span approximate.",
    },
  );
}
