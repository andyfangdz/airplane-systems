/**
 * C182T catalogue: G1000 avionics (POH 7-66 – 7-70): displays, audio panel, remote units, cooling fans, faceplate detail,
 * antennas and compass; then the KAP 140 autopilot and its servos (POH 7-12, Supplement 3).
 */
import * as THREE from "three";
import type { PartAnim } from "@/lib/catalogue";
import { kap140Phase } from "@/lib/avionics/kap140";
import { mergeGeos } from "@/lib/geometry";
import { mats } from "@/lib/materials";
import { glowAnim as glow } from "@/lib/anims";
import { X, Y, Z, botY, box, cyl, fLE } from "../geometry";
import { live } from "../model";
import { RIG_SPEC } from "../rig";
import {
  GDU_H,
  GDU_KEYS_Y,
  GDU_W,
  GMA_KNOB_Y,
  GMA_W,
  NAV3_BL,
  cbHeads,
  gduKeys,
  gduKnobs,
  gmaKeys,
  gmaKnob,
  switchRows,
} from "../../cessna/faceplate";
import { EL, P3, S, cAt, part, top, wp } from "./catalogue";

/* ---------- avionics (POH 7-66 – 7-70) ---------- */
const AVX = "#C8399F";
part(() => box(0.03, GDU_H, GDU_W), ["avionics"], {
  pos: P3(18.1, NAV3_BL.pfd, 61.4),
  color: "#1A1F23",
  name: "PFD — GDU 1040",
  note: "In front of the pilot, arm 15.0. PFD breakers on the ESSENTIAL BUS and AVIONICS BUS 1 (with the deckskin and PFD fans). Shows the EIS during engine start, reversion or DISPLAY BACKUP (POH 7-10, 7-66).",
});
part(() => box(0.03, GDU_H, GDU_W), ["avionics"], {
  pos: P3(18.1, NAV3_BL.mfd, 61.4),
  color: "#1A1F23",
  name: "MFD — GDU 1040",
  note: "Right of the audio panel: moving map with the EIS strip on its left edge. MFD breaker (with the MFD fan), AVIONICS BUS 2 (POH 7-66, 7-49).",
});
part(() => box(0.03, GDU_H, GMA_W), ["avionics"], {
  pos: P3(18.1, NAV3_BL.gma, 61.4),
  color: "#24292E",
  name: "GMA 1347 audio panel",
  note: "Between the PFD and MFD: audio, intercom and marker beacon; it also controls reversionary mode. AUDIO breaker, AVIONICS BUS 2 — no autopilot use with it inoperative (no disconnect tone, S3-13). Split COM 1/2 is not approved (POH 7-66, 2-16).",
  pin: true,
});
part(() => box(0.012, 0.014, 0.022), ["avionics"], {
  pos: P3(18.7, NAV3_BL.gma, 57.8),
  color: "#D32626",
  anim: (m) => {
    m.material = S().avx.backup ? mats("#FF4040").hi : mats("#B32020").on;
  },
  name: "DISPLAY BACKUP button",
  note: "Red button on the lower face of the GMA 1347: PFD instruments plus the EIS on both displays; press again to cancel (POH 7-11, CRG 109).",
  pin: true,
});
(
  [
    [
      136,
      -4.5,
      "GIA 63 #1",
      "Integrated avionics unit in the tailcone racks behind the baggage curtain, arm 134.0: GPS, VHF NAV/COM and main processor. NAV 1 ENG (ESS and AVN BUS 1) and COMM 1 (ESS) breakers (POH 7-67, 6-20).",
    ],
    [
      136,
      4.5,
      "GIA 63 #2",
      "Second integrated avionics unit: NAV 2 and COMM 2 on AVIONICS BUS 2. The first GIA to get a 3-D GPS fix is the active GPS source. The KAP 140 takes its NAV, HDG and GPS roll-steering signals through GIA #2 (POH 7-67; Fig. S3-1).",
    ],
  ] as [number, number, string, string][]
).forEach(([fs, bl, name, note]) =>
  part(() => box(0.24, 0.07, 0.13), bl > 0 ? ["avionics", "autopilot"] : ["avionics"], {
    pos: P3(fs, bl, 49.5),
    color: AVX,
    name,
    note,
    pin: true,
  }),
);
part(() => box(0.12, 0.08, 0.1), ["avionics", "pitot"], {
  pos: P3(140, 0, 43.5),
  color: AVX,
  name: "GRS 77 AHRS",
  note: "Tailcone, arm 134.0: accelerometers, tilt and rate sensors for attitude and heading. ADC AHRS breakers on the ESS bus and AVN BUS 1. The KAP 140 doesn't use it for attitude — it has its own turn coordinator — but HDG mode needs its heading (POH 7-67, 3-26).",
  pin: true,
});
part(() => box(0.12, 0.06, 0.1), ["avionics", "pitot"], {
  pos: P3(11.4, NAV3_BL.mfd, 61.5),
  color: AVX,
  name: "GDC 74A air data computer",
  note: "Behind the panel just forward of the MFD, arm 11.4: pressure altitude, airspeed, TAS, vertical speed and OAT from the pitot-static system and the OAT probe (POH 7-67, 6-23).",
  pin: true,
});
part(() => box(0.1, 0.07, 0.12), ["avionics", "engine"], {
  pos: P3(11.4, -3, 57),
  color: AVX,
  name: "GEA 71 engine/airframe unit",
  note: "Forward of the panel, arm 11.4: RPM, MAP, fuel flow, oil, CHT/EGT, fuel quantity, vacuum and bus voltages to the EIS. NAV 1 ENG breakers (ESS and AVN BUS 1) (POH 7-28, 7-67).",
  pin: true,
});
part(() => box(0.14, 0.06, 0.12), ["avionics"], {
  pos: P3(140, 5, 52.5),
  color: AVX,
  name: "GTX 33 transponder",
  note: "Mode S, in the tailcone racks, arm 134.0; controlled from the PFD. XPNDR breaker, AVIONICS BUS 2 — not available on the standby battery (POH 7-67, 3-35).",
  pin: true,
});
part(() => box(0.06, 0.03, 0.06), ["avionics"], {
  pos: wp(-170, cAt(44, 170)),
  color: AVX,
  name: "GMU 44 magnetometer",
  note: "Inside the left wing panel, arm 44.0 (spanwise station not given): heading reference for the AHRS (POH 7-67, 6-23).",
  pin: true,
});
part(() => box(0.12, 0.05, 0.1), ["avionics"], {
  pos: P3(11.4, NAV3_BL.mfd, 55),
  color: "#9C4C88",
  name: "GDL 69A data link",
  note: "XM weather and radio, behind the panel just forward of the MFD, arm 11.4; FIS breaker, AVIONICS BUS 1 (if installed) (POH 7-68, 6-23).",
});
part(() => box(0.06, 0.05, 0.1), ["avionics", "electrical"], {
  pos: P3(12.7, 0, 63),
  color: "#5A6168",
  anim: glow("#5A6168", () => EL().fwdFan, ["avionics", "electrical"], "#9FE3FF"),
  name: "Forward avionics cooling fan",
  note: "Forward of the panel, arm 12.7: draws air from between the firewall and the panel and blows it up the inside of the windshield; on the AVN BUS 1 PFD breaker. Preflight: AVIONICS BUS 1 on — verify the fan is heard (POH 7-69, 4-7).",
  pin: true,
});
part(() => box(0.06, 0.08, 0.08), ["avionics", "electrical"], {
  pos: P3(125.5, 0, 55),
  color: "#5A6168",
  anim: glow("#5A6168", () => EL().aftFan, ["avionics", "electrical"], "#9FE3FF"),
  name: "Aft avionics cooling fan",
  note: "Tailcone, arm 125.5: forced air to the GIAs and the transponder; NAV 2 breaker, AVIONICS BUS 2. None of the four fans runs on the standby battery (POH 7-69).",
  pin: true,
});
part(() => box(0.06, 0.06, 0.06), ["avionics", "autopilot"], {
  pos: P3(15.5, 4, 53),
  color: "#9C4C88",
  anim: glow("#9C4C88", () => S().avx.tcFail, ["avionics", "autopilot"], "#E0263B"),
  name: "DC turn coordinator (KAP 140)",
  note: "“A DC electric powered turn coordinator, installed forward of the instrument panel and not visible to the pilot, provides a roll rate signal to the KAP 140”, arm 15.5. Its loss disengages the autopilot (POH 7-12, 6-23).",
  pin: true,
});
/* ---------- faceplate detail (POH Figure 7-2; CRG): GDU 1040 knobs and softkeys, GMA 1347 keys, switch rockers, breaker heads ---------- */
[NAV3_BL.pfd, NAV3_BL.mfd].forEach((bl) => {
  const c = P3(18.1, bl, 61.4),
    x = c[0] - 0.015 - 0.006; // just aft of the bezel face
  part(() => gduKnobs(), ["avionics"], { pos: [x, c[1], c[2]], color: "#3A4046" });
  part(gduKeys, ["avionics"], { pos: [x + 0.003, c[1] + GDU_KEYS_Y, c[2]], color: "#4A525A" });
});
part(gmaKeys, ["avionics"], { pos: [X(18.1) - 0.018, Y(61.4), Z(NAV3_BL.gma)], color: "#4A525A" });
part(gmaKnob, ["avionics"], { pos: [X(18.1) - 0.02, Y(61.4) + GMA_KNOB_Y, Z(NAV3_BL.gma)], color: "#3A4046" });
// switch panel rockers, up = ON (POH 7-10): BEACON, LAND, TAXI, NAV, STROBE on top; FUEL PUMP, PITOT HEAT, CABIN PWR 12V below
switchRows([
  [
    () => S().lights.beacon,
    () => S().lights.land,
    () => S().lights.taxi,
    () => S().lights.nav,
    () => S().lights.strobe,
  ],
  [() => S().fuel.pump, () => S().pitot.heat, () => S().lights.cabinPwr],
]).forEach(([y, z, on]) =>
  part(() => box(0.01, 0.022, 0.012), ["electrical", "lighting"], {
    pos: [X(17.9) - 0.011, Y(53.8) + y, Z(-13.3) + z],
    color: "#D8DDE0",
    anim: (m) => {
      m.rotation.z = on() ? -0.3 : 0.3;
    },
  }),
);
part(() => cbHeads(4), ["electrical"], { pos: [X(17.9) - 0.009, Y(50), Z(-16.6)], color: "#1A1D20" });
part(() => cbHeads(8), ["electrical", "avionics"], { pos: [X(17.9) - 0.009, Y(50), Z(-11.4)], color: "#1A1D20" });

const ANT = "#C8399F";
/** Swept blade antenna, base on the skin: base chord 0.14 m, tip chord 0.06 m, 0.22 m tall, leading edge swept ≈ 30°. */
const bladeAnt = () => {
  const sh = new THREE.Shape();
  sh.moveTo(0.07, 0);
  sh.lineTo(-0.057, 0.22);
  sh.lineTo(-0.117, 0.22);
  sh.lineTo(-0.07, 0);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.006, bevelEnabled: false });
  g.translate(0, 0, -0.003);
  return g;
};
part(bladeAnt, ["avionics"], {
  pos: [X(61.2), top(61.2, 7) - 0.005, Z(7)],
  color: ANT,
  name: "COM 1 / GPS 1 antenna",
  note: "Top of the cabin, right side, arm 61.2 (POH 7-69).",
  ext: true,
  pin: true,
});
part(bladeAnt, ["avionics"], {
  pos: [X(61.2), top(61.2, -7) - 0.005, Z(-7)],
  color: ANT,
  name: "COM 2 / GPS 2 / XM antenna",
  note: "Top of the cabin, left side, arm 61.2 (POH 7-69).",
  ext: true,
  pin: true,
});
[1, -1].forEach((s) =>
  part(() => box(0.36, 0.02, 0.006), ["avionics"], {
    pos: [fLE(Y(88)) - 0.12, Y(88), s * 0.06],
    rot: [s * 0.5, 0, -0.1],
    color: ANT,
    name: "VOR/GS navigation antenna",
    note: "Blade-type element on either side of the vertical stabilizer (POH 7-69).",
    ext: true,
    pin: s > 0,
  }),
);
part(() => box(0.28, 0.012, 0.08), ["avionics"], {
  pos: [X(131.5), botY(X(131.5)) - 0.006, 0],
  color: ANT,
  name: "Marker beacon antenna",
  note: "Bottom of the tailcone, arm 131.5 (POH 7-70).",
  ext: true,
  pin: true,
});
part(() => cyl(0.006, 0.08), ["avionics"], {
  pos: [X(86.5), botY(X(86.5)) - 0.04, Z(2)],
  color: ANT,
  name: "Transponder antenna",
  note: "Bottom of the cabin, arm 86.5 (POH 7-70).",
  ext: true,
  pin: true,
});
part(() => box(0.08, 0.05, 0.008), ["avionics"], {
  pos: [X(114.5), botY(X(114.5)) - 0.026, Z(-2)],
  color: "#9C4C88",
  name: "DME antenna (if installed)",
  note: "Bottom of the tailcone, arm 114.5 (KN 63 option, POH 6-23).",
  ext: true,
});
part(() => box(0.05, 0.045, 0.06), ["avionics", "cabin"], {
  pos: P3(19.5, 0, 68.3),
  color: "#20262B",
  anim: glow("#20262B", () => EL().lit.stbyInd, ["avionics", "cabin"], "#E8C46A"),
  name: "Magnetic compass (non-stabilized)",
  note: "Arm 18.0 (cockpit position not in the POH — modelled on top of the glareshield, inside the windshield). Required for all operations (KOEL) and the heading source after an AHRS failure; lit by the STDBY IND dimmer; deviation card in 30° steps (POH 2-13, 3-28, 7-59).",
  pin: true,
});
part(() => box(0.065, 0.008, 0.035), ["avionics", "cabin"], { pos: P3(18.4, 0, 67.3), color: "#20262B" }); // compass bracket on the glareshield

/* ---------- KAP 140 (POH 7-12, Supplement 3) ---------- */
const tr = (g: THREE.BufferGeometry, x: number, y: number, z: number) => {
  g.translate(x, y, z);
  return g;
};
/** KAP 140 faceplate on the center panel below the standby instruments (Fig. 7-2 item 13); LCD drawn by Airplane.tsx. */
export const KAP = { fs: 18.15, bl: 0.6, h: 49.4, w: 0.16, hgt: 0.034 };
const kapOn = () => live.kap.powered;
const apBtn: PartAnim = (m) => {
  const k = live.kap,
    lit = k.powered && kap140Phase(k, live.fs.t).ph === "ready";
  m.material = !lit ? mats("#2B3035").on : k.ap ? mats("#7CFF8A").hi : mats("#3A4046").on;
};
part(() => box(0.02, KAP.hgt, KAP.w), ["autopilot", "avionics"], {
  pos: P3(KAP.fs - 0.4, KAP.bl, KAP.h),
  color: "#202428",
  name: "KAP 140 flight computer",
  pin: true,
  note: "Bendix/King KAP 140 two-axis autopilot with altitude preselect and GPS roll steering, arm 12.0 (22-01-S): display, mode keys, UP/DN, ARM, BARO and the altitude-select knobs in one panel-mounted unit. AUTO PILOT 5 A breaker, AVIONICS BUS 2 (POH 7-12, S3-10).",
});
(["AP", "HDG", "NAV", "APR", "REV", "ALT"] as const).forEach((k, i) =>
  part(() => box(0.008, 0.007, 0.014), ["autopilot"], {
    pos: [X(KAP.fs + 0.2), Y(KAP.h) - 0.011, Z(KAP.bl) - 0.062 + i * 0.019],
    color: "#3A4046",
    anim:
      k === "AP"
        ? apBtn
        : (m) => {
            const s = live.kap;
            const on = s.ap && (s.lat === k || s.vert === k || s.latArm === k);
            m.material = on ? mats("#7CFF8A").on : mats(kapOn() ? "#3A4046" : "#2B3035").on;
          },
    ...(i === 0
      ? {
          name: "KAP 140 mode keys",
          note: "AP (engage: ROL + VS), HDG, NAV, APR, REV and ALT. Lit here while the mode is active. AP needs the self-test complete and the red P out (≈ 30 s after power-up) (S3-8 – S3-12).",
        }
      : {}),
  }),
);
part(() => mergeGeos([0.011, 0.003, -0.006, -0.014].map((y) => tr(box(0.008, 0.007, 0.011), 0, y, 0))), ["autopilot"], {
  pos: [X(KAP.fs + 0.2), Y(KAP.h), Z(KAP.bl) + 0.0475],
  color: "#3A4046",
  name: "KAP 140 ARM, BARO, UP and DN keys",
  note: "ARM turns altitude arming on or off; BARO shows the baro setting for 3 s (hold 2 s: IN HG ↔ HPA); UP / DN change the VS reference 100 fpm a press (300 fpm/s held) or the ALT reference 20 ft (500 fpm held) (S3-10 – S3-12).",
});
part(() => cyl(0.012, 0.012, "x"), ["autopilot"], {
  pos: [X(KAP.fs + 0.25), Y(KAP.h), Z(KAP.bl) + 0.068],
  color: "#30353A",
  name: "Altitude select knobs",
  note: "Concentric rotary knobs: set the altitude alerter reference altitude, or the baro setting right after BARO is pressed (S3-11). Selecting an altitude with them while the autopilot is engaged arms ALT automatically (S3-12). Step sizes are not in the POH (1,000 / 100 ft modelled).",
});

/** KAP 140 servos (equipment list 22-01-S, POH 6-20): they glow while driving. */
const servo = (on: () => boolean): PartAnim => glow("#7C57CF", on, ["autopilot", "controls"], "#FFD34D");
const SV = RIG_SPEC.servo;
part(() => box(0.12, 0.08, 0.1), ["autopilot", "controls"], {
  pos: P3(SV.roll[0], SV.roll[1], SV.roll[2] - 2.6),
  color: "#7C57CF",
  chan: ["aileron"],
  anim: servo(() => live.kap.ap),
  name: "KS 271C roll servo",
  note: "Arm 52.0, on the aileron cables across the cabin top. Drives the ailerons — and so the control wheels — while the autopilot is engaged; easily overpowered (S3-7, POH 6-20).",
  pin: true,
});
part(() => box(0.12, 0.08, 0.1), ["autopilot", "controls"], {
  pos: P3(SV.pitch[0], SV.pitch[1] + 1.5, SV.pitch[2]),
  color: "#7C57CF",
  chan: ["elevator"],
  anim: servo(() => live.kap.ap),
  name: "KS-270C pitch servo",
  note: "Tailcone, arm 158.8, on the elevator cables. Pitch modes VS, ALT and GS move the elevator, and the control wheels with it (S3-7, POH 6-20).",
  pin: true,
});
part(() => box(0.1, 0.08, 0.09), ["autopilot", "controls"], {
  pos: P3(SV.trim[0], SV.trim[1] - 1.5, SV.trim[2]),
  color: "#7C57CF",
  chan: ["elevator"],
  anim: servo(() => live.kap.pt != null || (live.kap.ap && live.timers.trimRun > 0)),
  name: "KS-272C pitch trim servo",
  note: "Tailcone, arm 176.4, on the elevator trim cable: autotrim while engaged, manual electric trim (MET) otherwise — so the trim wheel turns. A trim fault lights PT and the red PITCH TRIM on the PFD (S3-11, S3-21).",
  pin: true,
});
// the Kap140 faceplate's position is shared with the screen in Airplane.tsx
export const KAP_LCD = { pos: P3(KAP.fs + 0.05, KAP.bl - 0.6, KAP.h + 0.3), size: [0.085, 0.0213] as [number, number] };
