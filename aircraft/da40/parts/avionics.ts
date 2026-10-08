import { toVec3, type Vec3 } from "@/lib/math";
import { PANEL_X, box, botY, cyl, fs, topY, tubeGeo, wingP } from "../geometry";
import { part, sim, glow } from "./catalogue";
import { GMA_Z } from "./cabin";

/* ---------- avionics LRUs (SMM §2, Fig. 2-2 / 2-6) ---------- */
part(() => box(0.03, 0.2, 0.058), ["avionics", "autopilot"], {
  pos: [PANEL_X - 0.035, -0.03, GMA_Z],
  color: "#1B1F23",
  pinIn: [],
  name: "GMA 1347 audio panel",
  note: "Between the displays: COM/NAV audio, intercom, marker beacon, clearance recorder. On ESSENTIAL (AUDIO 5 A) in the GFC 700 airplane so the AP disconnect tone is heard even with the avionics bus off (ELA).",
  pin: true,
});
part(() => box(0.012, 0.022, 0.026), ["avionics"], {
  pos: [PANEL_X - 0.056, -0.112, GMA_Z],
  color: "#B53A3A",
  anim: glow("#6E2424", "#FF4A4A", () => sim().s.avx.backup, ["avionics"]),
  name: "DISPLAY BACKUP button",
  note: "Red button at the bottom of the GMA 1347. OUT = reversionary (composite) mode on both displays; one attempt to return to normal is approved (CRG 11-1; AFMS p. 33).",
  pin: true,
});
/* ---------- display bezels, standby instrument cases, compass, ELT remote (XLS panel photos) ---------- */
/** Screen planes sit just proud of their bezels / cases on the panel's aft face (PANEL_X − 0.02). */
export const DISPLAY_X = PANEL_X - 0.046,
  STBY_X = PANEL_X - 0.026;
const BEZEL = "#1B1F23",
  KNOB = "#3A4148";
(
  [
    [-0.26, "PFD (GDU 1040)"],
    [0.13, "MFD (GDU 1042 / 1044)"],
  ] as [number, string][]
).forEach(([z, which], d) => {
  part(() => box(0.025, 0.21, 0.32), ["avionics", "autopilot"], {
    pos: [PANEL_X - 0.032, -0.03, z],
    color: BEZEL,
    name: `${which} bezel`,
    note: d
      ? "Knobs NAV, HDG, ALT (left) and COM, CRS/BARO, RANGE/PAN, FMS (right); the GFC 700 AFCS keys are on this bezel, and the VNV key only on the optional GDU 1044 (AFMS p. 57)."
      : "Knobs NAV, HDG, ALT (left) and COM, CRS/BARO, RANGE/PAN, FMS (right), 12 softkeys under the screen (CRG §1).",
  });
  // dual concentric knobs down each side of the screen
  [
    [-1, [0.04, -0.015, -0.11]],
    [1, [0.05, 0.005, -0.04, -0.085, -0.115]],
  ].forEach(([side, ys]) =>
    (ys as number[]).forEach((y) =>
      part(() => cyl(0.011, 0.016, "x", 16), ["avionics"], {
        pos: [PANEL_X - 0.052, y, z + (side as number) * 0.134],
        color: KNOB,
      }),
    ),
  );
  // softkey row under the screen
  for (let k = 0; k < 12; k++)
    part(() => box(0.006, 0.008, 0.011), ["avionics"], {
      pos: [PANEL_X - 0.047, -0.124, z - 0.1 + k * 0.0182],
      color: "#5A636B",
    });
});
[-0.107, -0.008, 0.089].forEach((z) =>
  part(() => box(0.016, 0.09, 0.09), ["avionics"], { pos: [STBY_X, 0.15, z], color: BEZEL }),
);
part(() => box(0.05, 0.05, 0.06), ["avionics"], {
  pos: [PANEL_X - 0.045, 0.15, 0.168],
  color: BEZEL,
  name: "Magnetic compass",
  note: "Standby compass in the top row, right of the standby altimeter (XLS panel photos). Its loss has no effect on the autopilot (AFMS p. 10).",
  pin: true,
  pinIn: [],
});
part(() => box(0.006, 0.026, 0.034), ["avionics"], { pos: [PANEL_X - 0.072, 0.15, 0.168], color: "#E8E2CF" });
part(() => box(0.012, 0.03, 0.045), ["cabin", "avionics"], {
  pos: [PANEL_X - 0.026, 0.15, 0.31],
  color: "#2B2F33",
  name: "ELT remote switch",
  note: "ARM / ON remote switch with its indicator light, upper right of the panel (XLS panel photos; an Artex remote switch is listed in AFM 6-21).",
  pin: true,
  pinIn: [],
});
part(() => box(0.006, 0.014, 0.016), ["cabin", "avionics"], { pos: [PANEL_X - 0.034, 0.15, 0.316], color: "#D9442A" });
part(() => box(0.1, 0.16, 0.05), ["avionics", "engine"], {
  pos: [PANEL_X + 0.1, -0.05, -0.3],
  pinIn: ["avionics"],
  color: "#C8399F",
  name: "GEA 71 engine/airframe unit",
  note: "Behind the panel, vertical. Reads MAP, RPM, oil, fuel, CHT/EGT, volts, alternator current, fuel probes, pitot heat, door switches and starter engage; ENG INST 5 A on ESSENTIAL (SMM 2-3).",
  pin: true,
});
part(() => box(0.15, 0.06, 0.12), ["avionics", "pitot"], {
  pos: [PANEL_X + 0.1, 0.06, 0.12],
  color: "#C8399F",
  name: "GDC 74A air data computer",
  note: "On a rack behind the panel, right of centre; hosed to the pitot-static system. ADC 5 A, ESSENTIAL (SMM 2-5).",
  pin: true,
});
(
  [
    [-0.18, "PFD cooling fan"],
    [0.22, "MFD cooling fan"],
  ] as [number, string][]
).forEach(([z, name]) =>
  part(() => cyl(0.03, 0.03, "x", 14), ["avionics", "electrical"], {
    pos: [PANEL_X + 0.06, 0.03, z],
    color: "#8A6C9A",
    anim: glow("#5A4A62", "#C8399F", () => sim().E.cduFan, ["avionics", "electrical"]),
    name,
    note:
      "Behind the panel; CDU FAN 3 A on MAIN. Failure → white " +
      (z < 0 ? "PFD" : "MFD") +
      " FAN FAIL advisory (SMM 5-9).",
  }),
);
export const ENCL: Vec3 = [fs(3.83), -0.56, 0];
part(() => box(0.32, 0.12, 0.34), ["avionics"], {
  pos: ENCL,
  color: "#5A3550",
  fairing: true,
  name: "Remote avionics enclosure",
  note: "Under the baggage floor (FS 3832): GIA 63W ×2, GTX 33, GDL 69A, the CI-1125 NAV diplexer and lightning-protection fuses; cooled by a ducted blower (SMM 2-3, 2-9). The enclosure dimensions and LRU arrangement are representative, not a measured installation drawing.",
  pin: true,
});
(
  [
    [
      -0.11,
      "GIA 63W #1",
      "WAAS GPS 1, COM 1, NAV 1/GS 1 and integration; flight-director logic. COM 1 + GPS/NAV 1 on ESSENTIAL (SMM 2-3).",
    ],
    [
      0.0,
      "GIA 63W #2",
      "GPS 2, COM 2, NAV 2/GS 2. On the MAIN AVIONICS bus — its loss stops the autopilot and electric trim (AFMS p. 10).",
    ],
    [
      0.11,
      "GTX 33 transponder",
      "Mode S, remote-mounted in the enclosure; XPDR 5 A on ESSENTIAL. (N949KC is reported as later upgraded to a GTX 345R.)",
    ],
  ] as [number, string, string][]
).forEach(([z, name, note]) =>
  // Low-profile envelopes fit below the baggage floor and above the elevator push rod.
  part(() => box(0.28, 0.07, 0.1), ["avionics"], {
    pos: [ENCL[0], ENCL[1] + 0.02, z],
    color: "#C8399F",
    name,
    note,
    pin: true,
  }),
);
part(() => box(0.1, 0.06, 0.08), ["avionics"], {
  pos: [ENCL[0] - 0.22, ENCL[1], 0.0],
  color: "#8A6C9A",
  anim: glow("#5A4A62", "#C8399F", () => sim().E.avFan, ["avionics", "electrical"]),
  name: "Avionics enclosure blower",
  note: "Remote avionics blower with an air duct to the enclosure; AV FAN 3 A, MAIN. Failure → white GIA FAN FAIL (SMM 2-9, 5-9).",
});
part(() => box(0.12, 0.07, 0.1), ["avionics"], {
  pos: [fs(3.83), -0.39, 0.174],
  color: "#C8399F",
  name: "GRS 77 AHRS",
  note: "In the baggage compartment, starboard of the remote avionics enclosure (RBL 174). AHRS 5 A, ESSENTIAL; also powers the GMU 44 (SMM 2-6). Shown above the baggage floor; mounting height and case dimensions are approximate.",
  pin: true,
});
part(() => box(0.07, 0.04, 0.07), ["avionics"], {
  pos: toVec3(wingP(2.6, 0.45, 0)),
  color: "#C8399F",
  name: "GMU 44 magnetometer",
  note: "Under the right wing at the old flux-valve location, behind an access plate (SMM 2-7). Span station approximate.",
  pin: true,
});
part(
  () =>
    tubeGeo(
      [
        [fs(2.0), botY(fs(2.0)) + 0.01, 0.3],
        [fs(2.0) + 0.01, botY(fs(2.0)) - 0.06, 0.3],
      ],
      0.006,
    ),
  ["avionics", "pitot"],
  {
    color: "#8C959C",
    name: "GTP 59 OAT probe",
    note: "On the bottom starboard side of the fuselage; feeds the GDC 74A (SMM 2-5).",
    ext: true,
    pin: true,
  },
);
const ANT = "#C8399F";
part(
  () => {
    const g = cyl(0.006, 0.42);
    g.rotateZ(0.5);
    return g;
  },
  ["avionics"],
  {
    pos: [fs(4.55), topY(fs(4.55)) + 0.18, 0],
    color: ANT,
    solidColor: "#E3E6E8",
    name: "COM 1 antenna",
    note: "Whip on top of the fuselage behind the cabin. Antenna locations are not in the documents — placed from photos of DA40 XLS airplanes.",
    ext: true,
    pin: true,
  },
);
part(
  () => {
    const g = tubeGeo(
      [
        [0, 0, 0],
        [0, -0.16, 0],
        [-0.22, -0.2, 0],
      ],
      0.006,
    );
    return g;
  },
  ["avionics"],
  {
    pos: [fs(4.25), botY(fs(4.25)), 0],
    color: ANT,
    solidColor: "#E3E6E8",
    name: "COM 2 antenna",
    note: "Bent whip under the fuselage (placed from photos).",
    ext: true,
    pin: true,
  },
);
[
  [fs(3.95), "GPS 1 antenna"],
  [fs(4.25), "GPS 2 / XM antenna"],
].forEach(([x, name]) =>
  part(() => cyl(0.045, 0.02), ["avionics"], {
    pos: [x as number, topY(x as number) + 0.01, 0],
    color: ANT,
    solidColor: "#E3E6E8",
    name: name as string,
    note: "Garmin GA 56 (AFM 6-28), on top of the fuselage behind the cabin (placed from photos).",
    ext: true,
    pin: true,
  }),
);
part(() => box(0.08, 0.06, 0.012), ["avionics"], {
  pos: [fs(3.55), botY(fs(3.55)) - 0.03, 0.08],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "Transponder antenna",
  note: "Blade on the belly (KA 60/61, AFM 6-26; location assumed).",
  ext: true,
  pin: true,
});
part(() => box(0.24, 0.012, 0.08), ["avionics"], {
  pos: [fs(4.85), botY(fs(4.85)) - 0.006, 0],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "Marker beacon antenna",
  note: "Comant CI 102 (AFM 6-26); belly location assumed.",
  ext: true,
});
part(() => box(0.3, 0.01, 0.02), ["avionics"], {
  pos: [fs(7.3), 0.25, 0],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "NAV (VOR/LOC/GS) antenna",
  note: "Comant CI 157P (AFM 6-27), through the CI-1125 diplexer to both GIAs. Shown inside the composite fin — location not in the documents.",
});
part(() => cyl(0.004, 0.3), ["avionics", "cabin"], {
  pos: [fs(4.9), topY(fs(4.9)) + 0.15, 0.06],
  color: ANT,
  solidColor: "#E3E6E8",
  name: "ELT antenna",
  note: "ELT whip (location assumed).",
  ext: true,
});
