/**
 * Where the TSIO-550-K's parts sit in the engine page's 3D scene (`components/engine/scene/layout.ts` explains each
 * field; the fields left out keep the IO-390 drawing's values). Scene data only: the model reads `spec.ts`, never this
 * file. Stations are inches along the crankshaft from the middle of the 32.50 in between the accessory mounting face
 * and the propeller-flange face (M-18 Figure 5-33 p. 5-53), the origin `spec.ts` puts the cylinders on.
 *
 * M-18 = Continental TSIO-550 Permold Series Engine Maintenance and Overhaul Manual, 21 Sep 2017. Values marked
 * "scaled" were measured off an installation drawing against a dimension printed on the same view; values marked FIT
 * are drawing choices no document gives. Shapes are schematic.
 */
import type { EngineLayout, V3 } from "@/components/engine/scene/layout";
import { ACCESSORY_FACE_IN, TSIO550K_TURBO } from "./layout-turbo";

const IN = 0.0254;
/** Inches (s forward of the accessory face, y up, z right) to scene metres, as layout-turbo.ts gives its stations. */
const at = (s: number, y: number, z: number): V3 => [(ACCESSORY_FACE_IN + s) * IN, y * IN, z * IN];
const sx = (s: number) => (ACCESSORY_FACE_IN + s) * IN;
const [TL, TR] = TSIO550K_TURBO.sides;
const WG = TSIO550K_TURBO.wastegate;
const [ICL, ICR] = TSIO550K_TURBO.intercoolers;
const CTRL = TSIO550K_TURBO.controller;
/** An intercooler's charge-air inlet stub, at its lower end (the compressor duct comes up into it). */
const icInlet = (ic: typeof ICL): V3 => [ic.inlet[0], ic.inlet[1] - 0.015, ic.inlet[2]];

/**
 * The downdraft induction (POH 7-37 [261]; AMM 71-60 PDF 2542): air boxes with filters on the compressor inlets, the
 * alternate air assembly at the lower front with a tube to each air box, the compressor discharge ducts up to the
 * intercoolers, the outlet ducts forward to the Y junction, the engine-mounted throttle body (M-18 2-1), the intake
 * manifold along the top and an intake pipe down to each head. The runs start and end on the turbo layout's anchors;
 * no figure dimensions them, so every route and size here is approximate, drawn to clear the parts around them.
 */
const INDUCTION = {
  airBox: { len: 4.5 * IN, halfY: 2.2 * IN, halfZ: 2.3 * IN },
  altAir: { at: at(20.8, -14.6, 0), len: 2.5 * IN, r: 1.2 * IN },
  altTubes: [
    [at(19.6, -14.6, -1.0), at(17.6, -14.7, -6.0), at(15.0, -14.8, -10.7)],
    [at(19.6, -14.6, 1.0), at(17.6, -14.7, 6.0), at(15.0, -14.8, 11.2)],
  ],
  // up outboard of the rocker covers into each intercooler's inlet from below (AMM Figure 71-60-2, via the turbo
  // layout's inlet anchor)
  compressorDucts: [
    [
      TL.compressorOutlet,
      at(9.6, -11.0, -15.6),
      at(9.0, -8.5, -18.8),
      at(6.0, -2.0, -18.9),
      at(2.6, 2.4, -18.7),
      icInlet(ICL),
    ],
    [
      TR.compressorOutlet,
      at(9.6, -11.0, 16.0),
      at(9.0, -8.5, 18.8),
      at(6.0, -2.0, 18.9),
      at(2.6, 2.4, 18.6),
      icInlet(ICR),
    ],
  ],
  // forward outboard of the front cylinders' intake pipes and the No. 6 top plug's lead, then in over the crankcase nose
  // to the Y
  outletDucts: [
    [
      ICL.outlet,
      at(20.5, 5.6, -16.1),
      at(25.6, 5.9, -16.0),
      at(28.4, 6.4, -13.0),
      at(28.9, 7.2, -5.0),
      at(28.9, 7.45, -1.3),
    ],
    [
      ICR.outlet,
      at(20.5, 5.6, 16.1),
      at(25.6, 5.9, 16.0),
      at(28.4, 6.4, 13.0),
      at(28.9, 7.2, 5.0),
      at(28.9, 7.45, 1.3),
    ],
  ],
  r: { duct: 1.0 * IN, altTube: 0.75 * IN, runner: 0.6 * IN },
  y: { at: at(28.9, 7.45, 0), halfZ: 1.4 * IN, r: 1.0 * IN },
  throttle: { x0: sx(26.5), x1: sx(27.9), r: 1.0 * IN, plateX: sx(27.2) },
  // over the fuel manifold valve (its top 6.30 in above the crankshaft centreline) and forward of the magnetos' caps
  plenum: { x0: sx(6.0), y: 7.45 * IN, r: 0.85 * IN },
  runnerVia: [
    { y: 7.45 * IN, z: 0.6 * IN },
    { y: 7.2 * IN, z: 5.0 * IN },
    { y: 6.3 * IN, z: 11.0 * IN },
    { y: 5.6 * IN, z: 13.4 * IN },
  ],
  deck: at(27.6, 8.6, 0),
  map: at(25.7, 8.4, 0),
  // aft along the top centre, between the magnetos' top leads, then over the LH magneto to the controller's bulkhead
  // fittings
  deckLine: [
    at(27.6, 8.75, 0),
    at(26.6, 9.9, -0.9),
    at(6.0, 9.9, -0.9),
    at(2.0, 9.8, -4.0),
    at(-1.0, 9.0, -11.0),
    at(-3.2, 7.4, -13.0),
    CTRL.deckPort,
  ],
  mapLine: [
    at(25.7, 8.55, 0),
    at(25.0, 10.5, -0.3),
    at(6.5, 10.5, -0.3),
    at(2.5, 10.3, -5.0),
    at(-1.0, 9.4, -12.6),
    at(-3.2, 7.4, -15.0),
    CTRL.mapPort,
  ],
  notes: {
    airBox:
      "Air box on the compressor inlet: air from the NACA duct in the lower cowl passes its filter on the way to the turbocharger (POH 7-37). The duct is part of the cowl and not drawn; the box's size is drawn.",
    filter:
      "Induction air filter in the air box (POH 7-37). If it blocks, the engine's suction opens the alternate air door.",
    altAir: "Alternate air assembly at the lower front of the engine, connected to the LH and RH air boxes (POH 7-37).",
    altDoor:
      "Alternate air door: magnetic force holds it closed; if the induction is blocked, the engine's suction opens it and unfiltered air from inside the cowl comes in (POH 7-37). It opens with the model's door.",
    altTube: "Tube from the alternate air assembly to an air box (POH 7-37).",
    compressorDuct:
      "Compressor discharge duct: the compressed, heated air goes to this side's intercooler (POH 7-37). Route drawn.",
    outletDuct:
      "Intercooler outlet duct: the cooled air joins the other side's at the Y junction (POH 7-37). The overboost valve is on the LH one (AMM 71-60). Route drawn.",
    y: "Y junction of the intake tubes: the air from both intercoolers joins here and goes on through the throttle body (POH 7-37).",
    throttleBody:
      "Engine-mounted throttle body (M-18 2-1); the fuel metering valve is on it (POH 7-38). Manifold pressure is set by its throttle plate (M-18 2-1).",
    throttlePlate:
      "Throttle plate: the power lever's cable opens this butterfly towards MAX (POH 7-32). Its angle follows the power lever.",
    deck: "Upper-deck pressure fitting, ahead of the throttle plate: its line goes to the wastegate controller (POH 7-39; M-18 Figure 12-7).",
    map: "Manifold pressure port, 0.125-27 NPTF, on the induction manifold near the throttle (M-18 2-1, Figure 5-34).",
    deckLine: "Upper-deck pressure line to the wastegate controller's bulkhead fitting (M-18 Figure 12-7).",
    mapLine: "Manifold pressure line to the wastegate controller's bulkhead fitting (M-18 Figure 12-7).",
    plenum:
      "Intake manifold: divides the air from the throttle body among the intake pipes (POH 7-37); downdraft balanced-port induction (M-18 2-1).",
    runner: "Intake pipes down to the intake inlets cast in the top of each cylinder head (POH 7-37; M-18 2-1).",
  },
} satisfies EngineLayout["induction"];

/**
 * Continental continuous-flow injection (POH 7-38 [262]; M-18 2-1, 2-2.2, Figure 12-14 p. 12-23 [320], Figure 5-35
 * p. 5-55 [150]): the engine-driven pump with its mixture valve, the throttle and metering assembly, the manifold valve
 * (drawn by the shared scene) and the six air-bled nozzles. Sizes and routes are approximate.
 */
const FUEL = {
  // M-18 2-2.2: "The fuel pump coupling connects directly to the crankshaft gear": on the crankshaft's axis, aft of the
  // accessory case (the magneto drive housing's aft face, 0.945 in aft of the accessory face, as the scene draws it); its
  // radius is drawn small enough to clear the starter adapter beside it
  pump: { x0: sx(-0.945), x1: sx(-3.6), r: 0.85 * IN },
  armLen: 1.4 * IN,
  // on the right side of the throttle body
  metering: { at: at(27.2, 7.45, 1.45), half: [0.6 * IN, 0.7 * IN, 0.45 * IN] as V3 },
  // up behind the magneto drive housing, forward outboard of it and the right magneto, along the top of the right
  // crankcase half under the intake pipes
  pumpLine: [
    at(-2.0, 0.7, 0.45),
    at(-1.9, 2.6, 3.4),
    at(-1.4, 4.9, 5.8),
    at(-0.4, 4.9, 5.8),
    at(1.5, 4.9, 5.8),
    at(24.0, 4.9, 5.8),
    at(26.1, 6.4, 3.0),
    at(26.9, 7.0, 1.9),
  ],
  meteringLine: [at(27.1, 6.85, 1.45), at(24.5, 6.3, 1.8), at(15.2, 6.2, 1.5), at(14.1, 6.3, 0.5), at(13.97, 6.28, 0)],
  vaporReturn: [at(-2.6, 0.75, 0), at(-2.6, 1.5, 0), at(-4.0, 1.8, 0)],
  notes: {
    pump: "Engine-driven fuel pump at the rear, its coupling connected directly to the crankshaft gear (M-18 2-2.2; Figure 12-14 items 2, 3). The mixture control valve is integral to it (POH 7-38). Size drawn.",
    mixtureArm:
      "Mixture control lever on the pump: idle cut-off to full rich over 90° (M-18 Figure 5-35 detail A). It follows the mixture control.",
    metering:
      "Throttle and metering assembly: the fuel metering valve on the throttle body meters fuel with the throttle angle (POH 7-38; M-18 Figure 12-14 item 8).",
    pumpLine: "From the pump's mixture valve to the fuel metering valve (POH 7-38).",
    meteringLine: "From the metering valve to the fuel manifold valve (POH 7-38). The lines glow with fuel flow.",
    vaporReturn: "Fuel vapor return to the tank, from the pump (M-18 Figure 5-35 detail A).",
    sleeve: "Air reference sleeve on each air-bled injector nozzle (M-18 2-1, 12-5.3).",
  },
} satisfies EngineLayout["fuel"];

/**
 * The exhaust (M-18 Figure 12-22 p. 12-35 [332], legend): elbow risers, tee assemblies and risers from the cylinders to
 * each bank's turbo transition and its turbine inlet; the crossover assembly from the right bank to the transition
 * that feeds the wastegate; the wastegate on the left tailpipe; V-band clamps at the turbine outlets. The runs end on
 * the turbo layout's flanges (layout-turbo.ts, the contract); their routes are approximate (no figure dimensions them).
 */
const EXHAUST = {
  // Drawn sizes (no figure gives them): risers Ø1.3 in, the largest that leaves the port flange and passes the exhaust
  // pushrod beside it with 0.25 in to spare; collectors and transitions Ø2.0 in, larger than the risers they gather;
  // tailpipes Ø3.0 in, inside the turbines' Ø3.3 in discharge collars (layout-turbo.ts, scaled from Figure 5-33)
  r: { riser: 0.65 * IN, pipe: 1.0 * IN, tail: 1.5 * IN },
  // each riser's foot set 0.43 in along its port flange, away from the exhaust pushrod, and 0.79 in away by the time it
  // passes the pushrod's height (Cylinders.tsx draws the port 0.51 in from the pushrod; approximate)
  riser: { foot: -0.011, clear: -0.02 },
  banks: [
    {
      // the collectors run 7.6 in below the crankshaft centreline, under the rocker boxes (approximate)
      side: "L",
      y: -7.6 * IN,
      z: -13.6 * IN,
      toTurbine: [at(6.4, -8.2, -13.2), at(5.0, -9.2, -12.94), TL.turbineInlet],
    },
    { side: "R", y: -7.6 * IN, z: 13.6 * IN, toTurbine: [at(4.6, -9.0, 13.45), TR.turbineInlet] },
  ],
  // from the LH collector aft to the wastegate's top flange, over the LH turbine's TIT probe (approximate)
  toWastegate: [
    at(6.8, -8.1, -13.25),
    at(5.3, -7.5, -13.0),
    at(2.5, -8.0, -12.94),
    at(-1.6, -8.4, -12.94),
    at(-2.6, -8.9, -12.94),
    WG.flanges.top,
  ],
  // aft of the crankcase from the RH collector across to the wastegate transition (approximate): under the sump it
  // would meet the sump and the RH turbocharger's oil supply hose
  crossover: [
    at(4.3, -8.4, 13.5),
    at(1.0, -9.6, 10.5),
    at(-1.4, -9.8, 5.0),
    at(-1.6, -9.8, -5.0),
    at(-1.6, -9.0, -10.5),
    at(-1.6, -8.5, -12.6),
  ],
  // from the wastegate's bottom flange into the LH tailpipe (POH 7-38; AMM 81-20: connected to the LH tailpipe)
  wastegateDrop: [WG.flanges.bottom, at(-2.6, -15.2, -12.94), at(-2.6, -17.3, -12.94)],
  // From each turbine's discharge collar aft and down to the end M-18 Figures 5-33 and 5-35 draw: 17.42 in (5-33) and
  // 17.35 in (5-35) aft of the accessory face, 11.89 in (LH) and 11.95 in (RH) below the turbine shafts (rear view),
  // in the turbines' vertical planes. The 45° and 37° 54′ marks printed by the tailpipes there don't match a straight
  // pipe to that end (≈ 28° below the horizontal); the dimensioned end governs, and the drawn bend is approximate.
  tailpipes: [
    [[TL.outlet.x, TL.y, TL.z], at(1.2, -15.7, -12.94), at(-16.7, -25.2, -12.94)],
    [[TR.outlet.x, TR.y, TR.z], at(1.2, -15.7, 13.45), at(-16.7, -25.25, 13.45)],
  ],
  notes: {
    riser:
      "Exhaust riser from the cylinder's downdraft exhaust outlet at the bottom of the head (M-18 2-1) to its bank's collector (M-18 Figure 12-22: elbow risers, tee assemblies, risers). A sensor in it measures the cylinder's exhaust gas temperature (POH 7-35; M-18 Figure 5-33, EGT holes); it glows with that temperature.",
    collector:
      "This bank's tee assemblies and turbo transition: the exhaust from its three cylinders goes to this side's turbine inlet (POH 7-38; M-18 Figure 12-22). Tinted with the bank's mean exhaust gas temperature.",
    crossover:
      "Crossover assembly from the right bank's transition to the transition feeding the wastegate (M-18 Figure 12-22). In the airplane a heat exchanger surrounds the crossover tube to heat cabin air (POH 7-64); it is not drawn.",
    toWastegate:
      "Transition from the left bank to the wastegate (M-18 Figure 12-22). Exhaust the wastegate lets past bypasses the turbines (POH 7-38).",
    wastegateDrop: "The wastegate's outlet into the left tailpipe (POH 7-38; AMM 81-20).",
    tailpipe:
      "Tailpipe: the exhaust leaves the turbine's discharge port overboard through the lower cowling (POH 7-38). Ends where M-18 Figures 5-33 and 5-35 draw it; tinted with this side's turbine inlet temperature.",
    clamp: "V-band clamp joining the tailpipe to the turbine's discharge (M-18 Figure 12-22).",
  },
  labels: [
    ["LH tailpipe", at(-14.0, -25.0, -15.5)],
    ["RH tailpipe", at(-14.0, -25.0, 16.0)],
    ["Exhaust crossover", at(-1.6, -12.0, 0)],
  ],
} satisfies EngineLayout["exhaust"];

export const TSIO550K_LAYOUT: Partial<EngineLayout> = {
  stationsIn: {
    // M-18 Figure 5-33: 32.50 in from the accessory mounting face to the propeller-flange face (the pilot stands a
    // further 0.50 in forward); the scene's origin is midway.
    accessoryFace: -16.25,
    propFlange: 16.25,
    // FIT: the accessory housing drawn 1.6 in deep, so cylinder 1's base flange (5.42 in forward of the accessory face,
    // Figure 5-34) still sits on the crankcase.
    caseRear: -16.25 + 1.6,
    // Scaled from Figure 5-33 (side view): the crankcase nose behind the belt alternator, ≈ 29 in from the accessory
    // face (± 0.5 in).
    front: 29 - 16.25,
  },
  // Scaled from M-18 Figure 5-34 view D-D (p. 5-54), against its printed 15.24 in between the front mounts: the rocker
  // covers' outer faces stand ≈ 16.8 in left and 17.0 in right of the crankshaft centreline (± 0.4 in). Not the 42.4 in
  // overall width of Table 2-8, which is across the intercoolers.
  coverWidthIn: 33.8,
  // M-18 Figure 2-5 p. 2-5: the camshaft runs under the crankshaft.
  camBelow: true,
  // M-18 2-1 p. 2-1: "cross-flow cylinder design with overhead inclined valves. Downdraft cylinder head intake inlets are
  // cast in the top of the cylinder head; downdraft exhaust outlets exit the bottom of the cylinder."
  valvePlane: "vertical",
  ports: { intake: "top" },
  // M-18 Figure 5-33 (LH side view): two rocker covers on each head, fore and aft.
  coversPerCylinder: 2,
  rockerBoxY: [-0.15, 0.06],
  // M-18 2-2.1 p. 2-4: "seven studs and two through-bolts for attaching cylinder base flanges".
  baseFasteners: 9,
  // Half the 2.47 in between cylinders 1 and 2 (7.89 − 5.42, M-18 Figure 5-34), so neighbouring throws don't overlap.
  throwHalf: 1.23 * IN,
  // M-18 2-2.2.1 p. 2-6 and Figure 2-6: counterweights on the No. 2 crankshaft cheek (between rod journals 1 and 2) and
  // the No. 5 cheek (between rod journals 3 and 4), two on each.
  counterweights: [
    { cyl: 1, cheek: 1 },
    { cyl: 2, cheek: -1 },
    { cyl: 3, cheek: 1 },
    { cyl: 4, cheek: -1 },
  ],
  // M-18 2-2.2.1: five main journals; the fifth is at the front, behind the alternator drive gear (Figure 2-6).
  noseMainBearing: true,
  // FIT, schematic: the case is deeper below the crankshaft than above it, to hold the camshaft. Sump bottom scaled from
  // Figure 5-34 view D-D: ≈ 12.1 in below the crankshaft centreline (± 0.5 in). The accessory housing stops at the
  // crankcase top, under the magnetos that lie forward over it.
  caseY: { top: 0.11, bottom: -0.16, sumpBottom: -12.1 * IN, accBottom: -0.235, accTop: 0.11 },
  // AMM 80-10 PDF 2798: "mounted on a right angle starter drive adapter at the rear of the engine"; M-18 2-2.2 p. 2-5:
  // worm drive and spring clutch; Figure 5-34: the starter's centreline 1.78 in aft of the accessory face.
  starter: "rear-adapter",
  starterAftIn: 1.78,
  // AMM 61-20 PDF 2450: "located on the lower left forward portion of the engine crankcase"; M-18 2-2.2: driven by a
  // bevel gear on the end of the camshaft.
  governor: "front-lower-left",
  // ALT 1, ALT 2, the magnetos, the oil filter and the oil filler sit where the SR22T installs them (the Cirrus AMM
  // figures below), measured from the accessory mounting face and the crankshaft axis.
  alternators: [
    {
      name: "ALT 1",
      drive: "gear",
      ratio: null, // M-18 Table 2-9: gear-driven alternator 3:1 (the spec's alternatorRatio)
      // AMM 13773-002 Rev 7 Fig 24-30-3 (PDF p. 714), Fig 71-00-2 sheet 1 item 7 (PDF p. 2487): the shaft runs across
      // the engine, the drive flange on a pad on the right side of the crankcase nose, the terminal end outboard. M-18
      // Figure 5-34 view D-D and Figure 5-35 (pp. 5-54, 5-55): on the crankshaft centreline.
      axis: "transverse",
      angleDeg: 90,
      // Scaled from M-18 Figures 5-35 (station, against its 3.97 in) and 5-34 view D-D (pad and end faces, against its
      // 10.52 in), ± 0.5 in: station 27.3 in forward of the accessory face, pad 6.7 in and end 9.45 in right of the
      // crankshaft centreline, Ø 5.75 in.
      transverse: { stationIn: 27.3, padIn: 6.7, endIn: 9.45, r: (5.75 / 2) * IN },
      src: "POH 7-47; AMM Fig 24-30-3; M-18 2-2.2, Table 2-9",
      note: "ALT 1: gear-driven 100 A alternator on the right front (POH 7-47), its shaft across the engine on a pad on the right side of the crankcase nose, terminal end outboard (AMM Fig 24-30-3, Fig 71-00-2 sheet 1). The alternator drive gear on the crankshaft turns it at three times crankshaft speed (M-18 2-2.2, Table 2-9); the bevel pinion is drawn, not published.",
    },
    {
      name: "ALT 2",
      drive: "belt",
      // FIT, drawing only: no document gives the belt alternator's ratio. The crankshaft pulley is scaled from Figure
      // 5-33 (≈ 7.4 in across) over a 3.10 in alternator pulley.
      ratio: 2.4,
      // AMM Fig 24-30-4 (PDF p. 717), Fig 71-00-2 sheet 2 item 15 (PDF p. 2488); POH 7-47 "front left": below and
      // outboard of the crankshaft, shaft parallel to it. Pulley centre 2.95 in below and 8.46 in left of the crankshaft
      // centreline (approximate). Neither figure is dimensioned; M-18 Figure 5-34 view D-D draws it
      // ≈ 1.2 in above the centreline, and the Cirrus figures govern.
      angleDeg: 250.8,
      r: 0.2277,
      // AMM Fig 24-30-4 items 5, 6: the drive sheave sits on its adapter at the propeller flange, under the propeller;
      // FIT: drawn 26 mm forward of the flange face, so ALT 2's body stays forward of the propeller governor.
      pulleyBehindFlange: -0.026,
      bodyLen: 0.06,
      src: "POH 7-47; AMM Fig 24-30-4",
      note: "ALT 2: belt-driven 70 A alternator on the front left (POH 7-47), below and outboard of the crankshaft, its pulley in the plane of the drive sheave on the propeller flange (AMM Fig 24-30-4, Fig 71-00-2 sheet 2).",
    },
  ],
  // FIT: the drive sheave and its adapter between the flange and the propeller (AMM Fig 24-30-4 items 5, 6), drawn
  // 31 mm thick; no document gives the stack.
  propSpacer: 0.031,
  // M-18 2-2.2: the crankshaft gear drives an idler gear, which drives the magneto drive gears.
  magDrive: "idler",
  // AMM Fig 74-20-1 detail A (PDF p. 2624), Fig 71-00-2 sheet 2 items 19, 20 (PDF p. 2488): the drive coupling aft into
  // the accessory case, the body and the harness cap forward of it, on top of the rear of the engine. Drawn 0.09 m long
  // (filling the 2.8-3.6 in forward of the accessory face in M-18 Figure 5-33's side view, illustrative), radius 0.05 m
  // (illustrative), pad centres 2.7 in either side of the centreline (Figure 5-33 rear view, scaled), 0.16 m above the
  // crankshaft (approximate).
  magnetos: { mount: "forward", r: 0.05, len: 0.09, z: 2.7 * IN, y: 0.16 },
  // M-18 Figure 13-10 (p. 13-13), Figure 5-33 rear view (p. 5-53); AMM Fig 71-00-2 sheet 3 item 27 (PDF p. 2489): a
  // spin-on canister standing vertically on the adapter on the oil pump housing, at the left rear, its top 2.42 in above
  // the crankshaft (dimensioned), 4.0 in left and Ø 3.65 in (scaled), its bottom ≈ 2.1 in below. The fore-aft station is
  // approximate (no view gives it): drawn 2.96 in aft of the accessory face.
  oilFilter: {
    mount: "vertical",
    aftIn: 2.96,
    yIn: 0.16,
    zIn: -4.0,
    r: (3.65 / 2) * IN,
    len: (2.42 + 2.1) * IN,
    src: "M-18 Figures 5-33, 13-10; AMM Fig 71-00-2 sheet 3",
  },
  // POH 7-37: the oil filler and dipstick at the left rear, under the top-left cowl door (AMM Fig 71-00-2 sheet 2 item 21).
  oilFiller: { side: "L" },
  // M-18 2-2.2: "The splined end of the oil pump drive gear mates with the internal splines of the camshaft gear".
  oilPumpDrive: "cam",
  // AMM 71-20 General (PDF p. 2522): six mount fittings. M-18 Figure 16-38 (p. 16-41): a forward and an aft engine mount
  // bracket on each side of the crankcase. Inches forward of the accessory mounting face, out from and below the
  // crankshaft centreline:
  // - forward: the two Ø 0.47 holes in each mount leg, 3.28 in apart: 20.27 and 16.99 in on the left (Figure 5-33 p. 5-53,
  //   16.30 + 3.97 in), 20.19 and 16.91 in on the right (Figure 5-35 p. 5-55, 16.22 + 3.97 in); 7.62 in out and 8.21 in
  //   below (Figure 5-34 view D-D p. 5-54, the front mounts 15.24 in apart). The side views draw a leg's two holes level,
  //   so the rear hole takes the front hole's height and offset.
  // - aft: 7.31 in out and 8.13 in below (Figure 5-33 rear view, 14.62 in apart). FIT, approximate station: no view
  //   dimensions it; both side views draw the aft mount's centre on the extension line 3.97 in forward of the accessory
  //   face (Figures 5-33, 5-35), scaled, ± 0.5 in.
  // FIT: the bosses are drawn as the other engines' (a short cylinder along the crankshaft), each on a bar from the
  // crankcase's lower edge, and each leg's two bosses joined by a bar; the bracket shapes are schematic.
  mounts: (d) => {
    const at = (stationIn: number, outIn: number, belowIn: number, side: 1 | -1): V3 => [
      d.accRear + stationIn * IN,
      -belowIn * IN,
      side * outIn * IN,
    ];
    const bosses = ([-1, 1] as const).flatMap((side) => {
      const [front, rear] = side < 0 ? [20.27, 16.99] : [20.19, 16.91];
      return [at(front, 7.62, 8.21, side), at(rear, 7.62, 8.21, side), at(3.97, 7.31, 8.13, side)];
    });
    // from inside the crankcase half's rounded lower edge
    const root = ([x, , z]: V3): V3 => [x, d.caseBottom + 0.02, Math.sign(z) * (d.caseHalf - 0.01)];
    return {
      bosses,
      brackets: [...bosses.map((b): [V3, V3] => [root(b), b]), [bosses[0], bosses[1]], [bosses[3], bosses[4]]],
    };
  },
  labels: (d) => [
    ["Magnetos", [d.accRear + 0.045, 0.26, 0]],
    // over the canister's top (2.42 in above the crankshaft), shown while the canister is in view: hidden by the magnetos
    // from the default and iso cameras, never by the filter and its adapter
    ["Oil filter", [d.accRear - 2.96 * IN, 2.42 * IN + 0.025, -4 * IN], { occlude: true }],
    ["Fuel manifold", [0, d.caseTop + 0.09, 0]],
    ["Starter", [d.accRear - 1.78 * IN, -0.2, 0.2]],
    ["ALT 1", [d.accRear + 27.3 * IN, 0.1, 0.26]],
    ["ALT 2", [d.flangeX - 0.02, -0.01, -0.3]],
    ["Governor", [d.front, -0.22, -0.12]],
    // these hide with their part groups, as the turbo and exhaust labels do
    ["Fuel pump", at(-3.9, -1.3, -0.3), { group: "fuel" }],
    ["Throttle body", at(27.2, 9.4, 2.2), { group: "induction" }],
    ["Alternate air door", at(21.6, -15.9, 0), { group: "induction" }],
  ],
  // FIT, checked by shot: the target dropped towards the middle of the drawn height (the tailpipes reach 26.7 in below
  // the crankshaft centreline) and the view drawn ≈ 1.3 times as far as before the turbochargers and exhaust were
  // drawn, so every label stays in the canvas.
  camera: { position: [1.85, 0.75, 2.2], target: [0, -0.2, 0], maxDistance: 6 },
  turbo: TSIO550K_TURBO,
  exhaust: EXHAUST,
  induction: INDUCTION,
  fuel: FUEL,
  notes: {
    crankshaft:
      "Six rod journals and five main journals (M-18 2-2.2.1, Figure 2-6); the crankshaft gear at the rear drives the camshaft, the idler and the fuel pump.",
    mainBearings: "Precision main bearing inserts in saddles line-bored in the crankcase halves (M-18 2-2.1).",
    counterweight:
      "Counterweights absorb torsional vibration: two sixth-order on the No. 2 crankshaft cheek, a fifth- and a fourth-order on the No. 5 (M-18 2-2.2.1, Figure 2-6). Drawn hanging opposite their crankpins; the angle is schematic.",
    propFlange: "ARP 502 propeller flange, 32.50 in forward of the accessory mounting face (M-18 Figures 5-33, 5-34).",
    altPulley:
      "Drive sheave for ALT 2's belt, on its adapter at the propeller flange under the propeller (AMM Fig 24-30-4). Pulley sizes are drawn, not published.",
    altBelt: "ALT 2's belt. The drive ratio isn't published; the pulleys are drawn about 2.4 to 1.",
    altDriveGear:
      "Alternator drive gear, bolted to a flange behind the front main journal (M-18 2-2.2.1); drives ALT 1, across the engine, at three times crankshaft speed (Table 2-9). Drawn turning a bevel pinion on ALT 1's shaft.",
    pistonOil:
      "Oil from the galleries reaches the rotating parts and the piston inner domes (POH 7-36, 7-37). Drawn as a nozzle.",
    baseFlange: "Seven studs and two through-bolts hold each cylinder base flange to the crankcase (M-18 2-2.1).",
    rockerCover: "One of the two rocker covers on the head's outer face (M-18 Figure 5-33).",
    intakePort: "Downdraft intake inlet, cast in the top of the cylinder head (M-18 2-1).",
    exhaustPort: "Downdraft exhaust outlet at the bottom of the cylinder (M-18 2-1).",
    nozzle:
      "Air-bled injector nozzle at the cylinder's intake port, one for each of the six cylinders (M-18 2-1; POH 7-38).",
    plug: "Twelve spark plugs, two in each cylinder (POH 7-37); each magneto fires one plug in every cylinder.",
    camshaft:
      "Runs under the crankshaft in bearings line-bored in the crankcase (M-18 2-2.1, Figure 2-5); one lobe per valve, at half crankshaft speed.",
    govDriveGear:
      "Governor drive bevel gear on the end of the camshaft; it meshes with the governor's driven bevel gear (M-18 2-2.2).",
    crankcaseRight:
      "Two aluminium alloy castings joined along the centre vertical plane; bosses line-bored for the camshaft bearings and main bearing saddles (M-18 2-2.1).",
    crankcaseLeft:
      "Left half: its cylinder pads are farther forward than the right half's, so each connecting rod works on its own crankpin (M-18 2-2.1).",
    crankcaseBolts: "Studs and through-bolts along the parting plane (M-18 2-2.1).",
    mounts:
      "Six mount fittings on the engine's mount brackets (AMM 71-20): two in each forward mount leg, about 17 and 20 in forward of the accessory mounting face, and an aft mount on each side about 4 in forward of it (M-18 Figures 5-33 to 5-35, 16-38). The aft station is approximate; the brackets are drawn schematically.",
    accessoryHousing:
      "The accessory case on the rear: magnetos, starter adapter, fuel pump and oil pump drives (M-18 Figure 2-4; POH 7-31).",
    sump: "Wet sump under the crankcase, eight quarts (POH 7-36).",
    oilFilter:
      "Full-flow spin-on oil filter (POH 7-31), standing on the adapter on the oil pump housing at the left rear (M-18 Figure 13-10; AMM Fig 71-00-2 sheet 3). Its fore-aft station is approximate.",
    oilPump:
      "Positive-displacement oil pump: draws oil from the sump through the suction screen to the filter (POH 7-36).",
    oilPumpDrive:
      "The oil pump drive gear is splined into the camshaft gear and turns at camshaft speed (M-18 2-2.2); the pump's own gear ratio isn't published.",
    screen: "Oil suction strainer screen in the sump (POH 7-36).",
    screenPlug: "Plug for removing the suction screen.",
    drain: "Drain plug on the oil sump.",
    dipTube: "Oil filler and dipstick, at the left rear of the engine (POH 7-37).",
    oilSupply:
      "From the filter into the crankcase galleries, which feed the rotating parts and the pistons (POH 7-36).",
    magneto:
      "One of two engine-driven magnetos (POH 7-37), on top of the rear of the engine: drive coupling aft into the accessory case, distributor cap and leads forward (AMM Fig 74-20-1). START energizes the starter and both magnetos; an impulse coupling on each holds the spark to top centre while cranking (POH 7-37; AMM 74-00).",
    magCap: "Leads to six plugs leave here: one in every cylinder (POH 7-37).",
    magGear:
      "On the magneto's drive coupling behind the accessory face, meshing tooth for tooth with the idler's rear gear (M-18 2-2.2): the idler turns at 1.5 times crankshaft speed, and so does the magneto (Table 2-9). Tooth counts are drawn, not published.",
    idler:
      "Idler gear: the crankshaft gear drives it, and it drives both magneto drive gears (M-18 2-2.2, Figure 2-5). Drawn as two gears on one shaft: 16 teeth on the crankshaft gear's 24 in front, and a rear gear behind the accessory face for the magneto gears.",
    magDriveHousing:
      "The top of the accessory case behind the magnetos' mounting pads: each magneto's drive coupling goes aft into it (AMM Fig 74-20-1 detail A). Its shape is schematic.",
    harness:
      "Shielded leads: the right magneto fires the lower right and upper left plugs, the left magneto the lower left and upper right (POH 7-37).",
    fuelManifold:
      "Fuel manifold valve: divides the metered fuel among the six nozzle lines (POH 7-38). The pump is drawn at the rear of the engine and the metering valve on the throttle body.",
    fuelLines: "Manifold valve to the six nozzles (POH 7-38). They glow with fuel flow.",
    starter:
      "24 V starter on a right-angle adapter at the rear (AMM 80-10); worm drive, 48 starter turns per crankshaft turn (M-18 Table 2-9). Engaged while the switch is held at START.",
    starterShaftGear:
      "Starter shaft gear: drives the crankshaft gear when the adapter's spring clutch grips its drum (M-18 2-2.2).",
    starterAdapter:
      "Right-angle starter drive adapter on the rear of the engine (AMM 80-10): the worm and worm wheel run inside it, and the scavenge pump bolts to its cover (M-18 16-4, Figure 16-17). Its shape is drawn.",
    clutchSpring:
      "Clutch spring: while the starter motor is energized it grips the starter shaft gear, so the worm wheel turns the crankshaft gear; when the starter is released its grip is relieved and the shaft gear runs free (M-18 2-2.6, Figure 16-17). Glows while it grips.",
    starterWorm:
      "Worm and worm wheel in the starter adapter; the spring clutch lets go once the engine runs (M-18 2-2.2). Drawn with one worm start and 48 wheel teeth.",
    governor:
      "Propeller governor on the lower left front of the crankcase (AMM 61-20), driven by a bevel gear on the camshaft at crankshaft speed (M-18 2-2.2, Table 2-9). Factory-set to 2500 rpm; no propeller control (AMM 61-20).",
  },
};
