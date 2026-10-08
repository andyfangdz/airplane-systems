const MAX_STEP = 0.05;
const MAX_CATCH_UP = 1;

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
