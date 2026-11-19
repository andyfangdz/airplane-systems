/** Structure: firewall, aft bulkhead, spar, roll cage, wing attach points. */
import { mergeGeos } from "@/lib/geometry";
import { V, toVec3 } from "@/lib/math";
import { AB, FW, FUSE, box, cyl, loft, planeRing, tubeGeo, fRing } from "../geometry";
import { TANK_CHORD, TANK_SPAN, attachPoint, mainSpar, rearWeb, rearWebChord, wingRib, ws } from "../wing-installation";
import { part } from "./catalogue";

/* ---------- structure ---------- */
part(() => planeRing(FW), ["airframe"], {
  id: "parts.structure.firewall-fs-100.001",
  plate: true,
  pin: true,
  name: "Firewall — FS 100",
  note: "Forward cabin boundary. Lower firewall has a 20° bevel for crashworthiness.",
});
part(() => planeRing(AB), ["airframe", "cabin"], {
  id: "parts.structure.aft-bulkhead-fs-222.002",
  plate: true,
  pin: true,
  name: "Aft bulkhead — FS 222",
  note: "Rear of the baggage compartment. Avionics bay, BAT 2, ELT and CAPS sit aft of it.",
});
part(mainSpar, ["airframe"], {
  id: "parts.structure.main-spar.003",
  name: "Main spar",
  color: "#424950",
  note: "The carbon/epoxy web and its two flanges form a continuous C-section beneath the front seats. The web also forms the forward wall of each integral wing tank (POH 7-5–6, AMM 28-10 and 57-10 p. 1).",
  pin: true,
});
// The solid-laminate cover bridges the open carry-through beneath the front seats.
part(
  () =>
    mergeGeos([
      box(0.19, 0.014, 0.86).translate(0, 0.116, 0),
      box(0.014, 0.2, 0.86).translate(0.088, 0.009, 0),
      box(0.014, 0.2, 0.86).translate(-0.088, 0.009, 0),
    ]),
  ["airframe"],
  {
    id: "parts.structure.spar-cover",
    name: "Spar cover",
    pos: [1.35, -0.57, 0],
    fairing: true,
    pin: true,
    note: "This solid-laminate fuselage structure carries wing reaction loads. The front seat track channels mount to its forward and aft faces (AMM 53-10 p. 1). Clearances and section are schematic.",
  },
);
part(
  () => {
    const rings = [-0.45, -0.35, -0.2, 0, 0.2, 0.35, 0.45].map((z) =>
      [
        [1.18, 0.003],
        [1.52, 0.003],
        [1.52, -0.002],
        [1.18, -0.002],
      ].map(([x, dy]) => V(x, FUSE.lowerSkinY(x, z) + dy, z)),
    );
    return loft(rings);
  },
  ["airframe"],
  {
    id: "parts.structure.belly-closeout",
    name: "Belly closeout panel",
    color: "#BAC2C5",
    fairing: true,
    ext: true,
    pin: true,
    note: "Bolts secure this closeout below the spar after the wing joins the fuselage. The panel completes the load path along the fuselage belly (AMM 57-10 p. 1, Figs 57-10-1 and 57-10-7). Outline approximate.",
  },
);

[
  { key: "aft", x: 0.75 },
  { key: "forward", x: 2.2 },
].forEach(({ key, x }) =>
  part(() => tubeGeo(fRing(x, 0.93, 30, -0.25, Math.PI + 0.25, false), 0.025), ["airframe"], {
    id: "parts.structure.composite-roll-cage.004",
    instance: key,

    name: "Composite roll cage",
    note: "Built into the fuselage to protect occupants in a rollover.",
    pin: x === 0.75,
  }),
);
for (const side of [1, -1]) {
  part(() => rearWeb(side), ["airframe"], {
    id: "parts.structure.aft-shear-web",
    instance: side,
    name: "Aft shear web",
    color: "#807663",
    pin: side > 0,
    note: "Each rear web carries loads to its own fuselage sidewall fitting. Between the fuel ribs it also closes the back of the wet bay (POH 7-5–6, AMM 28-10 and 57-10 p. 1). Root sweep is approximate.",
  });
  for (const [key, station] of [
    ["gear-inner", 27.25],
    ["gear-outer", 37],
    ["outer", 196],
    ["tip", 213],
  ] as const) {
    part(() => wingRib(side * ws(station), TANK_CHORD[0], rearWebChord(ws(station))), ["airframe"], {
      id: "parts.structure.wing-rib",
      instance: [side, key],
      color: "#B4A88A",
      name: "Wing rib",
      note: `The rib at WS ${station} bonds to the wing structure. Ribs carry load between the skins and webs (AMM 51-10 Fig 51-10-8 and 57-10 p. 1). The rib section is schematic.`,
    });
  }
  for (const [i, z] of TANK_SPAN.entries()) {
    const inboard = i === 0;
    part(() => wingRib(side * z, ...TANK_CHORD, inboard ? "outlet" : "solid"), ["airframe", "fuel"], {
      id: "parts.structure.fuel-end-rib",
      instance: [side, inboard ? "inboard" : "outboard"],
      color: "#A89975",
      name: inboard ? "Inboard fuel rib" : "Outboard fuel rib",
      pin: side < 0,
      pinIn: ["airframe"],
      note: inboard
        ? "This sealed end of the wet bay carries two screened outlets and the inboard fuel quantity sender. Fuel passes through the screens toward the root collector (AMM 28-10 p. 1, 28-40 Fig 28-40-2)."
        : "The outboard rib seals the opposite end of the wet bay and supports its second fuel quantity sender (AMM 28-10 p. 1, 28-40 Fig 28-40-2).",
    });
  }
}
for (const [key, side, aft] of [
  ["front-right", 1, false],
  ["front-left", -1, false],
  ["rear-right", 1, true],
  ["rear-left", -1, true],
] as const) {
  part(
    () =>
      mergeGeos([
        box(0.014, 0.085, 0.072).translate(-0.03, 0, 0),
        box(0.014, 0.085, 0.072).translate(0.03, 0, 0),
        cyl(0.012, 0.098, "x", 12),
        cyl(0.021, 0.012, "x", 6).translate(0.045, 0, 0),
      ]),
    ["airframe"],
    {
      id: "parts.structure.wing-attach-point.005",
      instance: key,
      pos: toVec3(attachPoint(side, aft)),
      color: "#AD7447",
      name: "Wing attach point",
      note: aft
        ? "A bolt joins the rear web fitting to the aft fuselage bracket. One attachment on each side carries load into the structure aft of the rear seats (POH 7-5–6, AMM Fig 57-10-4). Fitting shape is schematic."
        : "The forward attachment joins the continuous main spar to the fuselage beneath the front seat. The assembly includes a bolt, plate, spacer and washers (POH 7-5–6, AMM Fig 57-10-4). Fitting shape is schematic.",
      pin: side > 0,
    },
  );
}
