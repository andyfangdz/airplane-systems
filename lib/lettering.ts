/** Deterministic paint lettering; photo-fit outlines, not an identification of the original fonts. */
import sans from "./lettering/sans-glyphs.json";

export type LetteringStyle = "rounded-oblique" | "block-oblique" | "block-upright" | "wordmark";
type Glyph = { path: string; advance: number; bounds: number[] };

// Cessna registrations have chamfered corners, an unfooted 1 and a short Q tail.
// Coordinates use a 100-unit cap height. Counters are separate even-odd contours.
const zero = "12,0 54,0 66,12 66,88 54,100 12,100 0,88 0,12|15,19 19,15 47,15 51,19 51,81 47,85 19,85 15,81";
const block: Record<string, string> = {
  N: "0,100 0,0 15,0 51,71 51,0 66,0 66,100 51,100 15,29 15,100",
  "0": zero,
  "1": "8,16 24,0 39,0 39,100 24,100 24,20 8,32",
  "5": "0,0 66,0 66,15 15,15 15,41 54,41 66,53 66,88 54,100 12,100 0,88 0,74 15,74 15,81 19,85 47,85 51,81 51,60 47,56 0,56",
  "6": "12,0 54,0 66,12 66,25 51,25 51,19 47,15 19,15 15,19 15,41 54,41 66,53 66,88 54,100 12,100 0,88 0,12|15,60 19,56 47,56 51,60 51,81 47,85 19,85 15,81",
  "8": "12,0 54,0 66,12 66,39 57,48 66,57 66,88 54,100 12,100 0,88 0,57 9,48 0,39 0,12|15,19 19,15 47,15 51,19 51,37 47,41 19,41 15,37|15,60 19,56 47,56 51,60 51,81 47,85 19,85 15,81",
  "9": "12,0 54,0 66,12 66,88 54,100 12,100 0,88 0,75 15,75 15,81 19,85 47,85 51,81 51,59 12,59 0,47 0,12|15,19 19,15 47,15 51,19 51,40 47,44 19,44 15,40",
  Q: "12,0 54,0 66,12 66,85 60,91 68,100 56,108 49,100 12,100 0,88 0,12|15,19 19,15 47,15 51,19 51,80 40,68 29,77 36,85 19,85 15,81",
  J: "51,0 66,0 66,88 54,100 12,100 0,88 0,70 15,70 15,81 19,85 47,85 51,81",
};

function blockGlyph(char: string, slant: number): Glyph | undefined {
  const outline = block[char];
  if (!outline) return;
  const contours = outline.split("|").map((contour) =>
    contour.split(" ").map((point) => {
      const [x, y] = point.split(",").map(Number);
      return [x + slant * (100 - y), y];
    }),
  );
  const points = contours.flat();
  return {
    path: contours.map((p) => `M${p.map(([x, y]) => `${x},${y}`).join("L")}Z`).join(""),
    advance: char === "1" ? 51 : 78,
    bounds: [
      Math.min(...points.map((p) => p[0])),
      Math.min(...points.map((p) => p[1])),
      Math.max(...points.map((p) => p[0])),
      Math.max(...points.map((p) => p[1])),
    ],
  };
}

/** Fit the actual ink bounds, including italic overhangs, rather than font advance widths. */
export function layoutLettering(text: string, style: LetteringStyle, tracking = 0) {
  let cursor = 0;
  const glyphs: (Glyph & { x: number })[] = [];
  for (const char of text) {
    const glyph = style.startsWith("block-")
      ? blockGlyph(char, style === "block-oblique" ? 0.24 : 0)
      : (sans[style === "wordmark" ? "wordmark" : "rounded"] as Record<string, Glyph>)[char];
    if (!glyph) throw new Error(`Missing ${style} paint glyph: ${char}`);
    if (glyph.path) glyphs.push({ ...glyph, x: cursor });
    cursor += glyph.advance + tracking;
  }
  if (!glyphs.length) throw new Error("Paint lettering must contain visible glyphs");
  const x0 = Math.min(...glyphs.map((g) => g.x + g.bounds[0]));
  const y0 = Math.min(...glyphs.map((g) => g.bounds[1]));
  const x1 = Math.max(...glyphs.map((g) => g.x + g.bounds[2]));
  const y1 = Math.max(...glyphs.map((g) => g.bounds[3]));
  return { glyphs, x0, y0, width: x1 - x0, height: y1 - y0 };
}

export function drawLettering(
  g: CanvasRenderingContext2D,
  layout: ReturnType<typeof layoutLettering>,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  g.save();
  g.translate(x, y);
  g.scale(w / layout.width, h / layout.height);
  g.translate(-layout.x0, -layout.y0);
  for (const glyph of layout.glyphs) {
    g.save();
    g.translate(glyph.x, 0);
    g.fill(new Path2D(glyph.path), "evenodd");
    g.restore();
  }
  g.restore();
}
