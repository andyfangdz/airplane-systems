/** Presentation adapter. Headless simulations import step.ts and simulation.ts. */
import { sr20Runtime } from "./store";
export * from "./step";
export const simTick = (dt: number) => sr20Runtime.step(dt);
