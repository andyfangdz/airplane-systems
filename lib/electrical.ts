/**
 * Establish battery availability before allowing it to excite an alternator. The probe must retain an already
 * excited alternator, but suppress new battery-powered excitation; otherwise the new alternator hides depletion by
 * taking the load off the battery. Each airplane retains its own buses, breakers and illustrative endurance model.
 */
export function solveBatteryExcitation<E extends { batFrac: number }>(
  solve: (batteryAvailable: boolean, allowBatteryExcitation: boolean) => E,
): E {
  const probe = solve(true, false);
  return solve(probe.batFrac < 1, true);
}
