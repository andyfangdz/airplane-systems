/**
 * NAV III faceplate detail shared by the 172S and 182T (POH Figure 7-2; G1000 CRG): GDU 1040 knobs, softkeys and the GFC 700
 * keys, the GMA 1347 keys and knob, and breaker heads. Each builder is drawn about its unit's centre in the panel plane
 * (x forward, y up, z right), so the airplane only places it just aft of the bezel face.
 */
import type * as THREE from "three";
import { box, cyl, mergeGeos } from "@/lib/geometry";

const tr = (g: THREE.BufferGeometry, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };

/** GDU 1040 bezel, 11.80 × 7.70 in, and the GMA 1347 between the displays, 1.35 in wide (Garmin specifications). */
export const GDU_W = 0.2997, GDU_H = 0.1956, GMA_W = 0.0343;
/**
 * Butt lines (in) of the PFD, GMA 1347 and MFD centres: the three units side by side about 0.2 in apart, centred on the
 * GMA 1347 above the standby attitude indicator (POH Figure 7-2, photos of the NAV III panel).
 */
export const NAV3_BL = { pfd: -7.3, gma: -0.5, mfd: 6.3 };
/** GDU 1040 control strips: left and right of the screen, centre to centre. */
export const GDU_STRIP = 0.128;
/** Softkey row below the screen, from the bezel centre. */
export const GDU_KEYS_Y = -0.092;

/**
 * GDU 1040 bezel knobs. Left strip: NAV volume, NAV and HDG at the top, ALT at the bottom; right strip: COM volume, COM,
 * CRS/BARO, the range joystick and FMS. With a GFC 700 the AFCS keys fill the left strip between HDG and ALT (`afcsKeys`).
 */
export const gduKnobs = (afcs = false) => mergeGeos([
  ...(afcs ? [0.082, 0.05, 0.016, -0.083] : [0.075, 0.03, -0.02, -0.068]).map((y, i) => tr(cyl(afcs && i === 0 ? 0.0075 : 0.0095, 0.012, "x", 16), 0, y, -GDU_STRIP)),
  ...[0.075, 0.03, -0.015, -0.05, -0.083].map((y, i) => tr(cyl(i === 3 ? 0.006 : 0.0095, 0.012, "x", 16), 0, y, GDU_STRIP)),
]);
/** The 12 softkeys under the screen (centred on the bezel, at `GDU_KEYS_Y`). */
export const gduKeys = () => mergeGeos(Array.from({ length: 12 }, (_, i) => tr(box(0.006, 0.008, 0.0125), 0, 0, -0.0935 + i * 0.017)));
/** GFC 700 keys on the left strip, two columns of six: AP FD, HDG ALT, NAV VNV, APR BC, VS FLC, NOSE UP / NOSE DN (bezel centre). */
export const afcsKeys = () => mergeGeos(Array.from({ length: 12 }, (_, i) => tr(box(0.006, 0.008, 0.012), 0, -0.006 - Math.floor(i / 2) * 0.011, -GDU_STRIP + (i % 2 ? 0.0075 : -0.0075))));

/** GMA 1347: two columns of COM / NAV / speaker / intercom keys (audio panel centre). */
export const gmaKeys = () => mergeGeos(Array.from({ length: 16 }, (_, i) => tr(box(0.006, 0.009, 0.012), 0, 0.082 - Math.floor(i / 2) * 0.016, (i % 2 ? 1 : -1) * 0.0075)));
/** GMA 1347 volume / squelch knob, above DISPLAY BACKUP (0.064 m below the audio panel centre). */
export const gmaKnob = () => mergeGeos([cyl(0.011, 0.01, "x", 16), cyl(0.007, 0.016, "x", 12)]);
export const GMA_KNOB_Y = -0.064;

/** Breaker heads in rows of `cols` (not mapped one-to-one to the breakers). */
export const cbHeads = (cols: number, rows = 3) =>
  mergeGeos(Array.from({ length: rows * cols }, (_, i) => tr(cyl(0.0045, 0.008, "x", 10), 0, ((rows - 1) / 2 - Math.floor(i / cols)) * 0.02, (i % cols - (cols - 1) / 2) * 0.016)));

/**
 * Switch-panel rockers, POH Figure 7-2: the five LIGHTS switches across the top row, the rest below, left-aligned under them.
 * Returns each item with its offset [y, z] from the switch panel's centre (0.07 × 0.22 m).
 */
export const switchRows = <T>(rows: T[][]): [number, number, T][] =>
  rows.flatMap((row, r) => row.map((it, i): [number, number, T] => [r ? -0.017 : 0.016, (i - 2) * 0.027, it]));
