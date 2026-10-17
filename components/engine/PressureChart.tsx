"use client";
/**
 * Cylinder pressure for the selected cylinder, against crank angle (firing top centre in the middle) and against
 * volume (the indicator diagram, whose loop area is the work per cycle). Drawn from `pressureTrace` with the model's
 * own gross work, so it follows throttle, mixture and plugs.
 */
import { pressureTrace, phaseOf, sparkBTC } from "@/engines/model/cycle";
import { H3, Seg, Small } from "@/components/ui/controls";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { HP_W } from "@/engines/model/atmosphere";
import type { EngineState } from "@/engines/model/engine";
import type { EngineSpec } from "@/engines/types";
import type { EngineSim } from "./store";

const W = 330,
  H = 170,
  PAD = { l: 34, r: 8, t: 10, b: 22 };

/**
 * The pressures at the two ends of the trace: manifold pressure on intake (inlet pressure while stopped) and the
 * exhaust back pressure. A turbocharged engine exhausts into its turbine inlet (`turbineInletInHg`); otherwise the
 * exhaust is taken as just above the inlet pressure.
 */
export const chartInputs = (spec: EngineSpec, s: EngineState) => ({
  map: s.rpm > 30 ? s.map : s.inletInHg,
  exhaust: spec.turbo ? s.turbineInletInHg! : s.inletInHg * 1.02,
});

// The caption's words for a spec that cites no source for its timing: the page's text as it was.
const DEFAULT_CAPTION = {
  advanceSrc: "IOM Table A-1",
  startNote: "an assumed angle: the IOM does not give one",
  maker: "Lycoming",
};

/**
 * The caption under the charts, in two parts (the spark sentence, then the note on the trace) as the page lays them
 * out. A spec that cites its spark timing (`ignition.advanceSrc`) gets that source, its own start ignition and its
 * manufacturer's name; any other keeps the caption as it was, word for word.
 */
export function captionParts(
  spec: EngineSpec,
  t: { firing: boolean; mags: string; advance: number; peakPsi: number; peakAtdc: number },
): [string, string] {
  const src = spec.ignition.advanceSrc;
  const words = src ? { advanceSrc: src, startNote: "", maker: spec.model.split(" ")[0] } : DEFAULT_CAPTION;
  const spark =
    t.mags !== "START"
      ? `spark at ${t.advance}° before (${words.advanceSrc}). `
      : src && spec.ignition.startMags === "both"
        ? "both magnetos fire at top centre for the start (impulse couplings). "
        : `spark retarded to ${-t.advance}° after top centre for the start${words.startNote ? ` (${words.startNote})` : ""}. `;
  return [
    t.firing
      ? `Peak ${Math.round(t.peakPsi)} psia at ${Math.round(t.peakAtdc)}° after top centre, ${spark}`
      : "Not firing: the trace is compression and expansion of the charge alone. ",
    `The trace is the model's work per cycle drawn as pressure, with an assumed burn duration; it is not measured ${words.maker} data.`,
  ];
}

/** The caption as one string. */
export const chartCaption = (...a: Parameters<typeof captionParts>) => captionParts(...a).join("");

export function PressureChart({ sim }: { sim: EngineSim }) {
  const s = useLiveSnapshot(sim.s, 200);
  // the cursor follows the drawn crank, which slow motion turns slower than the engine
  const anim = useLiveSnapshot(sim.anim, 100);
  const sel = sim.useUi((x) => x.view.cyl),
    setView = sim.useUi((x) => x.setView);
  const mags = sim.useUi((x) => x.controls.mags);
  const spec = sim.spec;
  const advance = sparkBTC(spec, mags);
  const cyl = s.cyl[sel],
    def = spec.geometry.cylinders[sel];
  const firing = s.rpm > 30 && cyl.work > 0.02;
  const work = firing ? (cyl.hp * HP_W * 120) / Math.max(s.rpm, 1) : 0;
  const t = pressureTrace(spec, {
    ...chartInputs(spec, s),
    grossWork: work,
    advance,
    // one flame front burns slower (model assumption, see the notes)
    burnDeg: cyl.plugs >= 2 ? 55 : 70,
    firing,
  });
  // firing top centre in the middle: −360 … 360
  const pts = t.phase.map((p, i) => [p >= 360 ? p - 720 : p, t.psi[i]] as const).sort((a, b) => a[0] - b[0]);
  const top = Math.max(100, Math.ceil(t.peakPsi / 100) * 100);
  const x = (deg: number) => PAD.l + ((deg + 360) / 720) * (W - PAD.l - PAD.r);
  const y = (p: number) => H - PAD.b - (p / top) * (H - PAD.t - PAD.b);
  const path = pts.map(([d, p], i) => `${i ? "L" : "M"}${x(d).toFixed(1)},${y(p).toFixed(1)}`).join("");
  const vx = (v: number) => PAD.l + v * (W - PAD.l - PAD.r);
  const loop = t.vol.map((v, i) => `${i ? "L" : "M"}${vx(v).toFixed(1)},${y(t.psi[i]).toFixed(1)}`).join("") + "Z";
  const now = phaseOf(spec, def.n, anim.crank);
  const nowX = x(now >= 360 ? now - 720 : now);
  const ticks = [0, top / 2, top];
  return (
    <>
      <H3>Cylinder pressure</H3>
      <Seg
        id="pcyl"
        label="Cylinder"
        options={spec.geometry.cylinders.map((c, i): [number, string] => [i, String(c.n)])}
        value={sel}
        onChange={(v) => setView({ cyl: v })}
      />
      <svg
        className="eng-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Cylinder pressure against crank angle"
      >
        {ticks.map((p) => (
          <g key={p}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(p)} y2={y(p)} className="grid" />
            <text x={PAD.l - 4} y={y(p) + 4} textAnchor="end">
              {p}
            </text>
          </g>
        ))}
        {[-360, -180, 0, 180, 360].map((d) => (
          <text key={d} x={x(d)} y={H - 6} textAnchor="middle">
            {d === 0 ? "TC" : d === 360 || d === -360 ? "TC" : "BC"}
          </text>
        ))}
        <line x1={x(-advance)} x2={x(-advance)} y1={PAD.t} y2={H - PAD.b} className="spark" />
        <path d={path} className="trace" />
        <line x1={nowX} x2={nowX} y1={PAD.t} y2={H - PAD.b} className="now" />
        <text x={x(-270)} y={PAD.t + 10} textAnchor="middle" className="stroke">
          exhaust · intake
        </text>
        <text x={x(-90)} y={PAD.t + 10} textAnchor="middle" className="stroke">
          compression
        </text>
        <text x={x(90)} y={PAD.t + 10} textAnchor="middle" className="stroke">
          power
        </text>
        <text x={x(270)} y={PAD.t + 10} textAnchor="middle" className="stroke">
          exhaust · intake
        </text>
      </svg>
      <svg className="eng-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cylinder pressure against volume">
        {ticks.map((p) => (
          <g key={p}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(p)} y2={y(p)} className="grid" />
            <text x={PAD.l - 4} y={y(p) + 4} textAnchor="end">
              {p}
            </text>
          </g>
        ))}
        <text x={vx(1 / spec.geometry.compressionRatio)} y={H - 6} textAnchor="middle">
          TC
        </text>
        <text x={vx(1)} y={H - 6} textAnchor="end">
          BC volume
        </text>
        <path d={loop} className="trace" />
      </svg>
      <Small>{captionParts(spec, { firing, mags, advance, peakPsi: t.peakPsi, peakAtdc: t.peakAtdc })}</Small>
    </>
  );
}
