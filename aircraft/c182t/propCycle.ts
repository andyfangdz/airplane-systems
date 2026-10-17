import { c182Runtime } from "./store";

/** Cancel when the pilot moves the propeller control or leaves the panel. Scenarios reset the owned timer too. */
export const cancelPropCycle = () => c182Runtime.dispatch({ type: "propCycle", active: false });

/** The illustrative 2.5-second cycle follows simulation time and is included in checkpoints and forks. */
export const startPropCycle = () => c182Runtime.dispatch({ type: "propCycle", active: true });
