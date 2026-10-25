"use client";
import { ComponentIntro } from "../ComponentIntro";
/**
 * The propeller governor page: the governor cut away with its propeller hub, a readout over the view, and a panel with
 * the controls, the hub, failures, a chart of rpm and blade angle, the forces on the pilot valve and the documents.
 */
import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import {
  BtnRow,
  Check,
  Facts,
  H3,
  Notes,
  Readouts,
  ScenarioButton,
  Seg,
  Slider,
  Small,
} from "@/components/ui/controls";
import { f0 } from "@/lib/format";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import {
  HIST_S,
  setRpm,
  type Controls,
  type Failures,
  type GovState,
  type Hub,
} from "@/engines/components/governor/model";
import { AMT } from "@/engines/components/governor/spec";
import { IO390 } from "@/engines/io390/spec";
import { ComponentShell } from "../ComponentShell";
import { ViewToggles } from "../chrome";
import { s, spec, useGov, useGovLoop, useGovView } from "./store";
import "./governor.css";

const Scene = dynamic(() => import("./GovernorScene"), { ssr: false, loading: () => <div /> });

const MODE: Record<GovState["mode"], string> = { under: "Underspeed", on: "On speed", over: "Overspeed" };

const leverFor = (rpm: number) =>
  (rpm - spec.propeller.governorMinRpm) / (spec.engine.ratedRpm - spec.propeller.governorMinRpm);

/** Quick set-ups: they set the controls; the governor gets there on its own. */
const TRY: { label: string; c: Controls; note: string }[] = [
  {
    label: "Take-off",
    c: { lever: 1, throttle: 1, kt: 0 },
    note: "Full throttle and high rpm standing still: the blades come off the low-pitch stop as the engine reaches 2,700 rpm, and the governor holds it as speed builds (raise the airspeed).",
  },
  {
    label: "Cruise",
    c: { lever: leverFor(2450), throttle: 0.8, kt: 140 },
    note: "2,450 rpm, the IO-390's 75 % cruise speed (IOM Table A-1). Change the throttle or airspeed: the rpm barely moves while the blade angle does.",
  },
  {
    label: "Dive",
    c: { lever: leverFor(2450), throttle: 0.8, kt: 175 },
    note: "More airspeed unloads the propeller: an overspeed. The flyweights fly out, the valve rises and the blades go to a higher angle until the engine is back on speed.",
  },
  {
    label: "Climb",
    c: { lever: 1, throttle: 1, kt: 90 },
    note: "Slower, the propeller loads the engine: an underspeed. The speeder spring pushes the valve down and the blades go to a lower angle.",
  },
  {
    label: "Approach",
    c: { lever: 1, throttle: 0.15, kt: 90 },
    note: "Low power with the propeller control forward: the governor can't hold 2,700 rpm, so the blades sit on the low-pitch stop and the governor stays underspeed until power comes up.",
  },
];

function Monitor() {
  const x = useLiveSnapshot(s, 100);
  const over = x.rpm > spec.engine.ratedRpm + 30;
  return (
    <div className="eng-mon gov-mon" aria-live="off">
      <div className="mon-big">
        <div>
          <span>RPM</span>
          <b className={over ? "bad" : ""}>{f0(x.rpm)}</b>
          <i>set {f0(x.setRpm)}</i>
        </div>
        <div>
          <span>Blade</span>
          <b>{x.beta.toFixed(1)}</b>
          <i>°</i>
        </div>
      </div>
      <div className={`gov-mode gov-${x.mode}`}>{MODE[x.mode]}</div>
      <div className="mon-small">
        <div>
          <span>Pump psi</span>
          <b>{f0(x.pumpPsi)}</b>
        </div>
        <div>
          <span>Hub psi</span>
          <b>{f0(x.hubPsi)}</b>
        </div>
        <div>
          <span>Valve mm</span>
          <b>{(x.x >= 0 ? "+" : "") + x.x.toFixed(2)}</b>
        </div>
        <div>
          <span>hp</span>
          <b>{f0(x.engineHp)}</b>
        </div>
      </div>
    </div>
  );
}

function Try() {
  const set = useGov((x) => x.setControls);
  const c = useGov((x) => x.controls);
  const match = TRY.find((t) => (Object.keys(t.c) as (keyof Controls)[]).every((k) => Math.abs(t.c[k] - c[k]) < 1e-6));
  return (
    <>
      <H3>Try</H3>
      <BtnRow>
        {TRY.map((t) => (
          <ScenarioButton key={t.label} onClick={() => set(t.c)}>
            {t.label}
          </ScenarioButton>
        ))}
      </BtnRow>
      {match && <Small>{match.note}</Small>}
    </>
  );
}

function ControlsPanel() {
  const c = useGov((x) => x.controls),
    set = useGov((x) => x.setControls);
  return (
    <>
      <H3>Controls</H3>
      <Slider
        id="gov-lever"
        label="Propeller control (speeder spring)"
        min={0}
        max={1}
        step={0.01}
        value={c.lever}
        onChange={(v) => set({ lever: v })}
        fmt={(v) => `${f0(setRpm(spec, v))} rpm`}
      />
      <Slider
        id="gov-throttle"
        label="Throttle"
        min={0}
        max={1}
        step={0.01}
        value={c.throttle}
        onChange={(v) => set({ throttle: v })}
        fmt={(v) => `${Math.round(v * 100)} %`}
      />
      <Slider
        id="gov-kt"
        label="True airspeed"
        min={0}
        max={190}
        step={1}
        value={c.kt}
        onChange={(v) => set({ kt: v })}
        fmt={(v) => `${v} kt`}
      />
      <Small>
        The propeller control sets {f0(spec.propeller.governorMinRpm)}–{f0(spec.engine.ratedRpm)} rpm, the IO-390
        simulation&apos;s governing range (the low end is a model constant).
      </Small>
    </>
  );
}

function HubPanel() {
  const hub = useGov((x) => x.hub),
    setHub = useGov((x) => x.setHub);
  const opts: [Hub, string][] = [
    ["high", "Oil to high pitch"],
    ["low", "Counterweighted"],
  ];
  return (
    <>
      <H3>Propeller hub</H3>
      <Seg id="gov-hub" label="Hub" options={opts} value={hub} onChange={setHub} />
      <Small>
        {hub === "high"
          ? "The SR20's Hartzell hub: governor oil drives the blades to high pitch; the spring and the blades' centrifugal twisting moment return them to low pitch as it drains (SR20 AMM 61-10 p. 1). The governor sends oil on an overspeed. Without oil the blades go to low pitch: high rpm."
          : `Counterweights turn the blades to high pitch and governor oil drives them to low pitch, the arrangement ${AMT} describes (pp. 7-9 to 7-11). The governor sends oil on an underspeed. Without oil the blades go to high pitch: low rpm.`}
      </Small>
    </>
  );
}

function FailuresPanel() {
  const f = useGov((x) => x.failures),
    set = useGov((x) => x.setFailures);
  const items: [keyof Failures, string][] = [
    ["oilLoss", "Engine oil supply lost"],
    ["wornPump", "Governor pump worn"],
    ["stickyValve", "Pilot valve sticking"],
    ["brokenSpring", "Speeder spring broken"],
    ["reliefStuck", "Relief valve stuck open"],
  ];
  return (
    <>
      <H3>Failures</H3>
      <div className="gov-fails">
        {items.map(([k, t]) => (
          <Check key={k} id={`gov-f-${k}`} label={t} checked={f[k]} onChange={(v) => set({ [k]: v })} />
        ))}
      </div>
      <Small>
        Failures are illustrations of the mechanism, not taken from a maintenance manual&apos;s troubleshooting tables.
      </Small>
    </>
  );
}

const W = 330,
  H = 150,
  PAD = { l: 38, r: 34, t: 10, b: 20 };

/** RPM and set rpm (left axis) and blade angle (right axis) over the last 30 s. */
function Chart() {
  const x = useLiveSnapshot(s, 150);
  const h = x.hist;
  const t1 = h.t.length ? h.t[h.t.length - 1] : 0;
  const lo = Math.min(1800, ...h.rpm),
    hi = Math.max(2900, ...h.rpm);
  const rLo = Math.floor(lo / 200) * 200,
    rHi = Math.ceil(hi / 200) * 200;
  const px = (t: number) => PAD.l + (1 - (t1 - t) / HIST_S) * (W - PAD.l - PAD.r);
  const py = (r: number) => H - PAD.b - ((r - rLo) / (rHi - rLo)) * (H - PAD.t - PAD.b);
  const by = (b: number) => H - PAD.b - ((b - 0) / 50) * (H - PAD.t - PAD.b);
  const path = (ys: number[], f: (v: number) => number) =>
    ys.map((v, i) => `${i ? "L" : "M"}${px(h.t[i]).toFixed(1)},${f(v).toFixed(1)}`).join("");
  const ticks = [rLo, (rLo + rHi) / 2, rHi];
  return (
    <>
      <H3>Last {HIST_S} seconds</H3>
      <svg
        className="eng-chart gov-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Rpm and blade angle over time"
      >
        {ticks.map((r) => (
          <g key={r}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py(r)} y2={py(r)} className="grid" />
            <text x={PAD.l - 4} y={py(r) + 4} textAnchor="end">
              {f0(r)}
            </text>
          </g>
        ))}
        {[0, 25, 50].map((b) => (
          <text key={b} x={W - PAD.r + 4} y={by(b) + 4} className="gov-beta-axis">
            {b}°
          </text>
        ))}
        <path d={path(h.set, py)} className="gov-set" />
        <path d={path(h.beta, by)} className="gov-beta" />
        <path d={path(h.rpm, py)} className="trace" />
        <text x={PAD.l} y={H - 5}>
          −{HIST_S} s
        </text>
        <text x={W - PAD.r} y={H - 5} textAnchor="end">
          now
        </text>
      </svg>
      <div className="gov-key">
        <span>
          <i className="k-rpm" /> rpm
        </span>
        <span>
          <i className="k-set" /> set rpm
        </span>
        <span>
          <i className="k-beta" /> blade angle
        </span>
      </div>
    </>
  );
}

function Balance() {
  const x = useLiveSnapshot(s, 150);
  const port = x.port;
  const flow =
    Math.abs(x.flow) < 0.004
      ? "none (leakage only)"
      : `${x.flow > 0 ? "into" : "out of"} the hub, ${Math.abs(x.flow * 100).toFixed(0)} % of a stroke per second`;
  const items: [string, string | [string, "" | "bad" | "warnc"]][] = [
    ["Flyweights (lift)", `${x.flyweightN.toFixed(1)} N`],
    ["Speeder spring (push)", `${x.springN.toFixed(1)} N`],
    ["Pilot valve", `${(x.x >= 0 ? "+" : "") + x.x.toFixed(2)} mm, ${MODE[x.mode].toLowerCase()}`],
    [
      "Metering port",
      Math.abs(port) < 0.01
        ? "covered"
        : `${Math.round(Math.abs(port) * 100)} % open to ${port > 0 ? "pump" : "drain"}`,
    ],
    ["Oil", flow],
    ["Engine oil in", `${f0(x.inletPsi)} psi`],
    [
      "Governor pump",
      x.pumpPsi < 1
        ? ["no pressure", "bad"]
        : `${f0(x.pumpPsi)} psi${x.relief ? ", relief valve open" : ", all to the hub"}`,
    ],
    ["Hub cylinder", `${f0(x.hubPsi)} psi`],
    ["Engine", `${f0(x.engineHp)} hp at ${f0(x.rpm)} rpm`],
  ];
  return (
    <>
      <H3>Inside the governor</H3>
      <Readouts items={items} />
    </>
  );
}

function Docs() {
  const facts: [ReactNode, ReactNode][] = [
    ["Pump pressure", `approximately ${spec.handbook.boostPsi.value} psi (${spec.handbook.boostPsi.src})`],
    [
      "Relief valve",
      `set ${spec.handbook.reliefPsi.value} psi in the typical governor (${spec.handbook.reliefPsi.src})`,
    ],
    ["Drive", `${spec.engine.driveRatio} × crankshaft, IO-390-C front governor (IOM Table A-4)`],
    ["Engine", `${spec.engine.name}, ${spec.engine.ratedHp} hp at ${f0(spec.engine.ratedRpm)} rpm (IOM Table A-1)`],
    [
      "Oil supply",
      `${spec.engine.oilPsi.min}–${spec.engine.oilPsi.max} psi engine oil pressure, normal (IOM Table A-2)`,
    ],
    ["Propeller", `${spec.propeller.name}, ${spec.propeller.blades} blades, ${spec.propeller.diameterIn} in`],
  ];
  const iom = IO390.sources.find((x) => x.href);
  return (
    <>
      <H3>Documented numbers</H3>
      <Facts rows={facts} />
      <H3>How the model works</H3>
      <Notes
        items={[
          "The flyweights' lift grows with the square of speed; the speeder spring's push grows with its compression. The propeller control sets the compression, and with it the speed at which the two balance with the pilot valve centred.",
          "Off centre, the valve opens the metering port to the pump's boosted oil or to drain, and the hub's piston moves at the rate oil flows through it. On speed the valve sits a hair off centre, metering the trickle that makes up the hub's leakage.",
          "The engine is a torque source set by the throttle (rated torque at full throttle); the propeller's load comes from the IO-390 simulation's propeller model. Neither is Lycoming or Hartzell data.",
          "Not published, so chosen to make the governor behave as the handbook describes: the forces, spring rate, valve travel and port size, pump flow, leakage, the blades' return force, and the pitch range. Sizes and shapes in the 3D view are schematic.",
        ]}
      />
      <H3>Sources</H3>
      <ul className="notes">
        <li>
          <a
            href="https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/amt_powerplant_handbook.pdf"
            target="_blank"
            rel="noreferrer"
          >
            FAA-H-8083-32B, Aviation Maintenance Technician Handbook – Powerplant
          </a>
          , chapter 7: the governor&apos;s parts and its under-, on- and overspeed conditions (pp. 7-8 to 7-12, Figures
          7-15 to 7-19), pump and relief pressures, and the non-feathering hub (Figure 7-24).
        </li>
        <li>
          {iom ? (
            <a href={iom.href} target="_blank" rel="noreferrer">
              {iom.title}
            </a>
          ) : (
            "Lycoming IO-390-C Installation and Operation Manual"
          )}
          : rated power and rpm, governor drive ratio, oil pressure.
        </li>
        <li>
          Cirrus SR20 POH and AMM 61-10, as cited in the SR20 model: the Hartzell propeller and its oil-to-high-pitch
          hub.
        </li>
      </ul>
    </>
  );
}

function Panel() {
  return (
    <div className="panel-inner">
      <ComponentIntro source={AMT}>
        <p className="lead">{spec.lead}</p>
      </ComponentIntro>
      <Try />
      <ControlsPanel />
      <Chart />
      <Balance />
      <HubPanel />
      <FailuresPanel />
      <Docs />
    </div>
  );
}

const TOGGLES = [
  ["xray", "X-ray", "See through the governor body, the engine and the hub"],
  ["labels", "Labels", "Name the main parts"],
  ["slow", "Slow motion", "Turn the drawn shafts slowly (the simulation runs at full speed)"],
  ["paused", "Pause", "Freeze the simulation"],
] as const;

export default function GovernorApp() {
  useGovLoop();
  const view = useGovView();
  return (
    <ComponentShell
      id={spec.id}
      scene={<Scene />}
      toolbar={<ViewToggles items={TOGGLES} view={view} set={view.set} />}
      foot={<Monitor />}
      panel={<Panel />}
    />
  );
}
