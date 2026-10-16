/**
 * Garmin G1000 (GDU 1040, 10.4" 4:3) canvas drawing shared by the G1000 airplanes: PFD, MFD (EIS strip +
 * moving map), reversionary mode and round standby instruments. The SR20's Cirrus Perspective+ (GDU 1050A, also
 * 1024 × 768) uses the same drawing with `style: "perspective"` (see GduStyle). Pure: everything comes from the data
 * passed in. Drawn on a 640×480 design grid scaled uniformly (letterboxed) to the canvas — use ~640×480 canvases.
 *
 * Colours follow the G1000: white scales, cyan pilot selections (bugs, selected altitude/heading, baro),
 * magenta GPS course and trend vectors, green VOR/LOC course and active AFCS modes, white armed modes,
 * yellow cautions, red warnings and red X's over failed instruments.
 */
export type {
  AfcsAnnunc,
  Comparator,
  FlightData,
  Gauge,
  GduStyle,
  MfdData,
  NavSrc,
  PfdData,
  SpeedBands,
} from "./types";
export { drawPFD } from "./pfd";
export { drawMFD } from "./mfd";
export { drawAltimeterDial, drawStandbyAirspeed, drawStandbyAltimeter, drawStandbyAttitude } from "./standby";
