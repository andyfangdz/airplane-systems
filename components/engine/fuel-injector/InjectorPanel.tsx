"use client";
import { ComponentIntro } from "../ComponentIntro";
/**
 * The fuel injection page's panel: the engine's controls (it runs on the IO-390), what each part of the injector is
 * doing, the nozzle-pressure chart with the gauge's reading on it, fuel-system failures, and the documents.
 */
import { AVGAS_LB_GAL } from "@/engines/model/atmosphere";
import { Check, Facts, H3, Notes, Readouts, Small } from "@/components/ui/controls";
import { Controls, Environment, StartFrom } from "../EnginePanel";
import type { EngineSim } from "../store";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import {
  DIVIDER_FULL_LBH,
  injectorView,
  NOZZLE_LIMITS,
  type InjectorView,
} from "@/engines/components/fuel-injector/model";
import { PRESSURE } from "./colors";

const LEAD =
  "RSA-type continuous-flow fuel injection on the Lycoming IO-390-C: a servo fuel " +
  "injector that meters fuel against the air flowing through its throttle body, a flow divider that keeps the metered " +
  "fuel under pressure and splits it four ways, and an air-bleed nozzle in each cylinder head. It runs on the IO-390 " +
  "engine simulation, so the fuel flows and nozzle pressures are the engine's own. The IOM lists AVStar RSA-10AD1/-10AD2; " +
  "the cutaway explains the RSA operating principle using FAA and Precision training diagrams.";

const pct = (v: number) => `${Math.round(v * 100)} %`;
const forcePct = (v: number) => `${(100 * v).toFixed(2)} %`;
const f1 = (v: number) => v.toFixed(1);
const gph = (lbh: number) => `${(lbh / AVGAS_LB_GAL).toFixed(1)} gph`;

/** The injector's state at a low rate, for React. */
function useInjector(sim: EngineSim): InjectorView {
  const s = useLiveSnapshot(sim.s, 200);
  const c = sim.useUi((x) => x.controls),
    f = sim.useUi((x) => x.failures);
  return injectorView(sim.spec, s, c, f);
}

const dividerState = (v: InjectorView) =>
  v.divider === 0 ? "shut" : v.metered < DIVIDER_FULL_LBH ? "dividing" : "open";

function Injector({ sim }: { sim: EngineSim }) {
  const v = useInjector(sim);
  const off = v.indicated - v.metered;
  return (
    <>
      <H3>Inside the injector</H3>
      <Readouts
        items={[
          ["Air through throttle body", `${Math.round(v.air)} lb/h`],
          ["Air metering force", forcePct(v.airForce)],
          ["Fuel metering force", forcePct(v.fuelForce)],
          ["Idle spring force", forcePct(v.springForce)],
          ["Ball valve", v.metered > 0 ? pct(v.ball) : "shut"],
          ["Mixture plate", v.cutoff ? "idle cut-off" : v.mixture > 0.995 ? "full rich" : pct(v.mixture)],
          ["Injector inlet", `${f1(v.inletPsi)} psi`],
          ["Metered fuel", `${f1(v.metered)} lb/h`],
          ["Nozzles pass", gph(v.metered)],
          ["Fuel–air ratio", v.far > 0 ? v.far.toFixed(3) : "–"],
          ["Flow divider", dividerState(v)],
          ["Nozzle pressure", `${f1(v.nozzlePsi)} psig`],
          [
            "Gauge reads",
            Math.abs(off) > 1.5 ? [`${gph(v.indicated)} (${off > 0 ? "high" : "low"})`, "warnc"] : gph(v.indicated),
          ],
        ]}
      />
      <Small>
        Forces are relative to rated air flow at sea level (100 %); no pressure inside the injector is published. The
        two balance while supply pressure is sufficient. The idle spring supplements the air force near idle and is
        taken up above that range (Precision Form 15-812B, p. 13). Fuel force is inferred from delivered flow; limited
        supply may prevent balance. The flow divider is &quot;dividing&quot; while its valve is only partly open, as at
        idle, and &quot;open&quot; once the flow opens it fully and the nozzles set the split.
      </Small>
    </>
  );
}

function Nozzles({ sim }: { sim: EngineSim }) {
  const v = useInjector(sim);
  const f = sim.useUi((x) => x.failures),
    set = sim.useUi((x) => x.setFailures);
  return (
    <>
      <H3>Nozzles</H3>
      <table className="eng-table eng-fail">
        <thead>
          <tr>
            <th>Cyl</th>
            <th>lb/h</th>
            <th>gph</th>
            <th>Blocked</th>
            <th>Intake leak</th>
          </tr>
        </thead>
        <tbody>
          {sim.spec.geometry.cylinders.map((c, i) => (
            <tr key={c.n}>
              <td>{c.n}</td>
              <td>{f1(v.nozzles[i])}</td>
              <td>{(v.nozzles[i] / AVGAS_LB_GAL).toFixed(2)}</td>
              <td>
                <input
                  type="range"
                  min={0}
                  max={0.9}
                  step={0.05}
                  aria-label={`Cylinder ${c.n} nozzle blockage`}
                  value={f.nozzle[i]}
                  onChange={(e) => set({ nozzle: f.nozzle.map((x, j) => (j === i ? +e.target.value : x)) })}
                />
                <output>{pct(f.nozzle[i])}</output>
              </td>
              <td>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  aria-label={`Cylinder ${c.n} intake pipe leak`}
                  value={f.intakeLeak[i]}
                  onChange={(e) => set({ intakeLeak: f.intakeLeak.map((x, j) => (j === i ? +e.target.value : x)) })}
                />
                <output>{pct(f.intakeLeak[i])}</output>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="eng-checks">
        <Check
          id="f-pump"
          label="Engine-driven fuel pump failed"
          checked={f.fuelPump}
          onChange={(x) => set({ fuelPump: x })}
        />
      </div>
      <Small>
        A blocked nozzle starves its own cylinder and raises the pressure every nozzle sees, so a pressure-type gauge
        reads high while the engine loses power and runs rough: the first entry in Precision&apos;s troubleshooting
        chart. A leaking intake pipe adds air the injector never measured, leaning that cylinder.
      </Small>
    </>
  );
}

/** IOM Figure C-2 redrawn: nominal flow with its limits, the actual operating point and what the gauge shows. */
function NozzleChart({ sim }: { sim: EngineSim }) {
  const v = useInjector(sim);
  const nominal = sim.spec.fuelSystem.kind === "injected" ? sim.spec.fuelSystem.nozzle.points : [];
  const W = 320,
    H = 200,
    L = 34,
    B = 26,
    T = 8,
    R = 8;
  const x = (psi: number) => L + (psi / 12) * (W - L - R);
  const y = (lbh: number) => H - B - (lbh / 120) * (H - B - T);
  const path = (pts: [number, number][]) => pts.map(([p, f], k) => `${k ? "L" : "M"}${x(p)},${y(f)}`).join("");
  // past the printed chart (a badly blocked nozzle) the points stay on its edge and say so
  const off = v.nozzlePsi > 12 || v.indicated > 120 || v.metered > 120;
  const px = x(Math.min(v.nozzlePsi, 12)),
    yy = (lbh: number) => y(Math.min(lbh, 120)),
    on = v.metered > 0.5;
  return (
    <>
      <H3>Fuel flow against nozzle pressure</H3>
      <svg className="inj-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Fuel flow against nozzle pressure">
        {[0, 2, 4, 6, 8, 10, 12].map((p) => (
          <g key={p}>
            <line x1={x(p)} x2={x(p)} y1={T} y2={H - B} className="grid" />
            <text x={x(p)} y={H - B + 13} textAnchor="middle">
              {p}
            </text>
          </g>
        ))}
        {[0, 20, 40, 60, 80, 100, 120].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(f)} y2={y(f)} className="grid" />
            <text x={L - 4} y={y(f) + 3} textAnchor="end">
              {f}
            </text>
          </g>
        ))}
        <path d={path(NOZZLE_LIMITS.high)} className="lim" />
        <path d={path(NOZZLE_LIMITS.low)} className="lim" />
        <path d={path(nominal)} className="nom" />
        {on && (
          <>
            <line x1={px} x2={px} y1={yy(v.metered)} y2={yy(v.indicated)} className="gap" />
            <line x1={L} x2={px} y1={yy(v.indicated)} y2={yy(v.indicated)} className="gap" />
            <circle cx={px} cy={yy(v.indicated)} r={3.5} fill="none" stroke={PRESSURE.nozzle} strokeWidth={2} />
            <circle cx={px} cy={yy(v.metered)} r={4} fill={PRESSURE.metered} />
            {off && (
              <text x={px - 6} y={H - B - 6} textAnchor="end" className="off">
                off scale: {v.nozzlePsi.toFixed(1)} psig
              </text>
            )}
          </>
        )}
        <text x={W - R} y={H - 2} textAnchor="end">
          nozzle psig
        </text>
        <text x={L + 4} y={T + 10}>
          lb/h
        </text>
      </svg>
      <Small>
        Nominal flow with its high and low limits (IOM Figure C-2). The red dot is what the nozzles actually pass; the
        ring is what a pressure gauge on the flow divider shows: the nominal flow for that pressure. They part when a
        nozzle is blocked.
      </Small>
    </>
  );
}

function HowItWorks() {
  return (
    <>
      <H3>How it works</H3>
      <Notes
        items={[
          "Airflow section: impact tubes in the throttle body sense inlet air pressure and the venturi throat senses venturi suction. Piped to the two sides of the air diaphragm, their difference times its area is the air metering force: it grows with the air the engine takes (FAA-H-8083-32B pp. 2-21–2-22).",
          "Regulator: the fuel diaphragm sees unmetered fuel on one side and metered fuel on the other. The ball valve on its stem opens until this fuel metering force balances the air force, so the drop across the metering jet, and the fuel flow, follow the air flow. At low power a constant-head idle spring keeps a small fixed differential (p. 2-22).",
          "Fuel metering: strainer, then the manual mixture control's rotary plate (full rich at the stop, leaner towards idle cut-off), the main metering jet and the idle valve, which an adjustable link ties to the throttle (p. 2-23).",
          "Flow divider: keeps the metered fuel under pressure and splits it four ways. At idle its valve opens just enough to pass the flow, so it does the dividing; above idle it opens fully and the nozzles set the distribution. At idle cut-off it shuts every nozzle line (p. 2-23).",
          "Nozzles: one per cylinder, air-bleed type, each a calibrated jet discharging into a chamber at ambient pressure, where air helps atomize the fuel before the intake port. Pressure before the nozzles is in proportion to flow, so a pressure gauge serves as the flow meter (p. 2-24).",
          "The servo meters against air mass, so at a fixed mixture setting the fuel–air ratio rises as the air thins: climb with the mixture alone and watch it richen, then lean.",
        ]}
      />
    </>
  );
}

function Troubleshooting() {
  const rows: [string, string][] = [
    [
      "High fuel flow reading",
      "A plugged nozzle, if it comes with loss of power and roughness; or a faulty gauge. Remove and clean the nozzles and look for the contamination's source.",
    ],
    ["Low take-off fuel flow", "A faulty gauge, or a sticky flow divider (clean it)."],
    ["Poor cut-off", "Mixture control rigging; on turbocharged engines, clogged nozzle air bleeds."],
    [
      "Rough idle",
      "Small induction air leaks (loose intake pipes, damaged O-rings): idle adjusts but it is rough at 1,000–1,500 rpm. Large leaks keep the engine from throttling below 800–900 rpm.",
    ],
    [
      "Rough engine",
      "Mixture too rich or too lean (leaning helps a rich one, worsens a lean one; set the idle mixture for a 25–50 rpm rise at 700 rpm), or plugged nozzles with high take-off flow readings.",
    ],
  ];
  return (
    <>
      <H3>Troubleshooting</H3>
      <Facts rows={rows} />
      <Small>
        Precision Airmotive Form 15-901C, Installation Troubleshooting Chart, RS/RSA fuel injection systems.
      </Small>
    </>
  );
}

function Specs({ sim }: { sim: EngineSim }) {
  const L = [
    ["Injector", `${sim.spec.fuelSystem.unit} (IOM Table A-1)`],
    ["Boost pump at injector inlet", "14–45 psi parallel, 14–35 psi series (IOM Table A-2, p. 53)"],
    ["At the engine fuel pump inlet", "−2 to +35 psi (IOM Table A-2, p. 53)"],
    [
      "Nozzle curve",
      "IOM Figure C-2 (p. 58), printed for the RSA-5AD1 although Table A-1 lists the RSA-10AD1/-10AD2; measured with the gauge level with the nozzles and vented to the nozzles' ambient pressure",
    ],
    ["Cruise fuel", "75 %: 12.8 gph; 65 %: 9.8 gph (IOM Table A-1)"],
  ] as [string, string][];
  return (
    <>
      <H3>On the IO-390-C</H3>
      <Facts rows={L} />
    </>
  );
}

function Sources() {
  const items: [string, string, string][] = [
    [
      "Precision Airmotive Form 15-812B, RSA Fuel Injection System Training Manual",
      "https://precisionairmotive.com/wp-content/uploads/2019/06/15-812_b.pdf",
      "Regulator force balance (p. 5), idle spring take-up (p. 13), flow divider (pp. 7–8), nozzle air bleeds (p. 17).",
    ],
    [
      "FAA-H-8083-32B, Aviation Maintenance Technician Handbook – Powerplant, Chapter 2",
      "https://www.faa.gov/regulationspolicies/handbooksmanuals/aviation/faa-h-8083-32b-chapter-2-engine-fuel-fuel-metering",
      "Bendix/Precision fuel-injection system: airflow, regulator and metering sections, flow divider, nozzles (pp. 2-21–2-24, Figures 2-30 to 2-38).",
    ],
    [
      "Lycoming IO-390-C Series Installation and Operation Manual (January 2017)",
      "https://www.lycoming.com/sites/default/files/attachments/IOM-IO-390-C%2520Series%2520-%25201-31-17.pdf",
      "Fuel injection system (p. 4, Figure 7), Tables A-1 and A-2, Figure C-2 (nozzle pressure, p. 58).",
    ],
    [
      "Precision Airmotive Form 15-901C, Installation Troubleshooting Chart, RS/RSA Fuel Injection Systems (2002)",
      "https://pceonline.com/wp-content/uploads/2023/05/15-901_c-Precision-Airmotive-Troubleshooting.pdf",
      "Symptoms, causes and remedies.",
    ],
  ];
  return (
    <>
      <H3>Sources</H3>
      <ul className="notes">
        {items.map(([t, href, note]) => (
          <li key={t}>
            <a href={href} target="_blank" rel="noreferrer">
              {t}
            </a>
            . {note}
          </li>
        ))}
      </ul>
      <Small>
        The flows, pressures and their response to throttle, mixture and altitude come from the IO-390 engine simulation
        and its sources. Shapes, sizes and valve travels are drawn, not measured.
      </Small>
    </>
  );
}

export function InjectorPanel({ sim }: { sim: EngineSim }) {
  return (
    <div className="panel-inner">
      <ComponentIntro source="RSA-type injection on the Lycoming IO-390-C">
        <p className="lead">{LEAD}</p>
      </ComponentIntro>
      <StartFrom sim={sim} />
      <Controls sim={sim} />
      <Injector sim={sim} />
      <NozzleChart sim={sim} />
      <Nozzles sim={sim} />
      <Environment sim={sim} />
      <HowItWorks />
      <Troubleshooting />
      <Specs sim={sim} />
      <Sources />
    </div>
  );
}
