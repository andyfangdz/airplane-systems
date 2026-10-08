import { toVec3 } from "@/lib/math";
import type { SysId } from "@/lib/systems";
import { PANEL_X, box, cyl, fs, onSkin } from "../geometry";
import { part, sim, glow } from "./catalogue";
import { CBP_Z } from "./cabin";

/* ---------- electrical ---------- */
// arm 1.19 m puts it between the rear right cylinder (cyl 3) and the firewall, so it stands with its narrow side fore-aft
part(() => box(0.1, 0.18, 0.24), ["electrical", "engine"], {
  pos: [fs(1.19), -0.14, 0.31],
  pinIn: ["electrical"],
  color: "#D9960F",
  name: "Main battery — 24 V, 11 Ah",
  note: "Lead-acid battery mounted in the right-hand side of the engine compartment (AFM 7-42), arm 1.19 m — Concorde CB24-11M, RG24-11M or RG24-15M per the equipment list (AFM 6-19); which one N949KC has is not in the documents. Here that arm puts it just behind the rear right cylinder, ahead of the firewall; its height and orientation are approximate (not in the documents). Connected through the battery relay and the main 70 A breaker (BATT) to the ESSENTIAL bus (AFM 7-42; SMM 2-11).",
  pin: true,
});
part(() => box(0.1, 0.08, 0.12), ["electrical"], {
  pos: [fs(1.3), -0.04, 0.32],
  color: "#6E5A2A",
  name: "Relay box",
  note: "Battery relay, START relay and external-power relay on one bus bar (AFM 7-40/7-41). Location not given — shown beside the battery.",
  pin: true,
});
part(() => box(0.08, 0.07, 0.02), ["electrical"], {
  pos: toVec3(onSkin(fs(1.42), -0.36, 1, 1.01)),
  color: "#3F4B54",
  name: "External power receptacle",
  note: "Behind an access panel (AFM 4B-14); location not in the AFM. Not for starting with a flat battery if the flight will be IFR (AFM 2-32).",
  ext: true,
  pin: true,
});
part(() => box(0.1, 0.06, 0.08), ["electrical"], {
  pos: [fs(0.58), -0.06, -0.22],
  color: "#5A5040",
  name: "Voltage regulator (VR2000)",
  note: "Regulates the alternator field; its over-voltage protection opens the field (AFM 6-20, 7-41 figure). Location not in the documents.",
});
part(() => box(0.02, 0.19, 0.15), ["electrical"], {
  pos: [PANEL_X - 0.03, -0.03, CBP_Z],
  color: "#3A3F44",
  pinIn: [],
  name: "Circuit-breaker panel",
  note: "Right of the MFD, six rows around the right air nozzle (SMM Fig. 2-1): rows 1–3 essential, 4–5 main, 6 avionics (inferred from the schematics — the drawing has no bus headings; AUDIO is re-bussed to ESSENTIAL on the GFC 700 airplane). Push-pull breakers with the rating on the button.",
  pin: true,
});
part(() => box(0.06, 0.05, 0.05), ["electrical"], {
  pos: [PANEL_X + 0.08, -0.08, 0.37],
  pinIn: [],
  color: "#D9960F",
  name: "Alternator current sensor",
  note: "Around the ALT breaker cable behind the breaker panel; the GEA 71 reads it for AMPS and the ALTERNATOR warning (SMM 2-22).",
  pin: true,
});
part(() => box(0.05, 0.04, 0.04), ["electrical"], {
  pos: [PANEL_X + 0.08, 0.0, 0.42],
  color: "#B85A2A",
  name: "Transient voltage suppressors + 3.2 A fuses",
  note: "Lightning protection: TVS on the battery and alternator breakers, each with a 3.2 A slow-blow fuse; replace every 2 years (SMM 2-12, 4-1).",
});
part(() => box(0.12, 0.08, 0.1), ["electrical", "avionics", "lighting"], {
  pos: [fs(1.69), -0.16, 0.3],
  color: "#D9960F",
  anim: glow("#6E5A2A", "#FFD24A", () => sim().s.elec.emerg && !sim().E.emergDead, [
    "electrical",
    "avionics",
    "lighting",
  ]),
  name: "Emergency battery (lithium pack)",
  note: "Powers only the standby attitude indicator and the flood light, for 1 h 30 min, when the HORIZON EMERGENCY switch is ON (AFM 7-42). Arm 1.69 m, co-pilot side behind the panel.",
  pin: true,
});
// switch rows (SMM Fig. 2-1)
const SW = (
  name: string,
  z: number,
  y: number,
  sys: SysId[],
  note: string,
  on: () => boolean,
  color = "#3F4B54",
  pin = true,
  pinIn?: SysId[],
) =>
  part(() => box(0.02, 0.045, 0.018), sys, {
    pos: [PANEL_X - 0.03, y, z],
    color,
    anim: (m) => {
      m.rotation.z = on() ? -0.35 : 0.35;
    },
    name,
    note,
    pin,
    pinIn,
  });
SW(
  "Master switch ALT / BAT",
  -0.3,
  -0.17,
  ["electrical"],
  "Split rocker: ALT on the left, BAT on the right; together 'Master switch (ALT/BAT)' (AFM 7-43). BAT closes the battery relay; ALT powers the alternator field through ALT CONT.",
  () => sim().s.elec.bat,
);
SW(
  "AVIONIC MASTER switch",
  -0.34,
  -0.17,
  ["electrical", "avionics", "autopilot"],
  "Closes the main (avionics) relay to power the MAIN AVIONICS bus: GIA 2, COM 2, GFC 700, GDL 69A. Also a way to disable the autopilot and electric trim (AFMS p. 10).",
  () => sim().s.elec.avMaster,
  undefined,
  true,
  ["avionics", "autopilot"],
);
SW(
  "ESS. BUS switch",
  -0.37,
  -0.17,
  ["electrical"],
  "Placard: 'Ess. Bus NOT for normal operation. See AFM.' ON opens the tie relay so the battery feeds only the ESSENTIAL bus (alternator failure, smoke) (AFM 2-28; AFMS p. 29–32).",
  () => sim().s.elec.essBus,
);
SW(
  "HORIZON EMERGENCY switch",
  -0.18,
  0.15,
  ["electrical", "avionics", "lighting"],
  "Sealed, guarded switch. ON feeds the standby attitude and flood light from the emergency battery. IFR is not permitted with the seal broken (AFM 2-32, 7-42).",
  () => sim().s.elec.emerg,
  "#B53A3A",
  true,
  ["avionics", "lighting"],
);
SW(
  "PITOT switch",
  0.055,
  -0.17,
  ["pitot", "electrical"],
  "Pitot heat ON/OFF. PITOT 10 A on ESSENTIAL. Yellow PITOT OFF when off, PITOT FAIL on a heater fault (AFM 7-45; AFMS p. 19).",
  () => sim().s.pitot.heat,
  undefined,
  true,
  ["pitot"],
);
SW(
  "LANDING light switch",
  -0.275,
  0.15,
  ["lighting"],
  "LIGHTS row: LANDING (ESSENTIAL, 5 A).",
  () => sim().s.lights.landing,
);
SW(
  "TAXI light switch",
  -0.253,
  0.15,
  ["lighting"],
  "TAXI (TAXI/MAP 5 A, MAIN).",
  () => sim().s.lights.taxi,
  "#3F4B54",
  false,
);
SW(
  "POSITION light switch",
  -0.231,
  0.15,
  ["lighting"],
  "POSITION (5 A, MAIN). Position lights must always be on at night (AFMS p. 45).",
  () => sim().s.lights.position,
  "#3F4B54",
  false,
);
SW(
  "STROBE light switch",
  -0.209,
  0.15,
  ["lighting"],
  "STROBE (5 A, MAIN) — the strobes are the anti-collision lights (ACL); off when close to other aircraft or in cloud at night (AFMS p. 45).",
  () => sim().s.lights.strobe,
  "#3F4B54",
  false,
);
(
  [
    [
      "INSTRUMENT dimmer",
      -0.35,
      () => sim().s.lights.instr,
      "Rotary knob in the LIGHTS group: switches on and dims the instrument lighting (INST 3 A, MAIN) (AFM 7-44).",
    ],
    [
      "FLOOD dimmer",
      -0.31,
      () => sim().s.lights.flood,
      "Rotary knob: switches on and dims the glareshield flood light (FLOOD 5 A, ESSENTIAL; or the emergency battery) (AFM 7-44).",
    ],
  ] as [string, number, () => number, string][]
).forEach(([name, z, v, note]) =>
  part(() => cyl(0.014, 0.02, "x", 16), ["lighting"], {
    pos: [PANEL_X - 0.03, 0.15, z],
    color: "#1B1F23",
    anim: (m) => {
      m.rotation.x = -1.2 + v() * 2.4;
    },
    name,
    note,
    pin: true,
  }),
);
