/** Presentation adapter. Headless simulations import step.ts and simulation.ts. */
import { sr22Runtime } from "./store";
export * from "./step";
export const simTick = (dt: number) => sr22Runtime.step(dt);
