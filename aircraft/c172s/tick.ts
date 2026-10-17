/** Presentation adapter. Headless simulations import step.ts and simulation.ts. */
import { c172Runtime } from "./store";
export * from "./step";
export const simTick = (dt: number) => c172Runtime.step(dt);
