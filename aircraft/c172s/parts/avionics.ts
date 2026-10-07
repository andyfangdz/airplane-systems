/** C172S catalogue: G1000 avionics (POH 7-68 – 7-74) — displays, audio panel, remote units, cooling fans and antennas. */
import { mats } from "@/lib/materials";
import { glowAnim as glow } from "@/lib/anims";
import { X, Y, Z, box, cyl, fLE, botY } from "../geometry";
import {
  GDU_H,
  GDU_KEYS_Y,
  GDU_W,
  GMA_KNOB_Y,
  GMA_W,
  NAV3_BL,
  gduKeys,
  gduKnobs,
  gmaKeys,
  gmaKnob,
} from "../../cessna/faceplate";
import { P3, part, S, EL, wp, top } from "./catalogue";

/* ---------- avionics (POH 7-68 – 7-74) ---------- */
const AVX = "#C8399F";
part(() => box(0.03, GDU_H, GDU_W), ["avionics"], {
  pos: P3(17.9, NAV3_BL.pfd, 61),
  color: "#1A1F23",
  name: "PFD — GDU 1040",
  note: "In front of the pilot. Dual-fed: PFD breakers on the ESSENTIAL BUS and AVIONICS BUS 1 (Fig. 7-7). Shows the EIS during engine start, reversion or DISPLAY BACKUP (POH 7-10).",
});
part(() => box(0.03, GDU_H, GDU_W), ["avionics"], {
  pos: P3(17.9, NAV3_BL.mfd, 61),
  color: "#1A1F23",
  name: "MFD — GDU 1040",
  note: "Right of the audio panel. MFD breaker, AVIONICS BUS 2 (with its fan) (POH 7-49).",
});
part(() => box(0.03, GDU_H, GMA_W), ["avionics"], {
  pos: P3(17.9, NAV3_BL.gma, 61),
  color: "#24292E",
  name: "GMA 1347 audio panel",
  note: "Between the PFD and MFD: audio, intercom, marker beacon; the red DISPLAY BACKUP button at the bottom selects reversionary mode. AUDIO breaker, AVIONICS BUS 2. Split COM is not approved (POH 7-69, 2-21).",
  pin: true,
});
part(() => box(0.012, 0.014, 0.022), ["avionics"], {
  pos: P3(18.6, NAV3_BL.gma, 57.4),
  color: "#D32626",
  anim: (m) => {
    m.material = S().avx.backup ? mats("#FF4040").hi : mats("#B32020").on;
  },
  name: "DISPLAY BACKUP button",
  note: "Red button on the bottom of the GMA 1347: manual reversion — PFD instruments plus the EIS on both displays; press again to cancel (POH 7-11, CRG 109).",
  pin: true,
});
// faceplate detail (POH Figure 7-2; CRG): GDU 1040 knobs and softkeys (the AFCS keys are in controls.ts), GMA 1347 keys and knob
[NAV3_BL.pfd, NAV3_BL.mfd].forEach((bl) => {
  const c = P3(17.9, bl, 61),
    x = c[0] - 0.015 - 0.006; // just aft of the bezel face
  part(() => gduKnobs(true), ["avionics"], { pos: [x, c[1], c[2]], color: "#3A4046" });
  part(gduKeys, ["avionics"], { pos: [x + 0.003, c[1] + GDU_KEYS_Y, c[2]], color: "#4A525A" });
});
part(gmaKeys, ["avionics"], { pos: [X(17.9) - 0.018, Y(61), Z(NAV3_BL.gma)], color: "#4A525A" });
part(gmaKnob, ["avionics"], { pos: [X(17.9) - 0.02, Y(61) + GMA_KNOB_Y, Z(NAV3_BL.gma)], color: "#3A4046" });
(
  [
    [
      113.3,
      -4,
      "GIA 63W #1",
      "Integrated avionics unit in the tailcone racks: GPS, VHF NAV/COM and main processor; hosts the GFC 700 flight director. COMM 1 and NAV 1 ENG breakers (ESS) (POH 7-69).",
    ],
    [
      113.3,
      4,
      "GIA 63W #2",
      "Second integrated avionics unit: COMM 2 and NAV 2 breakers, AVIONICS BUS 2. The first GIA to acquire a 3-D GPS fix is the active GPS source.",
    ],
  ] as [number, number, string, string][]
).forEach(([fs, bl, name, note]) =>
  part(() => box(0.24, 0.07, 0.13), ["avionics", "autopilot"], {
    pos: P3(fs, bl, 50),
    color: AVX,
    name,
    note,
    pin: true,
  }),
);
part(() => box(0.12, 0.08, 0.1), ["avionics", "pitot"], {
  pos: P3(134, 0, 45.5),
  color: AVX,
  name: "GRS 77 AHRS",
  note: "Tailcone, arm 134.0: accelerometers, tilt and rate sensors replace spinning gyros. ADC AHRS breakers on the ESS bus and AVN BUS 1. The AP won't operate without it (POH 7-69, 3-29).",
  pin: true,
});
part(() => box(0.12, 0.06, 0.1), ["avionics", "pitot"], {
  pos: P3(118.7, -4, 55),
  color: AVX,
  name: "GDC 74A air data computer",
  note: "Pressure altitude, airspeed, TAS, vertical speed and OAT from the pitot-static system and OAT probe. Rev 4 places it in the tailcone; earlier revisions behind the panel forward of the MFD (POH 7-70).",
  pin: true,
});
part(() => box(0.1, 0.07, 0.12), ["avionics", "engine"], {
  pos: P3(11.4, 8, 57),
  color: AVX,
  name: "GEA 71 engine/airframe unit",
  note: "Forward of the panel: RPM, fuel flow, oil, CHT/EGT, fuel quantity, vacuum and bus voltages to the EIS. NAV 1 ENG breakers (ESS and AVN BUS 1) (POH 7-70).",
  pin: true,
});
part(() => box(0.14, 0.06, 0.12), ["avionics"], {
  pos: P3(134, 4, 52.5),
  color: AVX,
  name: "GTX 33 transponder",
  note: "Tailcone racks; Mode S, controlled from the PFD. XPNDR breaker, AVIONICS BUS 2. Not powered by the standby battery (POH 7-70, 3-38).",
  pin: true,
});
part(() => box(0.06, 0.03, 0.06), ["avionics"], {
  pos: wp(-170, 0.42, 0, 0),
  color: AVX,
  name: "GMU 44 magnetometer",
  note: "Inside the left wing panel, arm 52.7 — heading reference for the AHRS (POH 7-69, 6-22).",
  pin: true,
});
part(() => box(0.12, 0.05, 0.1), ["avionics"], {
  pos: P3(112, -2, 60),
  color: "#9C4C88",
  name: "GDL 69A data link (optional)",
  note: "XM weather and radio in the tailcone (POH 7-70). FIS breaker, AVIONICS BUS 1 (if installed).",
});
part(() => box(0.06, 0.05, 0.1), ["avionics", "electrical"], {
  pos: P3(12.4, 0, 64),
  color: "#5A6168",
  anim: glow("#5A6168", () => EL().fwdFan, ["avionics", "electrical"], "#9FE3FF"),
  name: "Forward avionics cooling fan",
  note: "Forward of the panel, blows warm air up the inside of the windshield; on the AVN BUS 1 PFD breaker. Preflight: AVIONICS BUS 1 on, verify the fan is heard (POH 7-73, 4-5).",
  pin: true,
});
part(() => box(0.06, 0.08, 0.08), ["avionics", "electrical"], {
  pos: P3(109.5, 0, 56),
  color: "#5A6168",
  anim: glow("#5A6168", () => EL().aftFan, ["avionics", "electrical"], "#9FE3FF"),
  name: "Aft avionics cooling fan",
  note: "Tailcone: cools the GIAs and transponder; on the NAV 2 breaker, AVIONICS BUS 2. No fans run on the standby battery (POH 7-73).",
  pin: true,
});
const ANT = "#C8399F";
part(() => box(0.03, 0.2, 0.006), ["avionics"], {
  pos: [X(61.2), top(61.2, 7) + 0.095, Z(7)],
  rot: [0, 0, 0.35],
  color: ANT,
  name: "COM 1 / GPS 1 antenna",
  note: "Top of the cabin, right side, arm 61.2 (POH 7-74).",
  ext: true,
  pin: true,
});
part(() => box(0.03, 0.2, 0.006), ["avionics"], {
  pos: [X(61.2), top(61.2, -7) + 0.095, Z(-7)],
  rot: [0, 0, 0.35],
  color: ANT,
  name: "COM 2 / GPS 2 antenna",
  note: "Top of the cabin, left side (POH 7-74).",
  ext: true,
  pin: true,
});
part(() => cyl(0.04, 0.015), ["avionics"], {
  pos: [X(43.5), top(43.5) + 0.008, 0],
  color: ANT,
  name: "GDL (XM) antenna",
  note: "Top of the cabin, arm 43.5 (POH 7-74).",
  ext: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.36, 0.02, 0.006), ["avionics"], {
    pos: [fLE(Y(88)) - 0.12, Y(88), s * 0.06],
    rot: [s * 0.5, 0, -0.1],
    color: ANT,
    name: "VOR/GS navigation antenna",
    note: "Blade-type antenna on either side of the vertical stabilizer (POH 7-74).",
    ext: true,
    pin: s > 0,
  }),
);
part(() => box(0.28, 0.012, 0.08), ["avionics"], {
  pos: [X(129), botY(X(129)) - 0.006, 0],
  color: ANT,
  name: "Marker beacon antenna",
  note: "Bottom of the tailcone, arm 129.0 (POH 7-74).",
  ext: true,
  pin: true,
});
part(() => cyl(0.006, 0.08), ["avionics"], {
  pos: [X(86.3), botY(X(86.3)) - 0.04, Z(2)],
  color: ANT,
  name: "Transponder antenna",
  note: "Bottom of the cabin, arm 86.3 (POH 7-74).",
  ext: true,
  pin: true,
});
part(() => box(0.08, 0.05, 0.008), ["avionics"], {
  pos: [X(114.5), botY(X(114.5)) - 0.026, Z(-2)],
  color: "#9C4C88",
  name: "DME antenna (if installed)",
  note: "Bottom of the tailcone, arm 114.5 (POH 7-74).",
  ext: true,
});
