/** Presentation adapter. Headless simulations import step.ts and simulation.ts. */
import { da40Runtime } from "./store";
export * from "./step";
export const simTick = (dt: number) => da40Runtime.step(dt);
