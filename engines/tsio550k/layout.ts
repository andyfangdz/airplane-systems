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
import type { EngineLayout } from "@/components/engine/scene/layout";

const IN = 0.0254;

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
  // Figure 5-34 view D-D: ≈ 12.1 in below the crankshaft centreline (± 0.5 in).
  caseY: { top: 0.11, bottom: -0.16, sumpBottom: -12.1 * IN, accBottom: -0.235, accTop: 0.22 },
  // AMM 80-10 PDF 2798: "mounted on a right angle starter drive adapter at the rear of the engine"; M-18 2-2.2 p. 2-5:
  // worm drive and spring clutch; Figure 5-34: the starter's centreline 1.78 in aft of the accessory face.
  starter: "rear-adapter",
  starterAftIn: 1.78,
  // AMM 61-20 PDF 2450: "located on the lower left forward portion of the engine crankcase"; M-18 2-2.2: driven by a
  // bevel gear on the end of the camshaft.
  governor: "front-lower-left",
  alternators: [
    {
      name: "ALT 1",
      drive: "gear",
      ratio: null, // M-18 Table 2-9: gear-driven alternator 3:1 (the spec's alternatorRatio)
      // POH 7-47: "mounted on the right front of the engine"; M-18 2-2.1: pad on the right crankcase forward of No. 5
      angleDeg: 80,
      // FIT, drawing only: no document gives the body length
      bodyLen: 0.11,
      src: "POH 7-47; M-18 2-2.2, Table 2-9",
      note: "ALT 1: gear-driven 100 A alternator on the right front (POH 7-47), driven at three times crankshaft speed by the alternator drive gear on the crankshaft (M-18 2-2.2, Table 2-9).",
    },
    {
      name: "ALT 2",
      drive: "belt",
      // FIT, drawing only: no document gives the belt alternator's ratio. The crankshaft pulley is scaled from Figure
      // 5-33 (≈ 7.4 in across) over a 3.10 in alternator pulley.
      ratio: 2.4,
      // POH 7-47: "mounted on the front left of the engine"; pulley centre scaled from Figure 5-34 view D-D at 300 dpi
      // against its printed 10.52 in and 5.25 in: ≈ 7.2 in left, 1.2 in up
      angleDeg: 279,
      r: 0.186,
      // Figure 5-33: the belt pulley sits just behind the propeller flange
      pulleyBehindFlange: 0.016,
      bodyLen: 0.06,
      src: "POH 7-47",
      note: "ALT 2: belt-driven 70 A alternator on the front left (POH 7-47).",
    },
  ],
  // M-18 2-2.2: the crankshaft gear drives an idler gear, which drives the magneto drive gears.
  magDrive: "idler",
  // M-18 2-2.2: "The splined end of the oil pump drive gear mates with the internal splines of the camshaft gear".
  oilPumpDrive: "cam",
  labels: (d) => [
    ["Magnetos", [d.accRear - 0.08, 0.26, 0]],
    ["Oil filter", [d.accRear - 0.12, -0.04, 0]],
    ["Fuel manifold", [0, d.caseTop + 0.09, 0]],
    ["Starter", [d.accRear - 1.78 * IN, -0.2, 0.2]],
    ["ALT 1", [d.flangeX - 0.04, 0.1, 0.24]],
    ["ALT 2", [d.flangeX - 0.04, 0.14, -0.22]],
    ["Governor", [d.front, -0.22, -0.12]],
  ],
  // FIT, checked by shot: the IO-390 view drawn 1.25 times as far (the -K is ≈ 1.2 times longer and wider; the extra
  // height is turbochargers and tailpipes, which this layout does not draw yet).
  camera: { position: [1.4375, 0.775, 1.6875], target: [0, -0.05, 0], maxDistance: 6 },
  notes: {
    crankshaft:
      "Six rod journals and five main journals (M-18 2-2.2.1, Figure 2-6); the crankshaft gear at the rear drives the camshaft, the idler and the fuel pump.",
    mainBearings: "Precision main bearing inserts in saddles line-bored in the crankcase halves (M-18 2-2.1).",
    counterweight:
      "Counterweights absorb torsional vibration: two sixth-order on the No. 2 crankshaft cheek, a fifth- and a fourth-order on the No. 5 (M-18 2-2.2.1, Figure 2-6). Drawn hanging opposite their crankpins; the angle is schematic.",
    propFlange: "ARP 502 propeller flange, 32.50 in forward of the accessory mounting face (M-18 Figures 5-33, 5-34).",
    altPulley:
      "Belt drive to ALT 2, the belt-driven alternator on the front left (POH 7-47). Pulley sizes are drawn, not published.",
    altBelt: "ALT 2's belt. The drive ratio isn't published; the pulleys are drawn about 2.4 to 1.",
    altDriveGear:
      "Alternator drive gear, bolted to a flange behind the front main journal (M-18 2-2.2.1); drives ALT 1 at three times crankshaft speed (Table 2-9).",
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
    accessoryHousing:
      "The accessory case on the rear: magnetos, starter adapter, fuel pump and oil pump drives (M-18 Figure 2-4; POH 7-31).",
    sump: "Wet sump under the crankcase, eight quarts (POH 7-36).",
    oilFilter: "Full-flow spin-on oil filter (POH 7-31). Its position here is schematic.",
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
      "One of two engine-driven magnetos (POH 7-37). START energizes the starter and both magnetos; an impulse coupling on each holds the spark to top centre while cranking (POH 7-37; AMM 74-00).",
    magCap: "Leads to six plugs leave here: one in every cylinder (POH 7-37).",
    magGear:
      "Meshes with the idler gear, which the crankshaft gear drives (M-18 2-2.2): 16 teeth to the crankshaft gear's 24, so the magneto turns at 1.5 times crankshaft speed (Table 2-9).",
    idler:
      "Idler gear: the crankshaft gear drives it, and it drives both magneto drive gears (M-18 2-2.2, Figure 2-5).",
    harness:
      "Shielded leads: the right magneto fires the lower right and upper left plugs, the left magneto the lower left and upper right (POH 7-37).",
    fuelManifold: "Fuel manifold valve: divides the metered fuel among the six nozzle lines (POH 7-38).",
    fuelLines: "Manifold valve to the six nozzles (POH 7-38). They glow with fuel flow.",
    starter:
      "24 V starter on a right-angle adapter at the rear (AMM 80-10); worm drive, 48 starter turns per crankshaft turn (M-18 Table 2-9). Engaged while the switch is held at START.",
    starterShaftGear:
      "Starter shaft gear: drives the crankshaft gear when the adapter's spring clutch grips its drum (M-18 2-2.2).",
    starterWorm:
      "Worm and worm wheel in the starter adapter; the spring clutch lets go once the engine runs (M-18 2-2.2). Drawn with one worm start and 48 wheel teeth.",
    governor:
      "Propeller governor on the lower left front of the crankcase (AMM 61-20), driven by a bevel gear on the camshaft at crankshaft speed (M-18 2-2.2, Table 2-9). Factory-set to 2500 rpm; no propeller control (AMM 61-20).",
  },
};
