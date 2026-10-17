const MAX_STEP = 0.05;
const MAX_CATCH_UP = 1;

/** Serializable substep remainder, so a restored simulation continues on the same time grid. */
export interface SimulationClockCheckpoint {
  remainder: number;
  steps: number;
}

export interface SimulationClockOptions {
  stepSeconds?: number;
  maxCatchUp?: number;
}

/** One owned clock per simulation; rendering cadence never selects the integration step. */
export function createSimulationClock(tick: (dt: number) => void, options: SimulationClockOptions = {}) {
  const step = options.stepSeconds ?? 1 / 120;
  const maxCatchUp = options.maxCatchUp ?? MAX_CATCH_UP;
  if (!Number.isFinite(step) || step <= 0 || !Number.isFinite(maxCatchUp) || maxCatchUp < step)
    throw new Error("A simulation clock requires a positive step and a catch-up budget of at least one step");
  let remainder = 0;
  let steps = 0;
  return {
    advance(elapsed: number) {
      if (!Number.isFinite(elapsed) || elapsed <= 0) return;
      const duration = remainder + Math.min(elapsed, maxCatchUp);
      // Permit roundoff at exact step boundaries without accumulating a cadence-dependent missing step.
      const count = Math.floor((duration + step * 1e-9) / step);
      remainder = Math.max(0, duration - count * step);
      for (let i = 0; i < count; i++) {
        tick(step);
        steps++;
      }
    },
    reset() {
      remainder = 0;
      steps = 0;
    },
    checkpoint(): SimulationClockCheckpoint {
      return { remainder, steps };
    },
    restore(checkpoint: SimulationClockCheckpoint) {
      if (
        !Number.isFinite(checkpoint.remainder) ||
        checkpoint.remainder < 0 ||
        checkpoint.remainder >= step ||
        !Number.isSafeInteger(checkpoint.steps) ||
        checkpoint.steps < 0
      )
        throw new Error("Invalid simulation clock checkpoint");
      remainder = checkpoint.remainder;
      steps = checkpoint.steps;
    },
    get time() {
      return steps * step;
    },
    get alpha() {
      return remainder / step;
    },
  };
}

/**
 * Preserve elapsed time on slow frames without giving an integrator a step larger than 50 ms.
 * A long background pause catches up at most one second (20 steps), then resumes from the next frame.
 */
export function advanceSimulation(elapsed: number, tick: (dt: number) => void) {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return;
  const duration = Math.min(elapsed, MAX_CATCH_UP);
  const steps = Math.ceil(duration / MAX_STEP);
  const dt = duration / steps;
  for (let i = 0; i < steps; i++) tick(dt);
}
