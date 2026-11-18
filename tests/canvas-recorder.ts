/** A canvas stand-in that records every filled rectangle and every text drawn, each with its fill colour. */
export const recorder = () => {
  const texts: { s: string; x: number; y: number; fill: unknown }[] = [],
    boxes: { x: number; y: number; w: number; h: number; fill: unknown }[] = [];
  const paths: { x: number; y: number; fill: unknown }[] = [];
  let start = { x: 0, y: 0 };
  const st: Record<string | symbol, unknown> = {};
  const ctx: CanvasRenderingContext2D = new Proxy(st, {
    get(t, k) {
      if (k === "moveTo")
        return (x: number, y: number) => {
          start = { x, y };
        };
      if (k === "fill") return () => paths.push({ ...start, fill: t.fillStyle });
      if (k === "fillText") return (s: string, x: number, y: number) => texts.push({ s, x, y, fill: t.fillStyle });
      if (k === "fillRect")
        return (x: number, y: number, w: number, h: number) => boxes.push({ x, y, w, h, fill: t.fillStyle });
      if (k === "measureText") return (s: string) => ({ width: s.length * 6 });
      if (k in t) return t[k];
      // every other drawing call (paths, transforms, gradients) is a no-op that returns the stand-in
      return () => ctx;
    },
    set(t, k, v) {
      t[k] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, texts, boxes, paths };
};
