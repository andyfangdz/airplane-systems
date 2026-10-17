import type { FlightState } from "@/lib/avionics/flight";
import { lin } from "@/lib/interpolation";
import { live, type Sim } from "./model";

/** Alternate static source, flaps UP (POH Fig 5-1 Sheet 2): normal KIAS → alternate KIAS. */
const ALT_KIAS = [
  [55, 53],
  [60, 58],
  [70, 70],
  [80, 81],
  [90, 91],
  [100, 101],
  [120, 121],
  [140, 141],
  [160, 161],
];
/** Altimeter correction with the alternate static source, flaps UP, sea level to 4,000 ft (POH Fig 5-2): indicated = true + correction. */
const ALT_FT = [
  [60, 30],
  [80, 10],
  [100, -20],
  [120, -30],
  [140, -50],
  [160, -50],
];

/** Air data as the instruments see it: pitot/static blockages and the alternate static source (POH 3-13, 3-30, Figs 5-1, 5-2). */
export function indicated(s: Sim, fs: FlightState, sample: typeof live = live) {
  let ias = fs.ias,
    alt = fs.alt,
    vs = fs.vs;
  if (s.pitot.pitotBlocked) ias = 0;
  if (s.pitot.staticBlocked && !s.pitot.altStatic) {
    alt = sample.staticAlt ?? fs.alt;
    vs = 0;
  }
  if (s.pitot.altStatic && ias > 40) {
    ias = lin(ALT_KIAS, ias)[0];
    alt += lin(ALT_FT, fs.ias)[0];
  }
  return { ias, alt, vs };
}
