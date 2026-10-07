/**
 * C172S flight-control rig (POH Figure 7-1) built with the shared Cessna rig builder.
 * Stations in inches [FS, BL, h above ground]. From the POH: copilot control wheel FS 26.0 and pedals FS 6.8
 * (POH 6-21), GFC 700 roll servo FS 59.5 and pitch/trim servos FS 180.7 (POH 6-19). Pulley positions are
 * scaled from Figure 7-1 (the POH gives none). Surface travel is from TCDS 3A12 (the POH gives none):
 * ailerons up 20° / down 15°, elevator up 28° / down 23°, rudder ±16°10', elevator tab up 22° / down 19°.
 */
import { cessnaRig, type RigSpec, type Travel } from "../cessna/rig";
import { AF } from "./geometry";

export const RIG_SPEC: RigSpec = {
  yoke: { fs: 26, bl: 13.5, h: 56.5, travel: 3.5, colFs: 11, crossH: 50.5 },
  elev: {
    crank: [17, 0, 27.6],
    arm: 2.2,
    pulleys: [
      [24, 1.5, 25.6],
      [92, 1.5, 26.8],
      [160, 1.5, 35.8],
    ],
    hornArm: 2.3,
  },
  ail: {
    lower: [13, 16.5, 31.5],
    postFs: 30.6,
    postBl: 18.2,
    postLow: 31.5,
    postHigh: 76.5,
    root: [33, 17.5, 80.0],
    crankBl: 108,
    crankC: 0.66,
    balanceC: 0.6,
  },
  rud: {
    barFs: 3,
    barH: 30,
    half: 16.5,
    armBl: 6,
    pulleys: [
      [30, 6, 25.4],
      [92, 5, 26.8],
      [205, 2.5, 40],
    ],
    hornArm: 3.2,
    hornH: 46,
    pedalTravel: 2.6,
  },
  trim: {
    wheel: [23, -2.4, 37.5],
    r: 4.5,
    pulleys: [
      [23, -2.4, 25.6],
      [92, -2.5, 26.8],
      [160, -2.5, 35.8],
      [222, -3, 42.2],
    ],
    actuator: [229, 9, 43.2],
    tabBl: 14,
  },
  steer: { fs: -10, h: 30.2, half: 3 },
  servo: {
    roll: [59.5, 4, 76],
    pitch: [180.7, 2.5, 37.8],
    trim: [180.7, -2.5, 37.8],
    names: {
      roll: "GFC 700 roll servo (FS 59.5)",
      pitch: "GFC 700 pitch servo (FS 180.7)",
      trim: "GFC 700 pitch trim servo (FS 180.7)",
    },
  },
};
export const TRAVEL: Travel = { ailUp: 20, ailDn: 15, elUp: 28, elDn: 23, rud: 16.17, tabUp: 22, tabDn: 19 };
export const RIG = cessnaRig(AF, RIG_SPEC, TRAVEL);
export const { P: PULLEYS, C: CABLES } = RIG;
