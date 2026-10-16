"use client";
/** The engine page's side panel: start-from scenarios, controls, environment, failures, cylinders, and the documents. */
import type { ReactNode } from "react";
import { AVGAS_LB_GAL } from "@/engines/model/atmosphere";
import { governedRpm, prime, type MagSwitch } from "@/engines/model/engine";
import { egtOffset } from "@/engines/model/mixture";
import { labelOf, scenariosFor } from "@/engines/model/scenarios";
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
import { f0 } from "@/lib/format";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import type { EngineSpec, Marking } from "@/engines/types";
import { PressureChart } from "./PressureChart";
import { GROUPS } from "./scene/parts";
import { startScenario, type EngineSim } from "./store";

const pct = (v: number) => `${Math.round(v * 100)} %`;
const fahrenheit = (c: number) => (c * 9) / 5 + 32;

// What the spec says about the installation's controls (no engine is named here):
/** A governor with no pilot control: a single power lever and a mixture lever on the console. */
const fixedGovernor = (spec: EngineSpec) => spec.propeller.control === "fixed";
/** A fuel system with a HIGH BOOST/PRIME position and its lockout. */
const highBoostPump = (spec: EngineSpec) => spec.fuelSystem.kind === "continental";
/** An alternate-air door that opens by itself, with no pilot control. */
const autoAltAir = (spec: EngineSpec) => spec.induction?.altAir === "automatic";

const startTitle = (spec: EngineSpec) =>
  spec.ignition.startMags === "both"
    ? "Hold to crank: START turns the starter and fires both magnetos; the switch springs back to BOTH"
    : `Hold to crank: the starter turns the engine and only the ${
        spec.ignition.retardMag === "L" ? "left" : "right"
      } (retard-breaker) magneto fires`;

type Pump = "OFF" | "BOOST" | "HIGH";
const PUMP: [Pump, string][] = [
  ["OFF", "Off"],
  ["BOOST", "Boost"],
  ["HIGH", "High boost/prime"],
];

export function StartFrom({ sim }: { sim: EngineSim }) {
  const note = sim.useUi((x) => x.view.scenario),
    loading = sim.useUi((x) => x.view.loading);
  const spec = sim.spec,
    list = scenariosFor(spec),
    find = (id: string) => list.find((x) => x.id === id);
  return (
    <>
      <H3>Start from</H3>
      <BtnRow>
        {list.map((sc) => (
          <ScenarioButton key={sc.id} onClick={() => startScenario(sim, sc.id)}>
            {labelOf(sc, spec)}
          </ScenarioButton>
        ))}
      </BtnRow>
      {loading ? (
        <Small>Setting up {labelOf(find(loading) ?? list[0], spec).toLowerCase()} …</Small>
      ) : (
        note && <Small>{find(note)?.note(spec)}</Small>
      )}
    </>
  );
}

/** The engine controls. `onPrime` replaces the instant primer stroke (the carburetor page animates one). */
export function Controls({ sim, onPrime }: { sim: EngineSim; onPrime?: () => void }) {
  const c = sim.useUi((x) => x.controls),
    set = sim.useUi((x) => x.setControls);
  const spec = sim.spec,
    carb = spec.fuelSystem.kind === "carburetor",
    single = fixedGovernor(spec),
    pump3 = highBoostPump(spec),
    autoAir = autoAltAir(spec);
  // the checkbox row: a two-position boost pump, and the primer or a pilot alternate-air control
  const checks = !pump3 || carb || !autoAir;
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
          title={startTitle(spec)}
          onDown={() => set({ mags: "START" })}
          onUp={() => set({ mags: "BOTH" })}
        >
          Hold to START
        </HoldButton>
      </div>
      <Slider
        id="throttle"
        label={single ? "Power lever (MAX – IDLE)" : "Throttle"}
        min={0}
        max={1}
        step={0.01}
        value={c.throttle}
        onChange={(v) => set({ throttle: v })}
        fmt={pct}
      />
      {!single && (
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
      )}
      <Slider
        id="mixture"
        label={single ? "Mixture (RICH – CUTOFF)" : "Mixture"}
        min={0}
        max={1}
        step={0.005}
        value={c.mixture}
        onChange={(v) => set({ mixture: v })}
        fmt={(v) => (v < 0.03 ? (single ? "cutoff" : "idle cut-off") : v > 0.995 ? "full rich" : pct(v))}
      />
      {carb && (
        <Slider
          id="carbheat"
          label="Carburetor heat"
          min={0}
          max={1}
          step={0.05}
          value={c.carbHeat}
          onChange={(v) => set({ carbHeat: v })}
          fmt={(v) => (v < 0.03 ? "cold" : v > 0.97 ? "full hot" : pct(v))}
        />
      )}
      {pump3 && (
        <>
          <Seg
            id="pump"
            label="Fuel pump"
            options={PUMP}
            value={c.highBoost ? "HIGH" : c.boost ? "BOOST" : "OFF"}
            onChange={(v) => set({ boost: v !== "OFF", highBoost: v === "HIGH" })}
          />
          <PumpNote sim={sim} />
        </>
      )}
      {(single || autoAir) && <ControlReadouts sim={sim} />}
      {checks && (
        <div className="eng-checks">
          {!pump3 && <Check id="boost" label="Boost pump" checked={c.boost} onChange={(v) => set({ boost: v })} />}
          {carb ? (
            <button
              type="button"
              className="btn eng-prime"
              title={`One stroke of the primer: fuel straight into the intake ports (${spec.refs.start})`}
              onClick={() => (onPrime ? onPrime() : prime(spec, sim.s))}
            >
              Prime
            </button>
          ) : (
            !autoAir && (
              <Check id="altair" label="Alternate air" checked={c.altAir} onChange={(v) => set({ altAir: v })} />
            )
          )}
        </div>
      )}
    </>
  );
}

/** Whether the HIGH BOOST/PRIME the switch asks for is running, or the lockout relay holds the pump at BOOST. */
function PumpNote({ sim }: { sim: EngineSim }) {
  const high = sim.useUi((x) => !!x.controls.highBoost);
  const s = useLiveSnapshot(sim.s, 250);
  const fs = sim.spec.fuelSystem;
  if (!high || fs.kind !== "continental") return null;
  const hb = fs.highBoost;
  return (
    <Small>
      {s.highBoostOn
        ? "HIGH BOOST/PRIME running"
        : `Locked out: the relay runs the pump as BOOST. HIGH BOOST/PRIME needs ${hb.mapInHg} inHg and ${f0(
            hb.altFt,
          )} ft, or the engine below ${f0(hb.belowRpm)} rpm.`}
    </Small>
  );
}

/** Readouts in place of the controls an installation does without: a factory-set governor, an automatic door. */
function ControlReadouts({ sim }: { sim: EngineSim }) {
  const s = useLiveSnapshot(sim.s, 250);
  const spec = sim.spec;
  return (
    <Readouts
      items={[
        ...(fixedGovernor(spec)
          ? ([["Governor (factory set)", `${f0(governedRpm(spec, 1))} rpm`]] as [string, string][])
          : []),
        ...(autoAltAir(spec) ? ([["Alternate air door", s.altAirOpen ? "open" : "closed"]] as [string, string][]) : []),
      ]}
    />
  );
}

function Readings({ sim }: { sim: EngineSim }) {
  const s = useLiveSnapshot(sim.s, 250);
  const spec = sim.spec,
    carb = spec.fuelSystem.kind === "carburetor";
  const fuel: [string, string][] = carb
    ? [
        ["Carb inlet", `${s.fuelPsi.toFixed(1)} psi`],
        ["Float bowl", spec.fuelSystem.kind === "carburetor" ? pct(s.bowl / spec.fuelSystem.bowlLb) : "–"],
        ["Mixture chamber", `${f0((s.carbC * 9) / 5 + 32)} °F`],
        ["Carb ice", pct(s.ice)],
      ]
    : [["Nozzle", `${s.nozzlePsi.toFixed(1)} psi`]];
  const cooler: [string, string][] =
    spec.oil.coolerMaxBtuMin !== undefined
      ? [
          ["Oil cooler", `${f0(s.coolerBtu)} Btu/min`],
          ["Through cooler", `${f0(s.coolerValve * 100)} %`],
        ]
      : [];
  const turbo: [string, string][] = spec.turbo
    ? [
        ["Deck", `${s.deckInHg!.toFixed(1)} inHg`],
        // the spring holds the gate open until oil pressure on the actuator closes it
        ["Wastegate", s.rpm < 1 ? "spring open" : `${f0(s.gate! * 100)} % open`],
        ["TIT L", `${f0(s.tit![0])} °F`],
        ["TIT R", `${f0(s.tit![1])} °F`],
        ["Turbo speed L (illustrative)", `${f0(s.turboRpm![0])} rpm`],
        ["Turbo speed R (illustrative)", `${f0(s.turboRpm![1])} rpm`],
        ["Charge air", `${f0(fahrenheit(s.matC!))} °F`],
        ["Overboost valve", s.reliefOpen ? "relieving" : "closed"],
      ]
    : [];
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
          ...fuel,
          ["Blade", `${s.beta.toFixed(1)}°`],
          ["Governor", s.governing ? "governing" : "not governing"],
          ...cooler,
          ["Inlet", `${s.inletInHg.toFixed(1)} inHg`],
          ...(carb ? ([["Inlet air", `${f0((s.inletC * 9) / 5 + 32)} °F`]] as [string, string][]) : []),
          ...turbo,
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
              <td>{spec.geometry.cylinders[i].n}</td>
              <td>{Number.isFinite(c.lambda) ? c.lambda.toFixed(2) : "–"}</td>
              <td>{(c.fuel / AVGAS_LB_GAL).toFixed(2)}</td>
              <td>
                {Number.isFinite(c.lambda) && c.work > 0.02
                  ? `${f0(-egtOffset(c.lambda, spec.calibration.richMisfireLambda))} ${c.lambda < 1 ? "R" : "L"}`
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

export function Environment({ sim }: { sim: EngineSim }) {
  const e = sim.useUi((x) => x.env),
    set = sim.useUi((x) => x.setEnv);
  const L = sim.spec.limits,
    top = sim.spec.envelope;
  return (
    <>
      <H3>Conditions</H3>
      <Slider
        id="alt"
        label="Pressure altitude"
        min={0}
        max={top?.maxAltFt ?? 17500}
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
        max={top?.maxTasKt ?? 180}
        step={5}
        value={e.tasKt}
        onChange={(v) => set({ tasKt: v })}
        fmt={(v) => (v === 0 ? "on the ground" : `${v} kt`)}
      />
      <Slider
        id="oil"
        label="Oil quantity"
        min={2}
        max={top?.maxOilQt ?? L.oilSumpQt.value}
        step={0.5}
        value={e.oilQt}
        onChange={(v) => set({ oilQt: v })}
        fmt={(v) => `${v} qt`}
      />
      {sim.spec.fuelSystem.kind === "carburetor" && (
        <Slider
          id="humidity"
          label="Relative humidity"
          min={0}
          max={1}
          step={0.05}
          value={e.humidity}
          onChange={(v) => set({ humidity: v })}
          fmt={pct}
        />
      )}
    </>
  );
}

function Failures({ sim }: { sim: EngineSim }) {
  const f = sim.useUi((x) => x.failures),
    set = sim.useUi((x) => x.setFailures);
  const cyls = sim.spec.geometry.cylinders,
    injected = sim.spec.fuelSystem.kind === "injected";
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
            {injected && <th>Nozzle blocked</th>}
            <th>Intake leak</th>
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
              {injected && (
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
              )}
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
            label={g.id === "fuel" && sim.spec.fuelSystem.kind === "carburetor" ? "Carburetor and fuel pump" : g.name}
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
    [
      "Rated power",
      `${spec.rating.hp} hp at ${f0(spec.rating.rpm)} rpm${
        spec.rating.map !== undefined ? ` and ${spec.rating.map.toFixed(1)} inHg` : ""
      }`,
    ],
    ["Displacement", `${g.displacementIn3} cu in`],
    ["Bore × stroke", `${g.boreIn} × ${g.strokeIn} in`],
    ["Compression ratio", `${g.compressionRatio}:1`],
    ["Firing order", g.firingOrder.join("-")],
    ["Ignition timing", `${spec.ignition.advanceBTC}° BTC`],
    ["Magnetos", a.magnetos],
    [spec.fuelSystem.kind === "carburetor" ? "Carburetor" : "Fuel injector", spec.fuelSystem.unit],
    ["Dry weight", `${a.weightLb} lb`],
    ...spec.rating.cruise.map((c): [ReactNode, ReactNode] => [
      c.label,
      `${c.pct} %: ${f0(c.hp)} hp at ${f0(c.rpm)} rpm, ${c.mixture}, ${c.gph} gph`,
    ]),
  ];
  const limits: [ReactNode, ReactNode][] = [
    ["Maximum rpm", `${f0(L.rpmMax.value)}`],
    [
      "Idle",
      `${L.idleRpm.min}–${L.idleRpm.max} rpm${L.idleRpm.assumed ? " (assumed: the airframe maker sets it)" : ""}`,
    ],
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
    ...(L.starterMaxS ? [["Starter", `${L.starterMaxS.value} s at a time`] as [ReactNode, ReactNode]] : []),
    ...(spec.oil.coolerMaxBtuMin !== undefined
      ? [
          ["Oil cooler", `≤ ${spec.oil.coolerMaxBtuMin} Btu/min; thermostat closes at ${spec.oil.thermostatF} °F`] as [
            ReactNode,
            ReactNode,
          ],
        ]
      : []),
    ...(spec.fuelSystem.kind === "carburetor"
      ? [
          [
            "Carburetor inlet",
            `${spec.fuelSystem.inletPsi.min}–${spec.fuelSystem.inletPsi.max} psi, ${spec.fuelSystem.inletPsi.desired} psi desired`,
          ] as [ReactNode, ReactNode],
        ]
      : []),
  ];
  return (
    <>
      <H3>Specifications</H3>
      <Facts rows={rows} />
      <H3>Operating limits</H3>
      <Facts rows={spec.markings ? markedLimits(spec) : limits} />
      <Small>{spec.refs.tables}</Small>
    </>
  );
}

const GAUGE: Record<Marking["gauge"], string> = {
  cht: "CHT",
  rpm: "Engine speed",
  egt: "EGT",
  map: "Manifold pressure",
  oilP: "Oil pressure",
  oilT: "Oil temperature",
  pct: "Percent power",
  tit: "TIT",
  ff: "Fuel flow",
};

/** One instrument marking as a row: its scale and its coloured bands, with the alert each band raises. */
function markingRow(m: Marking): [string, string] {
  const range = (from: number, to: number) => (from === to ? `> ${from}` : `${from}–${to}`);
  const bands = m.bands.map(
    (b) => `${b.color} ${range(b.from, b.to)}${b.cas ? ` (${[b.cas, b.level].filter(Boolean).join(" ")})` : ""}`,
  );
  return [GAUGE[m.gauge], [`scale ${m.scale[0]}–${m.scale[1]} ${m.unit}`, ...bands].join("; ") + ` · ${m.src}`];
}

/**
 * The operating limits of an engine whose airplane manual marks its instruments: the instrument markings themselves,
 * then each limit the spec gives, each with its source.
 */
function markedLimits(spec: EngineSpec): [ReactNode, ReactNode][] {
  const L = spec.limits;
  const row = (label: string, text: string, src: string): [string, string] => [label, `${text} · ${src}`];
  const opt = (r: [string, string] | false | undefined) => (r ? [r] : []);
  return [
    row("Maximum rpm", `${f0(L.rpmMax.value)}`, L.rpmMax.src),
    row("Idle", `${L.idleRpm.min}–${L.idleRpm.max} rpm`, L.idleRpm.src),
    ...(spec.markings ?? []).map(markingRow),
    ...opt(
      L.oilTempMinTakeoff &&
        row("Takeoff oil temperature", `${L.oilTempMinTakeoff.value} °F minimum`, L.oilTempMinTakeoff.src),
    ),
    ...opt(
      L.mapMinAbove &&
        row(
          "Manifold pressure at altitude",
          `not below ${L.mapMinAbove.map} inHg above ${f0(L.mapMinAbove.altFt)} ft`,
          L.mapMinAbove.src,
        ),
    ),
    ...opt(L.maxAltFt && row("Maximum operating altitude", `${f0(L.maxAltFt.value)} ft`, L.maxAltFt.src)),
    ...opt(L.leanMaxMap && row("Leaning", `only at ${L.leanMaxMap.value} inHg or less`, L.leanMaxMap.src)),
    ...opt(L.chtMinDescent && row("CHT in a descent", `${L.chtMinDescent.value} °F minimum`, L.chtMinDescent.src)),
    ...opt(
      L.titTransient &&
        row(
          "TIT transient",
          `${f0(L.titTransient.value)} °F for up to ${L.titTransient.seconds} s`,
          L.titTransient.src,
        ),
    ),
    ...opt(
      L.turbineRpmMax &&
        row(
          "Turbine speed",
          L.turbineRpmMax.points.map(([tit, rpm]) => `${f0(rpm)} rpm at ${f0(tit)} °F TIT`).join(", ") +
            " (straight lines between)",
          L.turbineRpmMax.src,
        ),
    ),
    ...opt(
      L.exhaustBackPressureMax &&
        row("Exhaust back pressure", `${L.exhaustBackPressureMax.value} inHg maximum`, L.exhaustBackPressureMax.src),
    ),
    ...opt(
      L.startEngaged &&
        row(
          "Starter engaged",
          `START ENGAGED caution after ${L.startEngaged.caution} s, warning after ${L.startEngaged.warning} s`,
          L.startEngaged.src,
        ),
    ),
    ...opt(
      L.oilPressCautionMinRpm &&
        row(
          "Oil pressure caution",
          `at ${f0(L.oilPressCautionMinRpm.value)} rpm and above`,
          L.oilPressCautionMinRpm.src,
        ),
    ),
    row("Oil", `${L.oilSumpQt.value} qt sump, ${L.oilMinQt.value} qt minimum`, `${L.oilSumpQt.src}; ${L.oilMinQt.src}`),
    row(
      "Magneto check",
      `drop ≤ ${L.magDropMax.value} rpm, within ${L.magDiffMax.value} rpm of each other${
        L.magCheckRpm.min === L.magCheckRpm.max ? ` at ${f0(L.magCheckRpm.min)} rpm` : ""
      }`,
      L.magDropMax.src,
    ),
    ...opt(L.starterMaxS && row("Starter", `${L.starterMaxS.value} s at a time`, L.starterMaxS.src)),
    ...opt(
      spec.oil.coolerMaxBtuMin !== undefined && [
        "Oil cooler",
        `≤ ${spec.oil.coolerMaxBtuMin} Btu/min; thermostat closes at ${spec.oil.thermostatF} °F`,
      ],
    ),
  ];
}

function Model({ sim }: { sim: EngineSim }) {
  return (
    <>
      <H3>How the model works</H3>
      <Notes items={sim.spec.modelNotes} />
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
      {/* without a reference line of its own, the maker and the manual in two text runs, so it lays out as before */}
      <div className="ref">{spec.ref ?? [`Engine simulation · ${spec.model.split(" ")[0]} `, spec.doc]}</div>
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
      <Model sim={sim} />
      <Sources sim={sim} />
    </div>
  );
}
