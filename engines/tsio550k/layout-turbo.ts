/**
 * The TSIO-550-K's turbochargers, wastegate, controller, intercoolers, overboost valve and turbocharger oil lines in
 * the engine page's 3D scene (`components/engine/scene/Turbo.tsx` draws them; `layout.ts` imports this as its `turbo`).
 * Scene data only: the model reads `spec.ts`, never this file.
 *
 * Positions are given in inches and converted: s forward of the accessory mounting face, y above the crankshaft
 * centreline, z right of it (left is negative). The accessory face is 16.25 in behind the scene's origin (M-18 Figure
 * 5-33: 32.50 in to the propeller-flange face, origin midway, as `layout.ts` puts it).
 *
 * M-18 = Continental TSIO-550 Permold Series Engine Maintenance and Overhaul Manual, 21 Sep 2017 (page, PDF page in
 * brackets); POH = Cirrus SR22T POH 13772-007; AMM = Cirrus AMM 13773-002 Rev 7 (chapter, PDF page). "Dimensioned"
 * values are printed on the drawing; "scaled" values were measured off it against a dimension printed on the same view
 * (Figure 5-33 at 300 dpi, ± 0.3 in unless stated); "approximate" values place a part the documents name but don't
 * locate. The drawn turbo stations and housing sizes follow the drawing, not the airplane's cowl.
 *
 * The other scene parts connect to these positions (they are the contract): the exhaust meets `turbineInlet`, the
 * tailpipes `outlet`, the wastegate's transition and the LH tailpipe its `wastegate.flanges` (top and bottom faces),
 * and the air boxes `inletFace`; the induction ducts run from
 * `compressorOutlet` to the intercoolers' `inlet` and on from their `outlet`; the oil cooler carries `coolerOutlet` and
 * `coolerInboard`; the throttle body and manifold lines end at the controller's `deckPort` and `mapPort`.
 */
import type { TurboLayout, TurboSideDef } from "@/components/engine/scene/Turbo";

const IN = 0.0254;
/** The accessory mounting face, inches from the scene origin (M-18 Figure 5-33; `layout.ts` stationsIn). */
export const ACCESSORY_FACE_IN = -16.25;

type V3 = [number, number, number];
/** Inches (s forward of the accessory face, y up, z right) to scene metres. */
const at = (s: number, y: number, z: number): V3 => [(ACCESSORY_FACE_IN + s) * IN, y * IN, z * IN];
const sx = (s: number) => (ACCESSORY_FACE_IN + s) * IN;

function side(side: "L" | "R", yIn: number, zIn: number, titS: number): TurboSideDef {
  return {
    side,
    y: yIn * IN,
    z: zIn * IN,
    x: {
      // M-18 Figure 5-33 (LH side view) and Figure 5-35 (RH side view): turbine housing aft face 3.97 in forward of
      // the accessory face, dimensioned on both
      turbineAft: sx(3.97),
      // scaled, Figure 5-33: turbine housing front 6.4, centre housing (the TURBO OIL INLET leader) 7.3, centre /
      // compressor joint 8.3, compressor housing front 9.9, the Ø3.00 inlet's face 11.9 in. Figure 5-35 agrees at the
      // inlet face (11.8); its middle stations read up to 2 in further aft, depending on which outline the 3.97
      // extension line meets, so both sides use the LH side view's.
      turbineFront: sx(6.4),
      centre: sx(7.3),
      centreFront: sx(8.3),
      compressorFront: sx(9.9),
      inletFace: sx(11.9),
    },
    // scaled, Figure 5-33 side view: turbine housing ≈ 6.8 in high, compressor housing ≈ 5.3 in, centre housing
    // ≈ 4.0 in; compressor inlet Ø3.00 in, dimensioned (Figures 5-33, 5-35)
    r: { turbine: 3.4 * IN, centre: 2.0 * IN, compressor: 2.65 * IN, inlet: 1.5 * IN },
    // scaled, Figure 5-33: a Ø3.3 in discharge collar runs ≈ 1.5 in aft of the turbine housing to the tailpipe joint
    outlet: { x: sx(3.97 - 1.5), r: 1.65 * IN },
    // scaled, Figure 5-33: the turbine inlet flange on top of the housing, 5.0 in forward of the accessory face, its
    // face 4.2 in above the shaft axis
    turbineInlet: at(5.0, yIn + 4.2, zIn),
    // scaled, Figure 5-33: the compressor scroll's outlet on top of the housing
    compressorOutlet: at(9.1, yIn + 4.0, zIn),
    // TIT boss 0.4375-20UNF-3B (Figure 5-33 callout) on the turbine inlet: 9.35 in below the crankshaft centreline,
    // 5.3 in (LH, Figure 5-33) and 5.6 in (RH, Figure 5-35) forward of the accessory face; scaled
    tit: at(titS, -9.35, zIn),
  };
}

// Intercooler core: aft end 1.0 in forward of the accessory face (scaled, Figure 5-34 plan view: the RH dimension's
// aft extension line reads 1.5, the LH's 0.8, ± 0.5 in), core 6.3 in wide (scaled, Figure 5-34: inner edge ≈ 14.8 in
// from the centreline) and 3.1 in deep: the rear view (Figure 5-33, against the dimensioned 3.75 in aft-port height)
// scales the core from 1.9 to 5.0 in above the crankshaft centreline, and the RH side view (Figure 5-35, against its
// 10.74 in) agrees within ± 0.5 in. AMM Figure 71-60-2 (PDF 2558, undimensioned) draws the core's end face about half
// as deep as it is wide, which agrees. The base is drawn at 4.25 in (FIT) instead of 1.9 so the core clears the
// schematic cylinder heads under it by more than 0.25 in: their fins reach 3.94 in above the crankshaft centreline and
// 16.31 in out (Cylinders.tsx), past the core's inner edge. The RH base is drawn 0.1 in higher, at 4.35 in (FIT), so
// its inner edge, 0.08 in farther inboard than the LH's, also clears the No. 1 cylinder's intake port flange
// (Cylinders.tsx) by more than 0.25 in. The full depth stands on that base, so the top is drawn 2.35 in (LH) and
// 2.45 in (RH) above the drawing's.
const IC_AFT = 1.0,
  IC_BASE = { L: 4.25, R: 4.35 },
  IC_DEPTH = 3.1,
  IC_WIDTH = 6.3;
// The outlet neck's centre height (approximate: no view gives it): high enough that the Ø2.5 in neck passes over the
// heads' fins at its station by more than 0.25 in. It stays on the core's end face, which reaches 4.25-7.35 in (LH)
// and 4.35-7.45 in (RH).
const NECK_Y = 5.2;
function intercooler(side: "L" | "R", lengthIn: number, outerIn: number) {
  const k = side === "L" ? -1 : 1;
  const zOut = k * outerIn,
    zIn = k * (outerIn - IC_WIDTH),
    zMid = k * (outerIn - IC_WIDTH / 2);
  const base = IC_BASE[side];
  const neckY = NECK_Y;
  return {
    side,
    core: {
      x0: sx(IC_AFT),
      x1: sx(IC_AFT + lengthIn),
      zOut: zOut * IN,
      zIn: zIn * IN,
      y0: base * IN,
      y1: (base + IC_DEPTH) * IN,
    },
    // approximate: the compressor duct enters the aft end from below (AMM Figure 71-60-2, PDF 2558), 1 in inside it
    inlet: at(IC_AFT + 1.0, base, zMid),
    // scaled, Figure 5-34: the forward neck's face 17.5 in forward of the accessory face, Ø2.5 in, slightly inboard of
    // the core's middle; the outlet spigot runs on 1.0 in (approximate)
    neck: at(17.5, neckY, k * 17.3),
    neckR: 1.25 * IN,
    outlet: at(18.5, neckY, k * 17.3),
    aftPort: {
      // Figure 5-33 rear view: the aft port 18.13 in out and 3.75 in up, dimensioned (on the RH intercooler; the LH
      // one is drawn the same, mirrored)
      y: 3.75 * IN,
      z: k * 18.13 * IN,
      // scaled, Figure 5-34: the hood narrows to the nozzle 1.3 in aft of the accessory face
      x0: sx(-1.3),
      // Figure 5-34 dimensions the LH nozzle's end 3.87 in aft of the accessory face. The drawing prints
      // "3.87 [200.33]": 3.87 in is 98.3 mm (the 200.33 repeats the 7.89 in conversion beside it), and the inch value
      // agrees with the drawing's scale.
      x1: sx(-3.87),
      // scaled, Figure 5-34: Ø1.9 in
      r: 0.95 * IN,
    },
  };
}

// scaled, Figure 5-33: the wastegate's centre (see `wastegate` below)
const WASTEGATE = at(-2.6, -11.8, -12.94);

export const TSIO550K_TURBO: TurboLayout = {
  // M-18 Figure 5-33 rear view, dimensioned: the shafts 14.82 in (LH) and 14.81 in (RH) below the crankshaft
  // centreline; the turbines' outlets (and tailpipes) 12.94 in left and 13.45 in right of it
  sides: [side("L", -14.82, -12.94, 5.3), side("R", -14.81, 13.45, 5.6)],
  wastegate: {
    // POH 7-38: "one oil pressure actuated wastegate on the left side of the engine"; AMM 81-20 PDF 2812: "connected
    // to the LH tailpipe". Scaled, Figure 5-33: 2.6 in aft of the accessory face, 11.8 in below the crankshaft
    // centreline, on the LH turbine's centreline (12.94 in left); Ø2.6 in body (approximate)
    side: "L",
    at: WASTEGATE,
    r: 1.3 * IN,
    // approximate (drawing choice): a square flange top and bottom, 8 mm deep and 8 mm wider than the body each way,
    // their faces 43 mm above and below its centre
    flanges: {
      top: [WASTEGATE[0], WASTEGATE[1] + 0.043, WASTEGATE[2]],
      bottom: [WASTEGATE[0], WASTEGATE[1] - 0.043, WASTEGATE[2]],
      halfWidth: 1.3 * IN + 0.008,
      thickness: 0.008,
    },
    // scaled, Figure 5-33 rear view: WASTEGATE ACTUATOR outboard of the valve, ≈ 4 in, slightly above the shaft line;
    // its size is approximate
    actuator: { at: at(-2.6, -12.0, -17.0), r: 1.0 * IN, len: 3.0 * IN },
  },
  controller: {
    // M-18 12-4.2 p. 12-10 [307]: "aircraft mounted"; AMM 81-20 PDF 2812: "located on the upper firewall"; AMM Fig
    // 71-00-2 sh 3 (PDF p. 2489) item 30: at the left rear, outboard of the oil cooler. Drawn free-standing behind the
    // engine on that side, 16 in left of the crankshaft centreline and 4.5 in above it (approximate, inside the
    // figure's 14-18 in left and 3-6 in up). The bulkhead fittings for the deck- and manifold-pressure hoses (M-18
    // Figure 12-7 p. 12-11 [308], items 8-15) sit between it and the engine (approximate)
    at: at(-7.0, 4.5, -16.0),
    deckPort: at(-4.5, 6.5, -13.0),
    mapPort: at(-4.5, 6.5, -15.0),
  },
  // M-18 Figure 5-34 p. 5-54 [149] plan view, dimensioned: cores 11.54 in (LH) and 12.28 in (RH) long, outer edges
  // 21.23 in (LH) and 21.15 in (RH) from the crankshaft centreline (42.39 in overall). The drawing's own scale
  // doesn't match these two: their arrows span ≈ 10.6 in (LH) and ≈ 10.2 in (RH) against the printed 7.31 / 7.89 in
  // cylinder pitches. The printed values are drawn.
  intercoolers: [intercooler("L", 11.54, 21.23), intercooler("R", 12.28, 21.15)],
  // AMM 71-60 PDF 2542: "An overboost valve, located on the outlet tube of the LH intercooler". Drawn on the LH outlet
  // spigot, the start of that tube (approximate)
  overboost: { side: "L", at: at(18.0, NECK_Y + 1.25, -17.3) },
  oil: {
    // The oil cooler sits at the left rear, on the left crankcase half behind the No. 2 cylinder (M-18 2-1 p. 2-1
    // [43]); the turbocharger oil leaves the bottom of it (POH 7-38), as does the wastegate's separate supply, from the
    // fitting beside it (AMM Fig 79-30-2 sh 3, PDF p. 2787; M-18 12-4.2 "inboard oil cooler fitting"). The cooler's
    // centre is scaled from M-18 Figure 5-33's rear view, 1.8 in above and 9.65 in left of the crankshaft centreline;
    // its drawn height is 5.51 in, so its bottom is 2.76 in below its centre, 0.96 in below the crankshaft centreline.
    // It is 0.41 in aft of the accessory face (approximate: no view gives the station); the wastegate fitting is
    // 0.3 in inboard of it (approximate).
    coolerOutlet: at(-0.41, -0.96, -9.65),
    coolerInboard: at(-0.41, -0.96, -9.35),
    // M-18 Figure 12-21 p. 12-34 [331]: hose 15 → check valve filter assembly 22 → check valve 17 → tee 16. The check
    // valve and the tee hang below the cooler, 20 mm forward of and 65 mm outboard of its bottom fitting, 50 and 85 mm
    // down (approximate, after AMM Fig 79-30-2 sh 3); the filter assembly between the cooler and the check valve
    // (approximate)
    filter: at(0.0, -1.7, -10.65),
    checkValve: at(0.38, -2.92, -12.21),
    supplyTee: at(0.38, -4.31, -12.21),
    // scaled, Figure 5-33 rear view: the reservoir hoses meet at a tee under the engine, ≈ 1.6 in right of the
    // centreline and ≈ 6.6 in below the shafts; ≈ 3 in aft of the accessory face (side view)
    drainTee: at(-3.0, -21.4, 1.6),
    // AMM 79-00 PDF 2764: "A scavenge pump, outboard of the starter adapter". M-18 16-4.1 step 15 p. 16-20 and Figure
    // 16-17 p. 16-19 [462] (Figure D-3 p. D-4 [603], section A-A): its driver gear sits on the end of the starter shaft
    // gear and its body bolts to the adapter's cover, so the pump is drawn aft of the cover (2.30 in aft of the
    // accessory face, Systems.tsx starterAdapter) on the starter shaft's axis, 2.227 in below and right of the
    // crankshaft centreline (kit.ts driveLayout). The drum's centre 1.39 in aft of the cover; approximate.
    scavengePump: at(-3.69, -2.227, 2.227),
    // The return's "connection at the rear of the crankcase" (AMM 79-00): on the accessory housing's rear face, below
    // the adapter and clear of its footprint, and right of the oil suction line where it rises to the pump (Case.tsx);
    // position approximate.
    pumpReturn: at(0.0, -6.4, 2.4),
    // The controller's drain fitting "on the rear of the crankcase" (M-18 12-4.2 step 3; 17-12.2 step 4): Figure 5-33
    // rear view, C'CASE OIL RETURN CONN. (37° flare, 0.5625-18UNF-2A), scaled against the 2.42 in filter dimension
    // beside it: 2.3 in left of and 3.1 in above the crankshaft centreline, under the LH magneto pad and above the oil
    // filter. No view gives its station: drawn on the rear face of the magneto drive housing, which the scene draws
    // 0.94 in aft of the accessory face (`Systems.tsx` ignitionGeometry), so the hose stays clear of its gears
    // (approximate)
    controllerReturn: at(-0.95, 3.1, -2.3),
    // routes approximate
    lines: {
      supply: [at(-0.41, -0.96, -9.65), at(0.0, -1.7, -10.65), at(0.38, -2.92, -12.21), at(0.38, -4.31, -12.21)],
      toL: [
        at(0.38, -4.31, -12.21),
        at(2.0, -7.0, -11.5),
        at(5.0, -8.8, -11.0),
        at(7.3, -10.0, -11.4),
        at(7.3, -12.4, -12.94),
      ],
      toR: [
        at(0.38, -4.31, -12.21),
        at(1.5, -8.5, -10.0),
        at(3.5, -12.9, -6.0),
        at(4.5, -12.9, 6.0),
        at(7.3, -11.4, 11.0),
        at(7.3, -12.4, 13.45),
      ],
      // down from each reservoir, then aft and inboard under the turbine housings, clear of the tailpipes
      drainL: [
        at(7.3, -17.6, -12.94),
        at(7.3, -20.0, -12.0),
        at(3.0, -21.0, -8.0),
        at(-3.0, -21.2, -3.0),
        at(-3.0, -21.4, 1.0),
      ],
      drainR: [
        at(7.3, -17.6, 13.45),
        at(7.3, -20.0, 12.0),
        at(3.0, -21.0, 8.0),
        at(-3.0, -21.2, 3.5),
        at(-3.0, -21.4, 2.2),
      ],
      // up to the fitting under the drum's outboard side; the return leaves from under its inboard side, drops below
      // the adapter's worm boss and runs forward to the case (M-18 Figure D-3: the elbow on the pump's lower side)
      scavenge: [at(-3.0, -21.0, 1.6), at(-3.6, -12.0, 2.6), at(-3.69, -6.0, 2.9), at(-3.69, -3.35, 2.9)],
      pumpReturn: [at(-3.69, -3.35, 1.55), at(-3.69, -5.8, 1.4), at(-2.6, -6.4, 2.4), at(0.0, -6.4, 2.4)],
      toWastegate: [
        at(-0.41, -0.96, -9.35),
        at(-1.6, -4.0, -13.5),
        at(-2.6, -8.0, -16.0),
        at(-2.6, -10.2, -17.0),
        at(-2.6, -11.0, -17.0),
      ],
      toController: [at(-3.5, -11.2, -18.2), at(-5.0, -4.0, -18.5), at(-6.5, 1.5, -17.5), at(-7.0, 2.7, -16.4)],
      // over the oil filter's forward rim, then forward into the drive housing's face under the LH magneto
      controllerDrain: [
        at(-7.0, 2.7, -15.6),
        at(-5.0, 3.0, -10.0),
        at(-3.0, 3.5, -6.0),
        at(-1.7, 3.4, -4.4),
        at(-1.45, 3.15, -2.45),
        at(-0.95, 3.1, -2.3),
      ],
    },
  },
  notes: {
    compressor:
      "Compressor housing: the compressor wheel raises the pressure and temperature of the induction air before it goes to the intercoolers (POH 7-38; AMM 81-20). Its outlet on top feeds the duct to this side's intercooler.",
    compressorWheel:
      "Compressor wheel, on the same shaft as the turbine wheel (AMM 81-20). Drawn turning far slower than the real wheel, which turns at tens of thousands of rpm.",
    inlet:
      "Compressor inlet, Ø3.00 in (M-18 Figures 5-33, 5-35): filtered air from the air box enters here (POH 7-37).",
    centre:
      "Centre (bearing) housing: engine oil enters at the top (M-18 Figure 5-33, TURBO OIL INLET) and lubricates the shaft bearings; seals keep it out of the compressor and turbine (AMM 79-00).",
    shaft: "The common shaft: the turbine wheel drives the compressor wheel (AMM 81-20).",
    turbine:
      "Turbine housing: exhaust from this side's cylinders turns the turbine wheel and leaves through the discharge port and the tailpipe (POH 7-38; AMM 81-20). Tinted with this side's turbine inlet temperature.",
    turbineWheel:
      "Turbine wheel, driven by the exhaust gas (AMM 81-20). Drawn turning far slower than the real wheel; still when the engine is stopped or this turbocharger has failed.",
    turbineInlet:
      "Turbine inlet flange: the exhaust from this side's cylinders arrives here (POH 7-38; AMM Figure 81-20-1).",
    outlet: "Turbine discharge: the exhaust leaves aft through the tailpipe (POH 7-38; AMM 81-20).",
    tit: "Turbine inlet temperature probe, 0.4375-20UNF-3B boss (M-18 Figure 5-33), one in each turbine housing inlet (AMM 81-20).",
    reservoir:
      "Oil reservoir: oil collects here after passing through the bearings; the scavenge pump draws it away (AMM 79-00).",
    wastegate:
      "The single exhaust wastegate, on the left, connected to the LH tailpipe (POH 7-38; AMM 81-20; M-18 2-1): exhaust it lets past bypasses both turbines.",
    wastegatePlate:
      "Wastegate butterfly: across the bore it sends all the exhaust through the turbines; open, it bypasses them. A spring opens it whenever the actuator has no oil pressure, so it stands open with the engine stopped.",
    actuator:
      "Wastegate actuator: engine oil pressure closes the wastegate against its spring; the controller sets that pressure by metering the oil returning from it (POH 7-38/7-39; AMM 79-00).",
    actuatorRod: "Actuator rod: moves with the wastegate position.",
    controller:
      "Sloped (differential) wastegate controller: a diaphragm valve sensing upper-deck pressure against manifold pressure, across the throttle plate, meters the wastegate's oil return (POH 7-39; AMM 81-20; M-18 2-1). It is on the upper firewall in the airplane, at the left rear outboard of the oil cooler (AMM 81-20, Figure 71-00-2; M-18 12-4.2); drawn here free-standing behind the engine.",
    controllerLines:
      "Deck-pressure line from the throttle body and manifold-pressure line from the induction manifold, through bulkhead fittings to the controller (M-18 Figure 12-7).",
    intercooler:
      "Intercooler: the compressed air from this side's turbocharger is cooled here on its way to the throttle (POH 7-37). Core 11.54 in (LH) and 12.28 in (RH) long, outer edges 21.23 / 21.15 in from the centreline (M-18 Figure 5-34), about 6.3 in wide and 3.1 in deep (scaled, M-18 Figures 5-33 to 5-35); drawn raised to clear the schematic cylinder heads and intake ports. Tinted with the manifold air temperature.",
    intercoolerNeck:
      "Intercooler outlet: the cooled air goes on to the Y junction ahead of the throttle body (POH 7-37).",
    intercoolerHood:
      "Aft end of the intercooler: the duct from the compressor comes in from below. Tinted with the compressor discharge temperature.",
    aftPort:
      "Nozzle on the intercooler's aft hood (AMM Figure 71-60-2, item 19), 18.13 in out and 3.75 in above the crankshaft centreline (M-18 Figure 5-33).",
    overboost:
      "Overboost valve on the outlet of the LH intercooler (AMM 71-60): it opens at overly high manifold pressure to protect the engine (POH 7-39).",
    overboostPoppet: "Overboost valve poppet: lifts while the valve is relieving (POH 7-39).",
    supply:
      "Turbocharger oil comes from the bottom of the oil cooler (POH 7-38) through a filter and a check valve (M-18 Figure 12-21). The lines glow with oil pressure.",
    toL: "Oil supply hose from the tee to the LH turbocharger's centre housing (M-18 Figure 12-21, hose 13).",
    toR: "Oil supply hose from the tee to the RH turbocharger's centre housing (M-18 Figure 12-21, hose 14).",
    drainL: "Drain hose from the LH oil reservoir to the tee (M-18 Figure 12-21).",
    drainR: "Drain hose from the RH oil reservoir to the tee (M-18 Figure 12-21).",
    scavenge: "The scavenge pump draws the reservoirs' oil through this hose (AMM 79-00; M-18 Figure 12-21, hose 20).",
    pumpReturn:
      "Oil from the scavenge pump returns to the sump through a connection at the rear of the crankcase (AMM 79-00). Route and fitting approximate.",
    toWastegate:
      "Oil supply hose from the oil cooler's inboard fitting to the wastegate actuator (M-18 12-4.2, Figure 12-6 hose 36). Goes dark if the actuator loses its oil.",
    toController: "Oil from the wastegate to the controller's inlet (M-18 12-4.2, Figure 12-6 hose 35).",
    controllerDrain: "Controller drain to the fitting on the rear of the crankcase (M-18 12-4.2, Figure 12-6 hose 34).",
    filter: "Check valve filter assembly (M-18 Figure 12-21, item 22).",
    checkValve:
      "Check valve: stops oil draining from the oil cooler into the turbocharger reservoirs while the engine is shut down (AMM 79-00).",
    supplyTee: "Tee fitting dividing the supply between the two turbochargers (AMM 79-00; M-18 Figure 12-21).",
    drainTee: "Tee joining the two reservoir drain hoses (M-18 Figure 12-21, item 21).",
    scavengePump:
      'Scavenge pump on the starter adapter\'s cover, driven from the end of the starter shaft gear (M-18 16-4, Figure 16-17; AMM 79-00: "outboard of the starter adapter"): draws the oil from the turbocharger reservoirs and returns it to the crankcase. Its shape is drawn.',
  },
  labels: [
    ["LH turbocharger", at(7.0, -21.0, -12.94)],
    ["RH turbocharger", at(7.0, -21.0, 13.45)],
    ["Wastegate", at(-4.5, -15.5, -13.5)],
    ["Wastegate controller", at(-9.0, 7.5, -16.0)],
    ["LH intercooler", at(9.0, 8.5, -24.0)],
    ["RH intercooler", at(9.0, 8.5, 24.0)],
  ],
};
