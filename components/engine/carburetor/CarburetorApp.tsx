"use client";
/**
 * The carburetor simulation (/components/carburetor): the MA-4-5 float carburetor in cutaway, drawn large and fed by
 * the O-360's running engine, a readout of what each of its systems is doing, and a panel with the engine controls,
 * conditions, failures and the documented numbers.
 */
import dynamic from "next/dynamic";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { AVGAS_LB_GAL } from "@/engines/model/atmosphere";
import { ComponentShell } from "../ComponentShell";
import { Toggle } from "../chrome";
import { carbSim, live, useCarbLoop, useCarbView } from "./live";
import { CarburetorPanel } from "./CarburetorPanel";

const Scene = dynamic(() => import("./CarburetorScene"), { ssr: false, loading: () => <div /> });

const f0 = (v: number) => Math.round(v).toLocaleString("en-US");
const degF = (c: number) => (c * 9) / 5 + 32;

function Toolbar() {
  const v = useCarbView();
  const sim = carbSim();
  const paused = sim.useUi((x) => x.view.paused),
    setView = sim.useUi((x) => x.setView);
  return (
    <>
      <Toggle on={v.xray} title="See through the castings" onClick={() => v.set({ xray: !v.xray })}>
        X-ray
      </Toggle>
      <Toggle on={v.labels} title="Name the main parts" onClick={() => v.set({ labels: !v.labels })}>
        Labels
      </Toggle>
      <Toggle on={v.flow} title="Show the air and fuel moving through" onClick={() => v.set({ flow: !v.flow })}>
        Flow
      </Toggle>
      <Toggle on={paused} title="Freeze the simulation" onClick={() => setView({ paused: !paused })}>
        Pause
      </Toggle>
    </>
  );
}

/** What the carburetor is doing, over the foot of the view. */
function Readout() {
  const r = useLiveSnapshot(live, 150);
  const big: [string, string, string, string?][] = [
    ["RPM", f0(r.rpm), ""],
    ["MAP", r.map.toFixed(1), "inHg"],
    ["FF", ((r.main + r.idle) / AVGAS_LB_GAL).toFixed(1), "gph"],
    ["Ice", f0(r.ice * 100), "%", r.ice > 0.2 ? "bad" : r.ice > 0.02 ? "warnc" : ""],
  ];
  const small: [string, string, string?][] = [
    ["Main lb/h", f0(r.main)],
    ["Idle lb/h", f0(r.idle)],
    ["Pump", r.squirt > 0.05 ? "squirting" : "–"],
    ["Inlet °F", f0(degF(r.inletC))],
    ["Mixture °F", f0(degF(r.chamberC)), r.chamberC < 0 ? "warnc" : ""],
    ["Fuel psi", r.fuelPsi.toFixed(1), r.fuelPsi < 0.5 && r.rpm > 100 ? "bad" : ""],
    ["Bowl %", f0(r.bowl * 100), r.bowl < 0.5 ? "bad" : ""],
    ["Air lb/h", f0(r.air)],
  ];
  return (
    <div className="eng-mon carb-mon" aria-label="Carburetor readout">
      <div className="mon-big">
        {big.map(([l, v, u, c]) => (
          <div key={l}>
            <span>{l}</span>
            <b className={c}>{v}</b>
            <i>{u}</i>
          </div>
        ))}
      </div>
      <div className="mon-small">
        {small.map(([l, v, c]) => (
          <div key={l}>
            <span>{l}</span>
            <b className={c}>{v}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CarburetorApp() {
  const sim = carbSim();
  useCarbLoop(sim);
  return (
    <ComponentShell
      id="carburetor"
      scene={<Scene />}
      toolbar={<Toolbar />}
      foot={<Readout />}
      panel={<CarburetorPanel sim={sim} />}
    />
  );
}
