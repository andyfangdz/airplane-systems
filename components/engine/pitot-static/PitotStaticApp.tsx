"use client";
import { useEffect, useReducer } from "react";
import { ComponentShell } from "../ComponentShell";
import {
  blocked,
  defaults,
  environment,
  indications,
  initialState,
  scenarios,
  step,
  type Controls,
  type State,
} from "@/engines/components/pitot-static/model";
import "./pitot-static.css";

type Simulation = { c: Controls; s: State; paused: boolean; scenario: number };
type Action =
  | { type: "tick" }
  | { type: "control"; patch: Partial<Controls> }
  | { type: "scenario"; index: number }
  | { type: "pause" }
  | { type: "reset" };
const create = (): Simulation => ({ c: { ...defaults }, s: initialState(), paused: false, scenario: 0 });
function reducer(m: Simulation, a: Action): Simulation {
  switch (a.type) {
    case "tick":
      return m.paused ? m : { ...m, s: step(m.s, m.c, 0.05) };
    case "control":
      return { ...m, c: { ...m.c, ...a.patch } };
    case "pause":
      return { ...m, paused: !m.paused };
    case "reset":
      return create();
    case "scenario":
      return {
        ...m,
        scenario: a.index,
        s: { ...m.s, ice: 0 },
        c: {
          ...defaults,
          tas: m.c.tas,
          climb: m.c.climb,
          baro: m.c.baro,
          cabinDrop: m.c.cabinDrop,
          ...scenarios[a.index].patch,
        },
      };
  }
}
const toggles = [
  ["inletBlocked", "Pitot inlet obstructed"],
  ["drainBlocked", "Drain obstructed"],
  ["staticBlocked", "External static port blocked"],
  ["pitotLeak", "Pitot line leak to cabin"],
  ["staticLeak", "Static line leak to cabin"],
  ["icing", "Icing exposure"],
  ["heat", "Pitot heat switch ON"],
  ["heatFailed", "Pitot heater failed"],
] as const;

export default function PitotStaticApp() {
  const [m, dispatch] = useReducer(reducer, undefined, create);
  useEffect(() => {
    const timer = window.setInterval(() => dispatch({ type: "tick" }), 50);
    return () => window.clearInterval(timer);
  }, []);
  const { c, s } = m;
  const r = indications(s, c),
    e = environment(s.altitude, c),
    b = blocked(s, c);
  const set = (patch: Partial<Controls>) => dispatch({ type: "control", patch });
  const slider = (
    key: "tas" | "climb" | "baro" | "cabinDrop",
    label: string,
    min: number,
    max: number,
    increment: number,
    unit: string,
  ) => (
    <label className="ps-slider" key={key}>
      <span>
        {label}{" "}
        <b>
          {c[key].toFixed(key === "baro" ? 2 : 0)} {unit}
        </b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={increment}
        value={c[key]}
        onChange={(ev) => set({ [key]: Number(ev.target.value) })}
      />
    </label>
  );
  const psStatus = c.alternate
    ? "CABIN SOURCE"
    : c.staticBlocked
      ? c.staticLeak
        ? "EXTERNAL BLOCKED / CABIN LEAK"
        : "TRAPPED"
      : "EXTERNAL SOURCE";
  return (
    <ComponentShell
      id="pitot-static"
      toolbar={
        <>
          <button className="tb" aria-pressed={m.paused} onClick={() => dispatch({ type: "pause" })}>
            {m.paused ? "Resume" : "Pause"}
          </button>
          <button className="tb" onClick={() => dispatch({ type: "reset" })}>
            Reset
          </button>
        </>
      }
      scene={
        <div className="ps-study" data-pitot-static>
          <header>
            <p className="ps-eyebrow">PRESSURE LAB / LIVE SCHEMATIC</p>
            <h1>Pitot-static system</h1>
            <p>Two pressures. Three instruments. Follow the source of every indication.</p>
          </header>
          <div className="ps-truth">
            <span>
              True altitude <b>{s.altitude.toFixed(0)} ft</b>
            </span>
            <span>
              True airspeed <b>{c.tas} kt</b>
            </span>
            <span>
              Flight path <b>{s.altitude === 0 || s.altitude === 18000 ? "Altitude limit" : `${c.climb} ft/min`}</b>
            </span>
            <span>
              {m.paused ? "PAUSED" : "RUNNING"} · {s.elapsed.toFixed(0)} s
            </span>
          </div>
          <div
            className="ps-diagram-scroll"
            tabIndex={0}
            role="region"
            aria-label="Pressure schematic; scroll horizontally on small screens"
          >
            <svg className="ps-diagram" viewBox="0 0 800 380" role="img" aria-labelledby="ps-title ps-desc">
              <title id="ps-title">Live pitot-static pressure connections</title>
              <desc id="ps-desc">
                Pitot total pressure feeds the airspeed diaphragm. Selected static pressure feeds its case, the
                altimeter case, and the vertical speed diaphragm and restricted case. Orange is pitot; blue is static;
                dashed lines are blocked or disconnected.
              </desc>
              <g fill="none" strokeWidth="4">
                <path className={`ps-total ${b.inlet ? "ps-closed" : ""}`} d="M45 78 H300 V100 H470" />
                <path className={`ps-total ${b.drain ? "ps-closed" : ""}`} d="M190 78 V126 H220" />
                <path
                  className={`ps-static ${c.staticBlocked || c.alternate ? "ps-closed" : ""}`}
                  d="M45 210 H250 V248 H330"
                />
                <path className={`ps-static ${!c.alternate ? "ps-closed" : ""}`} d="M45 310 H250 V248" />
                <path className="ps-static" d="M330 248 H435 V140 H470 M435 248 H470 M435 248 V330 H470" />
              </g>
              <g className="ps-node">
                <rect x="25" y="30" width="220" height="42" rx="8" />
                <rect x="25" y="158" width="220" height="42" rx="8" />
                <rect x="25" y="318" width="220" height="42" rx="8" />
                <rect x="470" y="65" width="305" height="95" rx="10" />
                <rect x="470" y="207" width="305" height="63" rx="10" />
                <rect x="470" y="290" width="305" height="75" rx="10" />
              </g>
              <g className="ps-svg-label">
                <text x="38" y="57">
                  PITOT HEAD · {b.inlet ? "BLOCKED" : "OPEN"}
                </text>
                <text x="38" y="185">
                  STATIC PORT · {c.staticBlocked ? "BLOCKED" : "OPEN"}
                </text>
                <text x="38" y="345">
                  CABIN / ALTERNATE STATIC
                </text>
                <text x="202" y="145">
                  Drain {b.drain ? "blocked" : "open"}
                </text>
                <text x="268" y="235">
                  Selector
                </text>
                <text x="487" y="90">
                  AIRSPEED INDICATOR
                </text>
                <text x="487" y="116">
                  Diaphragm: total pressure Pt
                </text>
                <text x="487" y="143">
                  Case: static Ps → measures Pt − Ps
                </text>
                <text x="487" y="231">
                  ALTIMETER
                </text>
                <text x="487" y="254">
                  Sealed aneroid in static-pressure case
                </text>
                <text x="487" y="314">
                  VERTICAL SPEED INDICATOR
                </text>
                <text x="487" y="336">
                  Static diaphragm / restricted case
                </text>
                <text x="487" y="356">
                  Calibrated leak → pressure-change rate
                </text>
                <text x="30" y="99">
                  {c.heat && !c.heatFailed ? "HEATING" : c.heatFailed && c.heat ? "HEAT FAILED" : "HEAT OFF"} · Ice{" "}
                  {(s.ice * 100).toFixed(0)}%
                </text>
                <text x="30" y="235">
                  Outside {e.ambient.toFixed(0)} Pa
                </text>
                <text x="30" y="293">
                  Cabin {e.cabin.toFixed(0)} Pa
                </text>
              </g>
            </svg>
          </div>
          <p className="ps-key">
            Orange: total pressure · Blue: static pressure · Dashed: blocked or unselected path. Scroll the diagram
            horizontally on narrow screens.
          </p>
          <div className="ps-instruments" aria-label="Instrument indications">
            {[
              ["Airspeed", r.ias.toFixed(1), "KIAS", "Total minus static"],
              ["Altimeter", r.altitude.toFixed(0), "ft", `${c.baro.toFixed(2)} inHg setting`],
              ["Vertical speed", r.vsi.toFixed(0), "ft/min", "Conventional VSI · lagged"],
            ].map(([name, value, unit, note]) => (
              <article key={name}>
                <h2>{name}</h2>
                <output aria-label={name}>{value}</output>
                <span>{unit}</span>
                <small>{note}</small>
              </article>
            ))}
          </div>
          <div className="ps-pressures">
            <span>
              Pt line <b>{s.pitot.toFixed(0)} Pa</b>
            </span>
            <span>
              Ps line <b>{s.static.toFixed(0)} Pa</b>
            </span>
            <span>
              Pt − Ps <b>{r.differential.toFixed(0)} Pa</b>
            </span>
            <span>
              VSI case <b>{s.vsiCase.toFixed(0)} Pa</b>
            </span>
          </div>
          <p className="ps-status">
            {psStatus} ·{" "}
            {b.inlet
              ? b.drain
                ? c.pitotLeak
                  ? "Pitot supply sealed; line leaking"
                  : "Pitot pressure trapped"
                : "Pitot venting through drain"
              : "Pitot receiving total pressure"}
            {c.pitotLeak || c.staticLeak ? " · Line leakage active" : ""}
          </p>
          {r.differential < 0 && (
            <p className="ps-status">
              Negative ASI differential: indication is pegged at zero; pressure values remain visible above.
            </p>
          )}
          <section className="ps-lesson">
            <h2>Experiment: {scenarios[m.scenario].name}</h2>
            <p>{scenarios[m.scenario].lesson}</p>
            <small>Scenario text describes the preset. The live schematic follows all manual control changes.</small>
          </section>
          <section className="ps-notes">
            <h2>How to read the system</h2>
            <p>
              The pitot head senses total pressure: ambient static pressure plus the pressure rise from motion. The ASI
              compares total pressure inside a diaphragm with static pressure around it. It does not directly measure
              true airspeed; even a healthy IAS decreases with density at a fixed TAS.
            </p>
            <p>
              The altimeter’s sealed aneroid expands as static pressure falls. The VSI compares immediate static
              pressure against a case that equalizes through a calibrated restriction. A pressure step creates a
              transient climb or descent indication even in level flight.
            </p>
            <h2>Alternate static: recovery with a bias</h2>
            <p>
              Selecting cabin air bypasses an obstructed external port. In this unpressurized model the cabin pressure
              is lower than outside, so indicated altitude and IAS rise relative to the normal source. The VSI briefly
              indicates a climb, then settles in level flight. Returning to outside static reverses the transient.
              Alternate static cannot fix a blocked pitot line or a downstream leak.
            </p>
            <h2>Cross-checks and limits</h2>
            <p>
              A frozen altimeter with a VSI returning to zero suggests a static problem. An ASI behaving like an
              altimeter suggests trapped total pressure. Compare independent instruments and known attitude/power; GPS
              groundspeed is not IAS because wind changes it. These are teaching patterns, not automatic diagnoses or a
              flight checklist.
            </p>
            <p>
              Preflight inspection includes the pitot inlet, drain, static ports and removal of covers. Heat addresses
              pitot ice, not tape, insects, covers, leaks or static obstruction. Use the aircraft AFM/POH for heat
              procedures, alternate-source configuration and corrections.
            </p>
            <p>
              Generic schematic, not aircraft geometry. ISA, incompressible airspeed and illustrative leak/icing
              response; no position error, instrument friction or ADC logic. Cabin offset is adjustable, not a certified
              correction.
            </p>
            <a
              href="https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/phak/10_phak_ch8.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Source: FAA PHAK, chapter 8 · Flight Instruments, pp. 8-1–8-12
            </a>
          </section>
        </div>
      }
      panel={
        <div className="ps-controls">
          <h2>Flight conditions</h2>
          <p>Climb or descend to expose trapped-pressure errors. Pause freezes time; controls remain available.</p>
          {slider("tas", "True airspeed", 0, 200, 1, "kt")}
          {slider("climb", "Climb / descent", -2000, 2000, 100, "ft/min")}
          <button onClick={() => set({ climb: 0 })}>Level off</button>
          {slider("baro", "Altimeter setting", 28, 31, 0.01, "inHg")}
          <h2>Static source</h2>
          <label className="ps-check">
            <input type="checkbox" checked={c.alternate} onChange={(ev) => set({ alternate: ev.target.checked })} />
            Use alternate cabin static
          </label>
          {slider("cabinDrop", "Cabin pressure below ambient", 0, 250, 10, "Pa")}
          <p>
            Illustrative cabin offset. Vent/window effects and corrections vary by aircraft. Altimeter setting affects
            only the altimeter.
          </p>
          <h2>Failure laboratory</h2>
          <label className="ps-select">
            Load scenario
            <select
              value={m.scenario}
              onChange={(ev) => dispatch({ type: "scenario", index: Number(ev.target.value) })}
            >
              {scenarios.map((v, i) => (
                <option key={v.name} value={i}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <p>
            Failures take effect at the current altitude and line pressures. Combine controls below for compound
            failures.
          </p>
          {toggles.map(([key, label]) => (
            <label className="ps-check" key={key}>
              <input type="checkbox" checked={c[key]} onChange={(ev) => set({ [key]: ev.target.checked })} />
              {label}
            </label>
          ))}
          <p>
            Ice: {(s.ice * 100).toFixed(0)}%. In this teaching model, 80% seals both pitot openings. Heat melts ice only
            when the heater works; manual obstructions remain.
          </p>
          <button onClick={() => dispatch({ type: "scenario", index: m.scenario })}>Reapply selected scenario</button>
          <p>Study aid only. Follow your aircraft’s AFM/POH and approved procedures.</p>
        </div>
      }
    />
  );
}
