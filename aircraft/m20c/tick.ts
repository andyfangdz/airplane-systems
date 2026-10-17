/** Presentation adapter. Headless simulations import step.ts and simulation.ts. */
import { m20cRuntime } from "./store";
export * from "./step";
export const simTick = (dt: number) => m20cRuntime.step(dt);
