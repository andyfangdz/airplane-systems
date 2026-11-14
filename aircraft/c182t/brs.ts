/**
 * The optional BRS-182 whole-airplane parachute (Ballistic Recovery Systems STC SA01999CH): its deployment timeline,
 * camera and the airplane's attitude under the canopy. Pure data and functions, shared by the simulation clock (step.ts),
 * the parts (parts/brs.ts), the scene overlay (Parachute.tsx) and the panel (panels/brs.tsx).
 *
 * Sources (see SOURCES.md, "Optional BRS-182 parachute"): BRS-182 Installation Manual 9005-IM Rev C (12/2/2004), section 1
 * "BRS-182 System Description", pp. 1-1 – 1-10; FAA AD 2008-02-18 (applicability). The AFM supplement was not available:
 * no limitation, procedure or placard is taken from it. Only the order of events, the eight-second line-cutter fuse and the
 * approximately ten degrees nose-down touchdown attitude come from the manual; the other times and angles are illustrative.
 */
import { clamp, ease, lerp, type Vec3 } from "@/lib/math";
import type { ParachuteProfile } from "../cirrus/Parachute";

/** Rocket fires (illustrative: the igniter fires after the handle's slack take-up, IM p. 1-5). */
export const ROCKET_T = 0.3;
/** Parachute extracted and its lines stretched (illustrative). */
export const TAUT_T = 1.6;
/**
 * The shorter rear harness section lets go: "The eight second fuse on the line cutter is initiated when the line cutter
 * release pin is pulled as the parachute is extracted" (IM p. 1-4). The fuse is shown starting at line stretch.
 */
export const RELEASE_T = TAUT_T + 8;
/** The canopy starts to inflate, and how long it takes (illustrative). */
const INFLATE_T = 2,
  INFLATE_DUR = 1.8;
/** "the airplane assumes its touchdown attitude of approximately ten degrees nose down" (IM p. 1-4). */
export const TOUCHDOWN_PITCH = -10;
/** Pitch on the shorter rear harness section, before its release (illustrative: the manual gives no angle). */
const SHORT_PITCH = -25;
/** End of the modelled timeline (s). */
export const BRS_END = 16;

/** HUD phases: [start time s, title, detail]. */
export const BRS_PHASES: [number, string, string][] = [
  [0, "Handle pulled", "Cable slack taken up, then the mechanical igniter arms and fires"],
  [ROCKET_T, "Rocket extraction", "Rocket penetrates the rear window; front straps peel off the top skin"],
  [TAUT_T, "Line stretch", "Rear straps pulled out of the baggage area; 8 s line-cutter fuse running"],
  [INFLATE_T, "Inflation", "Slider reefs the 2,400 ft² canopy to limit inflation loads"],
  [INFLATE_T + INFLATE_DUR, "Short rear harness", "Rear strap length limited until the deployment cycle is complete"],
  [RELEASE_T, "Rear harness release", "Line cutter fires; the longer, stitched rear section takes over"],
  [RELEASE_T + 1.8, "Descent", "Touchdown attitude ≈ 10° nose down"],
];
export const brsPhase = (t: number) => [...BRS_PHASES].reverse().find((p) => t >= p[0])!;

/** Fraction of each front strap peeled off the top skin at time t: 0 stowed, 1 off at line stretch (illustrative rate). */
export const strapOut = (t: number) => (t < ROCKET_T ? 0 : ease(clamp((t - ROCKET_T) / (TAUT_T - ROCKET_T), 0, 1)));

/** Airplane pitch (deg, + nose up) under the canopy. */
function pitchAt(t: number) {
  const settled = INFLATE_T + INFLATE_DUR;
  if (t < INFLATE_T) return 0;
  if (t < settled) return lerp(0, SHORT_PITCH, ease((t - INFLATE_T) / INFLATE_DUR));
  if (t < RELEASE_T) return SHORT_PITCH + Math.sin((t - settled) * 1.6) * 2;
  if (t < RELEASE_T + 1.8) return lerp(SHORT_PITCH, TOUCHDOWN_PITCH, ease((t - RELEASE_T) / 1.8));
  return TOUCHDOWN_PITCH + Math.sin((t - RELEASE_T - 1.8) * 1.1) * 2;
}

/** The shared overlay's timeline for this installation; the 2,400 ft² canopy is the CAPS size, so its radius is too. */
export const BRS_PROFILE: ParachuteProfile = {
  pitch: pitchAt,
  sway: (t) => (t > RELEASE_T + 1.8 ? Math.sin((t - RELEASE_T - 1.8) * 0.8) * 0.04 : 0),
  inflateT: INFLATE_T,
  inflateDur: INFLATE_DUR,
  packGone: 2.4,
  flameOut: 1.5,
  groundGone: 1.5,
  canopyR: 5.5,
};

/** Camera pulled back to see the canopy during a deployment. */
export const BRS_CAM: [Vec3, Vec3] = [
  [20, 9, 26],
  [0, 6, 0],
];
