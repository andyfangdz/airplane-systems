import { afterEach, describe, expect, it, vi } from "vitest";
import * as instruments from "@/lib/avionics/g1000";
import { flightData, initFlight } from "@/lib/avionics/flight";
import { drawPanel } from "@/aircraft/m20c/displays";
import { initialSim as mooneySim, live as mooneyLive, solve as solveMooney } from "@/aircraft/m20c/model";
import { drawStbyAlt, drawStbyAsi, eisGauges, pfdData } from "@/aircraft/da40/displays";
import { initialSim as diamondSim, live as diamondLive, solve as solveDiamond } from "@/aircraft/da40/model";
import { patched } from "./helpers";

type Paint = { kind: "circle"; x: number; y: number; r: number } | { kind: "text"; text: string; x: number; y: number };
/** Records visible dial operations without depending on browser fonts or rasterization. */
function canvas() {
  const paints: Paint[] = [],
    vertices: number[][] = [];
  let circle: Extract<Paint, { kind: "circle" }> | null = null;
  const noop = () => {};
  const ctx = {
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    clip: noop,
    fillRect: noop,
    strokeRect: noop,
    stroke: noop,
    closePath: noop,
    beginPath: () => {
      circle = null;
    },
    arc: (x: number, y: number, r: number) => {
      circle = { kind: "circle", x, y, r };
    },
    fill: () => {
      if (circle) paints.push(circle);
    },
    moveTo: (x: number, y: number) => vertices.push([x, y]),
    lineTo: (x: number, y: number) => vertices.push([x, y]),
    fillText: (text: string, x: number, y: number) => paints.push({ kind: "text", text, x, y }),
    createLinearGradient: () => ({ addColorStop: noop }),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, paints, vertices };
}

const diamond0 = structuredClone(diamondLive);
afterEach(() => {
  Object.assign(diamondLive, structuredClone(diamond0));
  vi.restoreAllMocks();
});

describe("analog instrument indications", () => {
  it("a sensitive altimeter distinguishes 12,000 ft from 2,000 ft with its third hand", () => {
    const low = canvas(),
      high = canvas();
    instruments.drawAltimeterDial(low.ctx, 0, 0, 100, 2000, 29.92);
    instruments.drawAltimeterDial(high.ctx, 0, 0, 100, 12000, 29.92);
    expect(high.vertices).not.toEqual(low.vertices);
  });

  it("the M20C manifold-pressure markings remain visible after the combined gauge is painted (OM Part V)", () => {
    const c = canvas();
    drawPanel(c.ctx, 1024, 400, mooneySim, solveMooney(mooneySim));
    const index = c.paints.findIndex((p) => p.kind === "text" && p.text === "MAN PRESS");
    expect(index).toBeGreaterThan(-1);
    const label = c.paints[index];
    const covered = c.paints
      .slice(index + 1)
      .some((p) => p.kind === "circle" && Math.hypot(p.x - label.x, p.y - label.y) < p.r);
    expect(covered).toBe(false);
  });

  it("the M20C panel uses the same three-hand altimeter at high altitude", () => {
    const fs = mooneyLive.fs;
    try {
      const low = canvas(),
        high = canvas(),
        E = solveMooney(mooneySim);
      mooneyLive.fs = { ...fs, alt: 2000 };
      drawPanel(low.ctx, 1024, 400, mooneySim, E);
      mooneyLive.fs = { ...fs, alt: 12000 };
      drawPanel(high.ctx, 1024, 400, mooneySim, E);
      expect(high.vertices).not.toEqual(low.vertices);
    } finally {
      mooneyLive.fs = fs;
    }
  });
});

describe("DA40 display inputs", () => {
  it("alternate static affects the G1000 and both pneumatic standby instruments consistently", () => {
    diamondLive.fs = initFlight({ ias: 110, alt: 4500 });
    const s = patched(diamondSim, { pitot: { altStatic: true } });
    const E = solveDiamond(s);
    const asi = vi.spyOn(instruments, "drawStandbyAirspeed").mockImplementation(() => {});
    const alt = vi.spyOn(instruments, "drawStandbyAltimeter").mockImplementation(() => {});
    const f = pfdData(s, E).f;
    drawStbyAsi({} as CanvasRenderingContext2D, 100, 100, s);
    drawStbyAlt({} as CanvasRenderingContext2D, 100, 100, s);
    expect(f).toMatchObject({ ias: 113, alt: 4540 });
    expect(f.gs).toBe(flightData(diamondLive.fs).gs); // static pressure does not change GPS ground speed
    expect(asi.mock.calls[0][3]).toBe(f.ias);
    expect(alt.mock.calls[0][3]).toBe(f.alt);
    expect(diamondLive.fs).toMatchObject({ ias: 110, alt: 4500 });
  });

  it.each([14, 35])("fuel pressure at the %s psi green limit has no red warning (AFMS §2.5)", (pressure) => {
    diamondLive.fuelP = pressure;
    const gauge = eisGauges(diamondSim, solveDiamond(diamondSim)).find((g) => g.key === "fp");
    expect(gauge?.alert).toBeNull();
  });
});
