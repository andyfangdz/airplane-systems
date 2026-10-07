import { V, toVec3, type Vec3 } from "@/lib/math";
import { PANEL_X, box, botY, cyl, fs, sph, wingP } from "../geometry";
import { part, sim, glow, selPtrAnim } from "./catalogue";

/* ---------- fuel system (tanks rendered separately) ---------- */
[1, -1].forEach((s) => {
  const nm = s > 0 ? "Right" : "Left";
  part(() => cyl(0.04, 0.012), ["fuel"], {
    pos: toVec3(wingP(s * 3.45, 0.32, 1).add(V(0, 0.006, 0))),
    color: "#2F7FE6",
    name: "Fuel filler neck",
    note: "At the outboard end of each tank (AFM 7-31). Placard AVGAS 100LL, 94 l / 25 US gal (long range). Ground the airplane at the step latches before refuelling (AFM 2-25, 4A-40).",
    ext: true,
    pin: s > 0,
  });
  part(() => sph(0.022), ["fuel"], {
    pos: toVec3(wingP(s * 1.22, 0.42, -1)),
    color: "#0B3A80",
    name: nm + " tank drain",
    note: "Outlet valve at the tank's lowest, inboard point, behind a finger filter (AFM 7-35). Drain before every flight. The measuring device's connector is pressed against this drain (AFM 7-38).",
    ext: true,
    pin: s > 0,
  });
  part(() => box(0.08, 0.025, 0.04), ["fuel"], {
    pos: toVec3(wingP(s * 1.24, 0.44, 0)),
    color: "#2F7FE6",
    name: "Finger filter",
    note: "Coarse filter before the tank outlet (AFM 7-35).",
  });
  [3.9, 4.04].forEach((z, i) =>
    part(() => cyl(0.008, 0.05), ["fuel"], {
      pos: toVec3(wingP(s * z, 0.45, -1).add(V(0, -0.02, 0))),
      color: "#2F7FE6",
      name: i ? "Tank vent — check valve" : "Tank vent — capillary",
      note: i
        ? "Lets air into the tank but not fuel out (AFM 7-34)."
        : "Two separate vents per tank on the wing underside about 2 m from the tip; the capillary equalises pressure and backs up the other vent (AFM 7-34).",
      ext: true,
      pin: s > 0,
    }),
  );
});
export const SEL: Vec3 = [fs(2.38), -0.32, 0];
part(() => cyl(0.04, 0.025, "y"), ["fuel"], {
  pos: SEL,
  name: "Fuel tank selector",
  note: "On the centre console: LEFT / RIGHT / OFF. To reach OFF, pull up the safety catch while turning right. No BOTH position — switch tanks to stay within 8 US gal (AFM 7-33, 2-23).",
  pin: true,
});
part(() => box(0.07, 0.012, 0.015), ["fuel"], {
  pos: [SEL[0], SEL[1] + 0.016, SEL[2]],
  color: "#F2F5F7",
  anim: selPtrAnim,
});
part(() => box(0.02, 0.045, 0.02), ["fuel", "electrical"], {
  pos: [PANEL_X - 0.03, -0.17, 0.025],
  color: "#3F4B54",
  anim: (m) => {
    m.rotation.z = sim().s.fuel.pump ? -0.35 : 0.35;
  },
  pinIn: ["fuel"],
  name: "FUEL PUMP switch",
  note: "On the switch row: ON for start (note pump noise), take-off, landing, tank switching, high altitude and low fuel pressure (AFM 7-33; AFMS p. 39–47). FUEL PUMP 5 A on the MAIN bus — lost on ESS BUS only.",
  pin: true,
});
part(() => cyl(0.04, 0.1), ["fuel"], {
  pos: [fs(1.89), -0.56, 0],
  color: "#7E8A93",
  name: "Gascolator",
  note: "Lowest point of the fuel system. Its drain is on the fuselage centreline about 30 cm forward of the wing leading edge (AFM 7-35). One of 3 drains.",
  pin: true,
});
part(() => cyl(0.015, 0.05), ["fuel"], {
  pos: [fs(1.89), botY(fs(1.89)) - 0.015, 0],
  color: "#0B3A80",
  name: "Gascolator drain",
  note: "Drain a small quantity and check for water and sediment (AFM 4A-10).",
  ext: true,
});
part(() => box(0.1, 0.08, 0.09), ["fuel", "electrical"], {
  pos: [fs(1.6), -0.55, 0.07],
  color: "#2F7FE6",
  anim: glow("#245C9E", "#7FB8FF", () => sim().s.fuel.pump && sim().E.pumpPwr, ["fuel", "electrical"]),
  name: "Electric fuel pump",
  note: "Auxiliary and emergency pump, drawn with a bypass so fuel passes when it is off (AFM 7-31, 7-33). Location shown is approximate.",
  pin: true,
});
part(() => box(0.04, 0.04, 0.04), ["fuel", "engine", "avionics"], {
  pos: [fs(0.83), -0.28, 0.08],
  color: "#2F7FE6",
  name: "Fuel-pressure sensor (Kulite)",
  note: "On a sensor mount at the oil sump (FS 830), hosed to the fuel-pressure port; FUEL PRES LO < 14 psi, HI > 35 psi (SMM 2-18; AFMS p. 19).",
});
