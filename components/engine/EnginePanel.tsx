"use client";
/** The engine page's side panel: start-from scenarios, controls, environment, failures, cylinders, and the documents. */
import type { ReactNode } from "react";
import { AVGAS_LB_GAL } from "@/engines/model/atmosphere";
import { governedRpm, type MagSwitch } from "@/engines/model/engine";
import { egtOffset } from "@/engines/model/mixture";
import { SCENARIOS } from "@/engines/model/scenarios";
import {
  BtnRow,
  Check,
  Facts,
  H3,
  HoldButton,
  Notes,
  Readouts,
  ScenarioButton,
  Seg,
  Slider,
  Small,
} from "@/components/ui/controls";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { PressureChart } from "./PressureChart";
import { GROUPS } from "./scene/parts";
import { startScenario, type EngineSim } from "./store";

const pct = (v: number) => `${Math.round(v * 100)} %`;
const f0 = (v: number) => Math.round(v).toLocaleString("en-US");

function StartFrom({ sim }: { sim: EngineSim }) {
  const note = sim.useUi((x) => x.view.scenario),
    loading = sim.useUi((x) => x.view.loading);
  return (
    <>
      <H3>Start from</H3>
      <BtnRow>
        {SCENARIOS.map((sc) => (
          <ScenarioButton key={sc.id} onClick={() => startScenario(sim, sc.id)}>
            {sc.label}
          </ScenarioButton>
        ))}
      </BtnRow>
      {loading ? (
        <Small>Setting up {SCENARIOS.find((x) => x.id === loading)?.label.toLowerCase()} …</Small>
      ) : (
        note && <Small>{SCENARIOS.find((x) => x.id === note)?.note}</Small>
      )}
    </>
  );
}

function Controls({ sim }: { sim: EngineSim }) {
  const c = sim.useUi((x) => x.controls),
    set = sim.useUi((x) => x.setControls);
  const spec = sim.spec;
  const mags: [MagSwitch, string][] = [
    ["OFF", "Off"],
    ["R", "R"],
    ["L", "L"],
    ["BOTH", "Both"],
  ];
  return (
    <>
      <H3>Engine controls</H3>
      <div className="eng-mags">
        <Seg
          id="mags"
          label="Ignition"
          options={mags}
          value={c.mags === "START" ? "BOTH" : c.mags}
          onChange={(v) => set({ mags: v })}
        />
        <HoldButton
          className={`btn eng-start${c.mags === "START" ? " on" : ""}`}
          title="Hold to crank: the starter turns the engine and only the left (retard-breaker) magneto fires"
          onDown={() => set({ mags: "START" })}
          onUp={() => set({ mags: "BOTH" })}
        >
          Hold to START
        </HoldButton>
      </div>
      <Slider
        id="throttle"
        label="Throttle"
        min={0}
        max={1}
        step={0.01}
        value={c.throttle}
        onChange={(v) => set({ throttle: v })}
        fmt={pct}
      />
      <Slider
        id="prop"
        label="Propeller"
        min={0}
        max={1}
        step={0.01}
        value={c.prop}
        onChange={(v) => set({ prop: v })}
        fmt={(v) => `governs ${f0(governedRpm(spec, v))} rpm`}
      />
      <Slider
        id="mixture"
        label="Mixture"
        min={0}
        max={1}
        step={0.005}
        value={c.mixture}
        onChange={(v) => set({ mixture: v })}
        fmt={(v) => (v < 0.03 ? "idle cut-off" : v > 0.995 ? "full rich" : pct(v))}
      />
      <Check id="boost" label="Boost pump" checked={c.boost} onChange={(v) => set({ boost: v })} />
      <Check id="altair" label="Alternate air" checked={c.altAir} onChange={(v) => set({ altAir: v })} />
    </>
  );
}

function Readings({ sim }: { sim: EngineSim }) {
  const s = useLiveSnapshot(sim.s, 250);
  return (
    <>
      <H3>Engine</H3>
      <Readouts
        items={[
          ["Brake power", `${f0(s.hp)} hp`],
          ["Rated", `${f0(s.pct)} %`],
          ["Torque", `${f0(s.torque * 0.7376)} lb·ft`],
          ["Friction", `${f0(s.frictionHp)} hp`],
          ["Air", `${f0(s.air)} lb/h`],
          ["Fuel", `${(s.fuel / AVGAS_LB_GAL).toFixed(1)} gph`],
          ["Nozzle", `${s.nozzlePsi.toFixed(1)} psi`],
          ["Blade", `${s.beta.toFixed(1)}°`],
          ["Governor", s.governing ? "governing" : "not governing"],
          ["Oil cooler", `${f0(s.coolerBtu)} Btu/min`],
          ["Through cooler", `${f0(s.coolerValve * 100)} %`],
          ["Inlet", `${s.inletInHg.toFixed(1)} inHg`],
        ]}
      />
      <table className="eng-table">
        <thead>
          <tr>
            <th>Cyl</th>
            <th>λ</th>
            <th>gph</th>
            <th>from peak</th>
            <th>EGT</th>
            <th>CHT</th>
            <th>hp</th>
          </tr>
        </thead>
        <tbody>
          {s.cyl.map((c, i) => (
            <tr key={i}>
              <td>{sim.spec.geometry.cylinders[i].n}</td>
              <td>{Number.isFinite(c.lambda) ? c.lambda.toFixed(2) : "–"}</td>
              <td>{(c.fuel / AVGAS_LB_GAL).toFixed(2)}</td>
              <td>
                {Number.isFinite(c.lambda) && c.work > 0.02
                  ? `${f0(-egtOffset(c.lambda))} ${c.lambda < 1 ? "R" : "L"}`
                  : "–"}
              </td>
              <td>{f0(c.egt)}</td>
              <td>{f0(c.cht)}</td>
              <td>{c.hp.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Small>
        λ is the excess-air ratio (1 = chemically correct). &quot;From peak&quot; is °F rich (R) or lean (L) of that
        cylinder&apos;s peak EGT.
      </Small>
    </>
  );
}

function Environment({ sim }: { sim: EngineSim }) {
  const e = sim.useUi((x) => x.env),
    set = sim.useUi((x) => x.setEnv);
  const L = sim.spec.limits;
  return (
    <>
      <H3>Conditions</H3>
      <Slider
        id="alt"
        label="Pressure altitude"
        min={0}
        max={17500}
        step={500}
        value={e.altFt}
        onChange={(v) => set({ altFt: v })}
        fmt={(v) => `${f0(v)} ft`}
      />
      <Slider
        id="isa"
        label="Temperature"
        min={-30}
        max={30}
        step={5}
        value={e.isaDevC}
        onChange={(v) => set({ isaDevC: v })}
        fmt={(v) => (v === 0 ? "standard" : `ISA ${v > 0 ? "+" : "−"}${Math.abs(v)} °C`)}
      />
      <Slider
        id="tas"
        label="True airspeed"
        min={0}
        max={180}
        step={5}
        value={e.tasKt}
        onChange={(v) => set({ tasKt: v })}
        fmt={(v) => (v === 0 ? "on the ground" : `${v} kt`)}
      />
      <Slider
        id="oil"
        label="Oil quantity"
        min={2}
        max={L.oilSumpQt.value}
        step={0.5}
        value={e.oilQt}
        onChange={(v) => set({ oilQt: v })}
        fmt={(v) => `${v} qt`}
      />
    </>
  );
}

function Failures({ sim }: { sim: EngineSim }) {
  const f = sim.useUi((x) => x.failures),
    set = sim.useUi((x) => x.setFailures);
  const cyls = sim.spec.geometry.cylinders;
  return (
    <>
      <H3>Failures</H3>
      <div className="eng-checks">
        <Check id="f-magl" label="Left magneto" checked={f.magL} onChange={(v) => set({ magL: v })} />
        <Check id="f-magr" label="Right magneto" checked={f.magR} onChange={(v) => set({ magR: v })} />
        <Check
          id="f-pump"
          label="Engine-driven fuel pump"
          checked={f.fuelPump}
          onChange={(v) => set({ fuelPump: v })}
        />
        <Check id="f-filter" label="Air filter blocked" checked={f.filter} onChange={(v) => set({ filter: v })} />
        <Check id="f-starter" label="Starter" checked={f.starter} onChange={(v) => set({ starter: v })} />
        <Check
          id="f-starter-stuck"
          label="Starter stuck engaged"
          checked={f.starterStuck}
          onChange={(v) => set({ starterStuck: v })}
        />
      </div>
      <table className="eng-table eng-fail">
        <thead>
          <tr>
            <th>Cyl</th>
            <th>Top plug</th>
            <th>Bottom plug</th>
            <th>Nozzle blocked</th>
          </tr>
        </thead>
        <tbody>
          {cyls.map((c, i) => (
            <tr key={c.n}>
              <td>{c.n}</td>
              {[0, 1].map((k) => (
                <td key={k}>
                  <input
                    type="checkbox"
                    aria-label={`Cylinder ${c.n} ${k ? "bottom" : "top"} plug fouled`}
                    checked={f.plugs[i][k]}
                    onChange={(e) =>
                      set({
                        plugs: f.plugs.map((p, j) =>
                          j === i ? (k ? [p[0], e.target.checked] : [e.target.checked, p[1]]) : p,
                        ),
                      })
                    }
                  />
                </td>
              ))}
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
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function Simulation({ sim }: { sim: EngineSim }) {
  const thermal = sim.useUi((x) => x.view.thermal),
    setView = sim.useUi((x) => x.setView);
  return (
    <>
      <H3>Time</H3>
      <Seg
        id="thermal"
        label="Temperatures"
        options={[
          [1, "Real time"],
          [10, "10× faster"],
          [60, "60× faster"],
        ]}
        value={thermal}
        onChange={(v) => setView({ thermal: v })}
      />
      <Small>
        Heads and oil take minutes to settle; speeding them up leaves the crankshaft, governor and fuel at real time.
      </Small>
    </>
  );
}

function Parts({ sim }: { sim: EngineSim }) {
  const hidden = sim.useUi((x) => x.view.hidden),
    setView = sim.useUi((x) => x.setView);
  return (
    <>
      <H3>Parts</H3>
      <Small>Point at any part for its name and what it does. Untick a group to see what it hides.</Small>
      <div className="eng-parts">
        {GROUPS.map((g) => (
          <Check
            key={g.id}
            id={`part-${g.id}`}
            label={g.name}
            checked={!hidden.includes(g.id)}
            onChange={(v) => setView({ hidden: v ? hidden.filter((h) => h !== g.id) : [...hidden, g.id] })}
          />
        ))}
      </div>
    </>
  );
}

function Specs({ sim }: { sim: EngineSim }) {
  const spec = sim.spec,
    g = spec.geometry,
    a = spec.accessories,
    L = spec.limits;
  const rows: [ReactNode, ReactNode][] = [
    ["Model", spec.model],
    ["Rated power", `${spec.rating.hp} hp at ${f0(spec.rating.rpm)} rpm`],
    ["Displacement", `${g.displacementIn3} cu in`],
    ["Bore × stroke", `${g.boreIn} × ${g.strokeIn} in`],
    ["Compression ratio", `${g.compressionRatio}:1`],
    ["Firing order", g.firingOrder.join("-")],
    ["Ignition timing", `${spec.ignition.advanceBTC}° BTC`],
    ["Magnetos", a.magnetos],
    ["Fuel injector", a.injector],
    ["Dry weight", `${a.weightLb} lb`],
    ...spec.rating.cruise.map((c): [ReactNode, ReactNode] => [
      c.label,
      `${c.pct} %: ${c.hp} hp at ${f0(c.rpm)} rpm, ${c.mixture}, ${c.gph} gph`,
    ]),
  ];
  const limits: [ReactNode, ReactNode][] = [
    ["Maximum rpm", `${f0(L.rpmMax.value)}`],
    ["Idle", `${L.idleRpm.min}–${L.idleRpm.max} rpm`],
    [
      "CHT",
      `${L.chtMax.value} °F maximum; ${L.chtBestAbove75.value} °F above 75 % and ${L.chtBestAt75.value} °F at or below 75 % for maximum life`,
    ],
    ["Oil temperature", `${L.oilTempMax.value} °F maximum; ${L.oilTempBest.value} °F for maximum life`],
    [
      "Oil pressure",
      `${L.oilPressNormal.min}–${L.oilPressNormal.max} psi normal, ${L.oilPressMinIdle.value} psi minimum at idle, ${L.oilPressMaxStart.value} psi maximum starting`,
    ],
    ["Oil", `${L.oilSumpQt.value} qt sump, ${L.oilMinQt.value} qt minimum`],
    ["Magneto check", `drop ≤ ${L.magDropMax.value} rpm, within ${L.magDiffMax.value} rpm of each other`],
    ["Starter", `${L.starterMaxS.value} s at a time`],
    ["Oil cooler", `≤ ${spec.oil.coolerMaxBtuMin} Btu/min; thermostat closes at ${spec.oil.thermostatF} °F`],
  ];
  return (
    <>
      <H3>Specifications</H3>
      <Facts rows={rows} />
      <H3>Operating limits</H3>
      <Facts rows={limits} />
      <Small>
        Lycoming IOM, Table A-1 (p. 51), Table A-2 (p. 53), Table 2 (p. 14) and the operating procedures (pp. 26–40).
      </Small>
    </>
  );
}

function Model() {
  return (
    <>
      <H3>How the model works</H3>
      <Notes
        items={[
          "Power comes from Lycoming's own performance chart (Figure C-1), digitized: sea-level power against manifold pressure for each rpm, and the altitude correction to 20,000 ft. The running engine is calibrated so its full-throttle point and part-throttle lines land on that chart.",
          "Air flows through the throttle as a compressible orifice into the manifold; the cylinders draw it by speed and density. Fuel follows the fuel injector's metering (richer as the air thins), the fuel manifold and the nozzle curve (Figure C-2).",
          "Each cylinder's mixture sets its power, EGT and head heat: best power is about 150 °F rich of peak EGT (the IOM's leanest setting for maximum-power cruise, p. 39), power at peak EGT about 3.5 % lower, and the engine runs rough and quits far rich or lean. Fuel flow reproduces Figure C-3 and the Table A-1 cruise figures.",
          "Friction and pumping losses, starter torque, a constant-speed propeller with an oil-driven governor, and lumped thermal models for heads and oil (the thermostat and cooler from Table 2) complete the loop.",
          "The cylinder-pressure trace is drawn from the model's own work per cycle, with an assumed burn duration; it is illustrative, not measured data.",
          "The 3D engine: bore, stroke and the overall envelope (Table A-1) set its scale, and where each part sits follows the IOM's System Description figures (Figures 1B–9). The shapes and sizes of individual parts, the cylinders' spacing along the crankshaft, and the valve lift are schematic; the valves are drawn parallel to the cylinder where the real guides are angled.",
          "Not published, so chosen to fit the documented points: valve timing, rod length, the propeller's pitch range and inertia, the cooling and thermal constants, and the per-cylinder spread. The propeller is the SR20's Hartzell, used only as the load.",
        ]}
      />
    </>
  );
}

function Sources({ sim }: { sim: EngineSim }) {
  return (
    <>
      <H3>Sources</H3>
      <ul className="notes">
        {sim.spec.sources.map((s) => (
          <li key={s.title}>
            {s.href ? (
              <a href={s.href} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            ) : (
              s.title
            )}
            . {s.note}
          </li>
        ))}
      </ul>
    </>
  );
}

export function EnginePanel({ sim }: { sim: EngineSim }) {
  const spec = sim.spec;
  return (
    <div className="panel-inner">
      <div className="ref">Engine simulation · Lycoming IOM</div>
      <p className="lead">{spec.lead}</p>
      <StartFrom sim={sim} />
      <Controls sim={sim} />
      <Readings sim={sim} />
      <PressureChart sim={sim} />
      <Environment sim={sim} />
      <Failures sim={sim} />
      <Simulation sim={sim} />
      <Parts sim={sim} />
      <Specs sim={sim} />
      <Model />
      <Sources sim={sim} />
    </div>
  );
}
