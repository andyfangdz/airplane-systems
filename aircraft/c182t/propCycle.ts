let timer: ReturnType<typeof setTimeout> | undefined;

/** Cancel when the pilot moves the propeller control, changes scenario, or leaves this panel. */
export function cancelPropCycle() {
  if (timer !== undefined) clearTimeout(timer);
  timer = undefined;
}

/** One illustrative run-up cycle; a newer cycle replaces the previous return-to-high command. */
export function startPropCycle(returnToHigh: () => void) {
  cancelPropCycle();
  timer = setTimeout(() => {
    timer = undefined;
    returnToHigh();
  }, 2500);
}
