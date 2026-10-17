/**
 * Avionics data links, display power feeds and IAU cooling for flows.ts.
 * Sources are cited on each flow; registration order is the order of FLOWS in flows.ts.
 */
import type { FlowSpec } from "@/lib/catalogue";
import type { Vec3 } from "@/lib/math";
import { wingP } from "./geometry";
import { DISPLAY_BREAKERS, DISPLAY_FEEDS, DISPLAY_BUS_LABELS, displayFeedPowered } from "./electrical-installation";
import { breakerBus, type Elec, type Sim } from "./model";
import {
  OAT_1,
  OAT_2,
  ADAHRS_1,
  ADAHRS_2,
  GIA_1,
  GIA_2,
  GEA_71,
  GMA_350,
  PFD_CONN,
  MFD_CONN,
  IAU_FAN,
  XPDR,
  WX_500,
  GTS_800,
  KN_63,
  MAG_WIRES,
} from "./parts";
import { CB_PANEL } from "./parts/cabin";
import { flowList, off } from "./flow-builder";

const { F, flow } = flowList();

// avionics data, power and cooling: schematic paths between the LRUs (parts/avionics.ts),
// after POH 13772-007 Fig 7-17 (7-73) and 7-74 – 7-90; AMM 13773-002 Rev 7 31-40 (PDF pp. 1326–1327), Fig 31-60-1
// (PDF p. 1341), 21-20 (PDF p. 454). Routing schematic: no harness drawing gives the runs. Colours: data links are thin blue
// tubes with light-blue particles (DATA); the display power feeds are amber with yellow particles (FEED); the IAU cooling
// duct is grey with pale-blue air particles (COOL). The two GIAs are never joined: they do not talk to each other (AMM
// 31-40 PDF p. 1326).
const DATA = { r: 0.004, color: "#3A6FB8", pcolor: "#8CC8FF", size: 0.04, count: 6 } as const;
const FEED = { r: 0.005, color: "#B8862A", pcolor: "#FFD24A", size: 0.04, count: 6 } as const;
const COOL = { r: 0.014, color: "#8A969E", pcolor: "#CDEBF5", size: 0.05 } as const;
const data = (key: string, pts: FlowSpec["pts"], name: string, cite: string) =>
  flow(key, pts, ["avionics"], { ...DATA, name, note: cite + " Routing schematic." });
// Behind the panel the paths keep clear of the environmental distribution manifold (x 2.48–2.56, y −0.16 … −0.04), pass
// between the rudder pedal pairs (x 2.40–2.44) and cross under the instrument panel slab (y −0.18) from the console.
// Under-floor runs below the main spar carry-through sit at FLOOR_Y.
const FLOOR_Y = -0.655;
// A single physical tube per MAG harness; the matching particle path uses the same spline (tension 0.15).
for (const n of [1, 2] as const)
  flow(n === 1 ? "magData" : "magData2", MAG_WIRES[n], ["avionics"], {
    ...DATA,
    tube: false,
    tension: 0.15,
    name: `MAG ${n} → ADAHRS ${n}`,
    note: "Magnetometer interface (SR22T POH 13772-007 Fig 7-17, 7-73; 7-75; AMM 13773-002 Rev 7 34-20, PDF p. 1675). Routing schematic.",
  });
// Each OAT probe connects directly to its ADC (POH 7-75); both probes on the RH wing per operator observation. Both
// routes (oatData1, oatData2) are drawn with the avionics data paths and audited strictly.
const oatData = (n: 1 | 2) => ({
  r: 0.004,
  name: `OAT ${n} to ADAHRS ${n}`,
  note: `Direct OAT ${n} probe connection to ADAHRS ${n}'s ADC (POH 7-75). Selected-side ADC OAT is used for Baro-VNAV (POH 7-80/7-81). Routing approximate; both probes on the RH wing per operator observation of the modelled airplane, plus AMM Fig 34-10-6.`,
});
// OAT 1: direct ADC link (POH 7-75); RH probe location (AMM Fig 34-10-6 PDF 1666), audited like OAT 2.
// Lower RH wing lane aft of the fuel tank (chord 0.62) and of OAT 2's lane, rising over the aileron hinge fairing (span 3.94)
// and dropping under the wing sector crank arm and cable fairlead (span 3.6–3.7). In the cabin it runs under the front
// passenger seat, forward through the footwell outboard of the cabin-air ducts, up behind the rudder pedals and across
// aft of the elevator torque tube, then rises aft of the IAU cooling ducts into ADAHRS 1 from below.
// Waypoints and 5 mm surface margin are illustrative clearance choices, not installation dimensions.
const oatLane = (z: number, xc: number, f: number) => wingP(z, xc, 0).lerp(wingP(z, xc, -1), f);
flow(
  "oatData1",
  [
    OAT_1,
    oatLane(4.53, 0.45, 0.55),
    oatLane(4.53, 0.62, 0.6),
    oatLane(4.0, 0.63, 0.3),
    oatLane(3.88, 0.63, 0.3),
    ...[3.6, 3.3, 2.88, 2.2, 1.6, 1.0].map((z) => oatLane(z, 0.62, 0.7)),
    [0.95, -0.56, 0.7],
    [1.05, -0.55, 0.5],
    [1.19, -0.55, 0.5],
    // outboard of the A/C evaporator under the front passenger seat; approximate
    [1.21, -0.48, 0.46],
    [2.1, -0.47, 0.45],
    [2.34, -0.42, 0.27],
    [2.38, -0.27, 0.27],
    [2.39, -0.27, -0.26],
    [2.46, -0.27, -0.26],
    [2.46, 0.03, -0.26],
    ADAHRS_1,
  ],
  ["pitot", "avionics"],
  {
    ...oatData(1),
    tension: 0,
    note:
      oatData(1).note +
      " Lower RH wing lane aft of the fuel tank, under the front passenger seat and behind the rudder pedals into ADAHRS 1 from below. Waypoints and 5 mm clearance are illustrative (POH 7-75; AMM Fig 34-10-6 PDF p. 1666); no installation drawing dimensions this route.",
  },
);
// OAT 2: direct ADC link (POH 7-75); RH probe location (AMM Fig 34-10-6 PDF 1666).
// Upper RH wing lane enters the cabin ahead of the control pulleys and passes beside the console.
// The two pre-ADC bends sit below the full-open door/seal sweep (AMM Fig 52-10-1 PDF 2011).
// Waypoints and 5 mm surface margin are illustrative clearance choices, not installation dimensions.
flow(
  "oatData2",
  [
    OAT_2,
    [1.275, -0.18, 4.635],
    [1.11, -0.18, 4.5],
    [1.035, -0.285, 2.88],
    [0.93, -0.45, 0.945],
    [1.035, -0.465, 0.675],
    [1.155, -0.45, 0.585],
    // under the front passenger seat pan, outboard of OAT 1, then up forward of the cushion; approximate
    [1.23, -0.42, 0.56],
    [1.3, -0.43, 0.53],
    [1.9, -0.445, 0.52],
    [2.0, -0.33, 0.42],
    [2.31, -0.25, 0.09],
    [2.355, -0.25, 0.075],
    [2.37, -0.03, 0.06],
    [2.37, -0.015, 0.045],
    [2.415, 0.06, -0.0],
    [2.43, 0.09, -0.015],
    [2.43, 0.105, -0.03],
    ADAHRS_2,
  ],
  ["pitot", "avionics"],
  {
    ...oatData(2),
    tension: 0,
    note:
      oatData(2).note +
      " Upper RH wing lane enters ahead of the control pulleys and passes beside the console. Pre-ADC bends clear the full-open door/seal sweep (AMM Fig 52-10-1 PDF p. 2011). Waypoints and 5 mm clearance are illustrative (POH 7-75; AMM Fig 34-10-6 PDF p. 1666); no installation drawing dimensions this route.",
  },
);
data(
  "adahrsPfd",
  [ADAHRS_1, [2.36, 0.15, -0.25], PFD_CONN],
  "ADAHRS 1 → PFD",
  "The AHRS provides attitude and heading to the PFD; the ADC communicates with the PFD (POH 7-75).",
);
data(
  "adahrsGia1",
  [ADAHRS_1, [2.43, 0.18, -0.2], [2.45, 0.18, -0.13], GIA_1],
  "ADAHRS 1 → GIA 1",
  "The AHRS interfaces with both Integrated Avionics Units for GPS information (POH 7-75; AMM 34-10 PDF p. 1630).",
);
data(
  "adahrsGia2",
  [GIA_2, [2.42, 0.19, 0.03], [2.4, 0.19, -0.2], ADAHRS_1],
  "GIA 2 → ADAHRS 1",
  "SR22T POH 13772-007 Fig 7-17 (7-73): IAU 2 → ADAHRS 1; AMM 13773-002 Rev 7 34-10 §E, PDF p. 1630: ADAHRS obtains GPS information from the GIAs.",
);
// Dual ADAHRS installation per operator. POH 13772-007 Fig 7-17 (7-73) connects ADAHRS 2 to MFD, both IAUs and MAG 2.
// These coordinates and the DATA radius/rate are schematic illustration choices, not sourced installation dimensions.
data(
  "adahrs2Mfd",
  [ADAHRS_2, [2.31, 0.1, -0.024], [2.31, 0.1, 0.054], MFD_CONN],
  "ADAHRS 2 → MFD",
  "SR22T POH 13772-007 Fig 7-17 (7-73): dual ADAHRS display interface.",
);
data(
  "adahrs2Gia1",
  [GIA_1, [2.38, 0.18, -0.1], [2.46, 0.25, -0.13], [2.46, 0.24, -0.055], ADAHRS_2],
  "GIA 1 → ADAHRS 2",
  "SR22T POH 13772-007 Fig 7-17 (7-73): IAU 1 → ADAHRS 2; AMM 13773-002 Rev 7 34-10 §E, PDF p. 1630: ADAHRS obtains GPS information from the GIAs.",
);
data(
  "adahrs2Gia2",
  [ADAHRS_2, [2.4, 0.2, 0.005], [2.36, 0.21, 0.11], GIA_2],
  "ADAHRS 2 → GIA 2",
  "SR22T POH 13772-007 Fig 7-17 (7-73), 7-75; AMM 13773-002 Rev 7 34-10, PDF p. 1630: AHRS interfaces with both IAUs for GPS information.",
);
// GIA ↔ display Ethernet links and the PFD ↔ MFD bus, just behind the bezels (bezel plane x 2.285, GIAs from x 2.325); the
// PFD ↔ MFD bus leaves through the display cut-outs and crosses between them aft of the panel slab (x 2.28–2.32, cabin.ts)
data(
  "gia1Pfd",
  [GIA_1, [2.32, 0.07, -0.16], PFD_CONN],
  "GIA 1 → PFD",
  "Ethernet interconnect from GIA 1 to the PFD (AMM 31-40 PDF p. 1327); high-speed data bus (POH 7-74).",
);
data(
  "gia2Mfd",
  [GIA_2, [2.315, 0.07, 0.05], MFD_CONN],
  "GIA 2 → MFD",
  "Ethernet interconnect from GIA 2 to the MFD (AMM 31-40 PDF p. 1327); high-speed data bus (POH 7-74).",
);
data(
  "pfdMfd",
  [PFD_CONN, [2.3, 0.03, -0.16], [2.335, 0.025, -0.1], [2.335, 0.025, -0.075], [2.3, 0.03, -0.02], MFD_CONN],
  "PFD ↔ MFD",
  "The PFD accepts data from the MFD through a high-speed data bus connection (POH 7-74).",
);
// GEA 71: POH Fig 7-17 (7-73) links the Engine Airframe Unit to both Integrated Avionics Units
data(
  "geaData",
  [GEA_71, [2.4, -0.02, 0.2], [2.4, -0.02, -0.115], GIA_1],
  "GEA 71 → GIA 1",
  "The Engine Airframe Unit transmits its sensor data to the Integrated Avionics Unit (POH 7-78); the schematic links it to both Integrated Avionics Units (POH 13772-007 Fig 7-17, 7-73).",
);
data(
  "geaData2",
  [GEA_71, [2.41, -0.01, 0.18], [2.41, -0.01, 0.05], GIA_2],
  "GEA 71 → GIA 2",
  "The Engine Airframe Unit transmits its sensor data to the Integrated Avionics Unit (POH 7-78); the schematic links it to both Integrated Avionics Units (POH 13772-007 Fig 7-17, 7-73).",
);
// over the A/C condenser, the convenience system controller, the rudder/elevator pulley bracket and the flap torque
// tube, then under the floor inboard of the A/C evaporator (z 0.23 … 0.43 at x 1.15 … 1.35) and of the RH brake line
// (z 0.095, parts/gear.ts), stepping over that line ahead of the spar
data(
  "xpdrData",
  [
    XPDR,
    [-0.45, -0.45, 0.2],
    [-0.1, -0.45, 0.18],
    [0.55, -0.49, 0.2],
    [0.9, -0.49, 0.15],
    [1.06, -0.54, 0.085],
    [1.05, FLOOR_Y, 0.07],
    [1.45, FLOOR_Y, 0.07],
    [1.7, FLOOR_Y, 0.07],
    [1.82, -0.632, 0.095],
    [1.95, FLOOR_Y, 0.13],
    [2.25, FLOOR_Y, 0.225],
    [2.42, -0.5, 0.225],
    [2.465, -0.44, 0.225],
    [2.45, -0.25, 0.02],
    [2.34, -0.04, -0.115],
    GIA_1,
  ],
  "Transponder ↔ GIA 1",
  "The transponder communicates with the primary Integrated Avionics Unit (POH 7-78, 7-83).",
);
// the GIA 1 audio link passes under the panel slab inboard of the MAG 1 wiring (parts/avionics.ts MAG_WIRES)
data(
  "audioGia1",
  [GMA_350, [2.2, -0.215, -0.03], [2.3, -0.2, -0.035], [2.37, -0.19, -0.09], [2.38, -0.04, -0.115], GIA_1],
  "Audio panel ↔ GIA 1",
  "The GMA 350 interfaces with both Integrated Avionics Units (POH 7-78).",
);
data(
  "audioGia2",
  [GMA_350, [2.2, -0.25, 0.05], [2.36, -0.22, 0.05], [2.38, -0.04, 0.05], GIA_2],
  "Audio panel ↔ GIA 2",
  "The GMA 350 interfaces with both Integrated Avionics Units (POH 7-78).",
);
// optional sensors reach the panel through GIA 2 (POH 7-84 – 7-85); the WX-500 and DME links rise just aft of the
// firewall (x 2.59) and enter GIA 2 from its forward end; the DME link runs aft of the parking brake control cable (x ≤ 2.545,
// parts/gear.ts) low down, then rises outboard of the throttle cable (z −0.12 at the firewall, parts/engine-air.ts) before
// crossing to GIA 2
data(
  "trafficData",
  [
    GTS_800,
    [1.9, -0.5, -0.27],
    [2.47, -0.55, -0.25],
    [2.5, -0.05, -0.3],
    [2.52, 0.1, -0.26],
    ADAHRS_1,
    [2.5, 0.2, -0.2],
    [2.5, 0.2, 0.05],
    GIA_2,
  ],
  "GTS 800 ↔ ADAHRS 1 ↔ GIA 2 (optional)",
  "The GTS 800 uses inputs from the secondary Integrated Avionics Unit via the primary Air Data Computer (POH 7-84).",
);
data(
  "wxData",
  [
    WX_500,
    [0.6, -0.6, -0.22],
    [1.2, FLOOR_Y, -0.1],
    [1.6, FLOOR_Y, -0.07],
    [1.9, -0.62, -0.05],
    [2.47, -0.55, 0.0],
    [2.59, -0.3, 0.04],
    [2.59, 0.1, 0.04],
    GIA_2,
  ],
  "WX-500 → GIA 2 (optional)",
  "The WX-500 processor sends its data to the MFD via the secondary Integrated Avionics Unit (POH 7-84).",
);
data(
  "dmeData",
  [KN_63, [2.3, -0.47, -0.3], [2.58, -0.47, -0.3], [2.585, -0.3, -0.22], [2.59, -0.1, -0.08], [2.59, 0.1, 0.06], GIA_2],
  "KN 63 → GIA 2 (optional)",
  "The KN 63 communicates with the Integrated Avionics System via the secondary Integrated Avionics Unit (POH 7-84 – 7-85).",
);
// display power feeds from the circuit breaker panel (parts/cabin.ts, left side of the console) up inside the console,
// under the bolster and round the panel slab's lower aft edge (either side of the rear floor duct), then up below the GIAs (y < 0.045) and aft
// into the display cut-out behind the bezel (x < GIA front 2.325) to the connectors
const CB_BACK = off(CB_PANEL, [0.08, 0.02, 0.02]);
const FEED_ROUTES = {
  pfdFeedA: { to: PFD_CONN, z: -0.075 },
  pfdFeedB: { to: PFD_CONN, z: -0.086 },
  mfdFeedA: { to: MFD_CONN, z: 0.03 },
  mfdFeedB: { to: MFD_CONN, z: 0.041 },
} as const;
const FEEDS = Object.entries(FEED_ROUTES).map(([key, route]) => {
  const feed = DISPLAY_FEEDS[key as keyof typeof FEED_ROUTES];
  const breaker = DISPLAY_BREAKERS[feed.breaker];
  return {
    key,
    breaker: breaker.label,
    bus: DISPLAY_BUS_LABELS[breaker.bus],
    rating: breaker.rating.value,
    protection: feed.breaker,
    ...route,
  };
});
FEEDS.forEach(({ key, breaker, bus, to, z, rating }) =>
  flow(
    key,
    [
      CB_BACK,
      [1.98, -0.35, z],
      [2.15, -0.22, z],
      [2.3, -0.195, z],
      [2.335, -0.19, z],
      [2.35, -0.16, z],
      [2.345, 0, to[2] + (z - to[2]) / 4],
      [2.31, 0.03, to[2] + (z - to[2]) / 8],
      to,
    ],
    ["avionics", "electrical"],
    {
      ...FEED,
      connection: key,
      name: breaker + " feed",
      note:
        rating +
        " A " +
        breaker +
        " circuit breaker on " +
        bus +
        " → " +
        (to === PFD_CONN ? "PFD" : "MFD") +
        "; either feed powers the display (POH 7-74; Fig 7-11, 7-52). Routing schematic.",
    },
  ),
);
// IAU cooling: the fan under the LH console blows through a series of ducts to the IAUs (POH 7-90; AMM 21-20 PDF p. 454);
// the duct runs low under the LH panel vent duct and below the MAG 1 wiring's turn up to ADAHRS 1 (parts/avionics.ts
// MAG_WIRES), then tees below the GIAs, aft of the windshield diffuser riser
const COOL_TEE: Vec3 = [2.455, 0, -0.12];
flow("iauCool", [IAU_FAN, [2.41, -0.2, -0.18], COOL_TEE, GIA_1], ["avionics"], {
  ...COOL,
  name: "IAU cooling duct (GIA 1)",
  note: "Avionics fan → GIA 1: forced ambient-air cooling directly to the Integrated Avionics Units (POH 7-90; AMM 21-20 PDF p. 454). Routing schematic.",
});
flow("iauCool2", [COOL_TEE, [2.46, 0, 0.05], GIA_2], ["avionics"], {
  ...COOL,
  name: "IAU cooling duct (GIA 2)",
  note: "Branch of the avionics fan duct to GIA 2 (POH 7-90; AMM 21-20 PDF p. 454). Routing schematic.",
});

export const AVIONICS_DEPTH_FLOWS = F;

/** Particle speed multiplier per avionics data, display feed and cooling flow (0 = stopped). */
export function avionicsDepthRates(s: Sim, E: Elec): Record<string, number> {
  const R: Record<string, number> = {};
  R.oatData1 = E.adahrs1 ? 0.4 : 0;
  R.oatData2 = E.adahrs2 ? 0.4 : 0;
  // avionics: a data link runs while both end units are up (POH 7-74 – 7-85); a breaker feeds its unit
  // while its bus is up and it is in (bus from the breaker table). ADAHRS 1 and MAG 1 come from the solver, so their
  // simulated failures stop their links. Each GIA's data side takes its GPS NAV GIA breaker alone; COM n powers only
  // the COM radio, as on the displays (POH 7-78 silent; modelling choice, open question). Rates are illustrative.
  const fed = (breaker: string) => {
    const bus = breakerBus(s.equip, breaker);
    return !!bus && E[bus] > 0 && !s.cb[breaker];
  };
  const adahrs = E.adahrs1,
    gia1 = fed("GPS NAV GIA 1"),
    gia2 = fed("GPS NAV GIA 2"),
    link = (a: boolean, b: boolean) => (a && b ? 0.5 : 0);
  R.magData = link(E.mag1, adahrs); // MAG 1 supply: PFD A (AMM 34-20 PDF p. 1675), via the solver
  R.magData2 = link(E.mag2, E.adahrs2);
  R.adahrs2Mfd = link(E.adahrs2, E.mfd);
  R.adahrs2Gia1 = link(E.adahrs2, gia1);
  R.adahrs2Gia2 = link(E.adahrs2, gia2);
  R.adahrsPfd = link(adahrs, E.pfd);
  R.adahrsGia1 = link(adahrs, gia1);
  R.adahrsGia2 = link(adahrs, gia2);
  R.gia1Pfd = link(gia1, E.pfd);
  R.gia2Mfd = link(gia2, E.mfd);
  R.pfdMfd = link(E.pfd, E.mfd);
  R.geaData = link(E.eisPwr, gia1);
  R.geaData2 = link(E.eisPwr, gia2);
  R.xpdrData = link(fed("XPONDER"), gia1);
  R.audioGia1 = link(fed("AUDIO PANEL"), gia1);
  R.audioGia2 = link(fed("AUDIO PANEL"), gia2);
  R.trafficData = link(fed("TRAFFIC") && adahrs, gia2);
  R.wxData = link(fed("DATA LINK/WX"), gia2);
  R.dmeData = link(fed("DME/ADF"), gia2);
  for (const { key, protection } of FEEDS) R[key] = displayFeedPowered(protection, E, s.cb) ? 1 : 0;
  R.iauCool = R.iauCool2 = E.fan2 ? 0.8 : 0;
  return R;
}
