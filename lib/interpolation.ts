import { clamp, lerp } from "./math";

/** Piecewise-linear lookup in a table sorted by ascending first column (clamped). Returns [col1, col2, …]. */
export function lin(tab: number[][], x: number) {
  let i = 0;
  while (i < tab.length - 2 && x > tab[i + 1][0]) i++;
  const a = tab[i],
    b = tab[i + 1],
    t = clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
  return a.slice(1).map((v, k) => lerp(v, b[k + 1], t));
}
