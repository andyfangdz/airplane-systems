/** Small helpers for canvas-drawn cockpit displays. */

/** Blank, unpowered display. */
export function drawOff(ctx: CanvasRenderingContext2D, W: number, H: number) {
  ctx.fillStyle = "#05070A"; ctx.fillRect(0, 0, W, H);
}
