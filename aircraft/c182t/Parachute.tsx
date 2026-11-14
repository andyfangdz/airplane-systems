"use client";
import type { ModelRefs } from "../types";
import { Parachute as Deployment } from "../cirrus/Parachute";
import { BRS_PROFILE, ROCKET_T, TAUT_T, strapOut } from "./brs";
import { live } from "./model";
import { BRS_BOX, BRS_HARNESS, brsStrapPeel } from "./parts";
import { useC182 } from "./store";

const HARNESS = { CAPS_BOX: BRS_BOX, HARNESS: BRS_HARNESS, ROCKET_T, TAUT_T, strapOut, strapPeel: brsStrapPeel };
const deployed = () => {
  const b = useC182.getState().s.brs;
  return b.installed && b.deployed && live.brsT >= 0;
};
const time = () => live.brsT;

/** The optional BRS-182 deployment: the shared parachute overlay on this airplane's harness, store and timeline. */
export const Parachute = (refs: ModelRefs) => (
  <Deployment {...refs} caps={HARNESS} deployed={deployed} time={time} profile={BRS_PROFILE} />
);
