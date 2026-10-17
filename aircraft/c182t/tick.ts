/** Presentation adapter. Headless simulations import step.ts and simulation.ts. */
import { c182Runtime } from "./store";
export * from "./step";
export const simTick = (dt: number) => c182Runtime.step(dt);
