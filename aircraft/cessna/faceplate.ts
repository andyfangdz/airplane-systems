/**
 * NAV III faceplate detail shared by the 172S and 182T (POH Figure 7-2; G1000 CRG): GDU 1040 knobs, softkeys and the GFC 700
 * keys, the GMA 1347 keys and knob, and breaker heads. Each builder is drawn about its unit's centre in the panel plane
 * (x forward, y up, z right), so the airplane only places it just aft of the bezel face.
 */
import type * as THREE from "three";
import { box, cyl, mergeGeos } from "@/lib/geometry";

const tr = (g: THREE.BufferGeometry, x: number, y: number, z: number) => { g.translate(x, y, z); return g; };

/** GDU 1040 control strips: left and right of the screen, centre to centre (the bezel is 0.285 m wide). */
export const GDU_STRIP = 0.123;
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
export const gmaKeys = () => mergeGeos(Array.from({ length: 16 }, (_, i) => tr(box(0.006, 0.009, 0.016), 0, 0.085 - Math.floor(i / 2) * 0.017, (i % 2 ? 1 : -1) * 0.0125)));
/** GMA 1347 volume / squelch knob, above DISPLAY BACKUP (0.064 m below the audio panel centre). */
export const gmaKnob = () => mergeGeos([cyl(0.011, 0.01, "x", 16), cyl(0.007, 0.016, "x", 12)]);
export const GMA_KNOB_Y = -0.064;

/** Breaker heads in rows of `cols` (not mapped one-to-one to the breakers). */
export const cbHeads = (cols: number, rows = 3) =>
  mergeGeos(Array.from({ length: rows * cols }, (_, i) => tr(cyl(0.0045, 0.008, "x", 10), 0, ((rows - 1) / 2 - Math.floor(i / cols)) * 0.02, (i % cols - (cols - 1) / 2) * 0.016)));
