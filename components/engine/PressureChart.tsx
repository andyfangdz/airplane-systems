"use client";
/**
 * Cylinder pressure for the selected cylinder, against crank angle (firing top centre in the middle) and against
 * volume (the indicator diagram, whose loop area is the work per cycle). Drawn from `pressureTrace` with the model's
 * own gross work, so it follows throttle, mixture and plugs.
 */
import { pressureTrace, phaseOf } from "@/engines/model/cycle";
import { H3, Seg, Small } from "@/components/ui/controls";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { HP_W } from "@/engines/model/atmosphere";
import type { EngineSim } from "./store";

const W = 330,
  H = 170,
  PAD = { l: 34, r: 8, t: 10, b: 22 };

export function PressureChart({ sim }: { sim: EngineSim }) {
  const s = useLiveSnapshot(sim.s, 200);
  const sel = sim.useUi((x) => x.view.cyl),
    setView = sim.useUi((x) => x.setView);
  const spec = sim.spec;
  const cyl = s.cyl[sel],
    def = spec.geometry.cylinders[sel];
  const firing = s.rpm > 30 && cyl.work > 0.02;
  const work = firing ? (cyl.hp * HP_W * 120) / Math.max(s.rpm, 1) : 0;
  const t = pressureTrace(spec, {
    map: s.rpm > 30 ? s.map : s.inletInHg,
    exhaust: s.inletInHg * 1.02,
    grossWork: work,
    advance: spec.ignition.advanceBTC,
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
  const now = phaseOf(spec, def.n, s.crank);
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
        <line
          x1={x(-spec.ignition.advanceBTC)}
          x2={x(-spec.ignition.advanceBTC)}
          y1={PAD.t}
          y2={H - PAD.b}
          className="spark"
        />
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
      <Small>
        {firing
          ? `Peak ${Math.round(t.peakPsi)} psia at ${Math.round(t.peakAtdc)}° after top centre, spark at ${spec.ignition.advanceBTC}° before (IOM Table A-1). `
          : "Not firing: the trace is compression and expansion of the charge alone. "}
        The trace is the model&apos;s work per cycle drawn as pressure, with an assumed burn duration; it is not
        measured Lycoming data.
      </Small>
    </>
  );
}
