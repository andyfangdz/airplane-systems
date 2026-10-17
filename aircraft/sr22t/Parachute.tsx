"use client";
import type { ModelRefs } from "../types";
import { Parachute as CapsDeployment, capsPhases } from "../cirrus/Parachute";
import { live } from "./model";
import { CAPS_BOX, HARNESS, ROCKET_T, TAUT_T, strapOut, strapPeel } from "./parts";
import { useSR22T } from "./store";

export const { CAPS_PHASES, capsPhase } = capsPhases(ROCKET_T, TAUT_T);

const CAPS = { CAPS_BOX, HARNESS, ROCKET_T, TAUT_T, strapOut, strapPeel };
const deployed = () => useSR22T.getState().s.capsOn && live.capsT >= 0;
const time = () => live.capsT;

/** The CAPS deployment (`cirrus/Parachute.tsx`) on this airplane's harness, store and timeline. */
export const Parachute = (refs: ModelRefs) => <CapsDeployment {...refs} caps={CAPS} deployed={deployed} time={time} />;
