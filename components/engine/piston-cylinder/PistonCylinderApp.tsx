"use client";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Readouts, Slider, Seg } from "@/components/ui/controls";
import { refreshLiveSnapshot, useLiveSnapshot } from "@/lib/useLiveSnapshot";
import {
  createCylinderBench,
  cylinderAt,
  benchValves,
  BENCH_SCENARIOS,
  type BenchControls,
  type BenchScenario,
  type Ignition,
  type ValveFault,
} from "@/engines/components/piston-cylinder/model";
import { IO390 } from "@/engines/io390/spec";
import { ComponentShell } from "../ComponentShell";
import { Toggle } from "../chrome";
import { useSimLoop } from "../sim";
import "./piston.css";

const Scene = dynamic(() => import("./PistonCylinderScene"), { ssr: false });

const STROKES = ["power", "exhaust", "intake", "compression"] as const;
const NOTES = {
  power: "Expanding gas drives the piston down, turning the crankshaft through the connecting rod.",
  exhaust: "The rising piston pushes spent gas through the open exhaust valve.",
  intake: "The descending piston draws a fresh charge through the open intake valve.",
  compression: "The piston rises to compress the trapped charge. Ignition starts before top dead centre.",
};

export default function PistonCylinderApp() {
  const [bench] = useState(createCylinderBench);
  const [controls, setControls] = useState(() => ({ ...bench.c }));
  const [scenario, setScenario] = useState<BenchScenario | null>("normal");
  const [paused, setPaused] = useState(false);
  const [labels, setLabels] = useState(true);
  const advance = useCallback((dt: number) => bench.advance(dt), [bench]);
  useSimLoop(advance, 0.25, !paused);
  const snapshot = useLiveSnapshot(bench.s, 100);
  const x = cylinderAt(snapshot.angle);
  const valves = benchValves(snapshot.angle, controls);
  const change = (patch: Partial<BenchControls>) => {
    bench.set(patch);
    setControls({ ...bench.c });
    setScenario(null);
    refreshLiveSnapshot(bench.s);
  };
  const choose = (id: BenchScenario) => {
    bench.scenario(id);
    setControls({ ...bench.c });
    setScenario(id);
    setPaused(false);
    refreshLiveSnapshot(bench.s);
  };
  const seek = (angle: number) => {
    setPaused(true);
    bench.s.angle = angle;
    refreshLiveSnapshot(bench.s);
  };
  const valveOptions: [ValveFault, string][] = [
    ["free", "Free"],
    ["open", "Stuck open"],
    ["closed", "Stuck closed"],
  ];
  const plugStatus = (i: number) => (snapshot.deposits[i] >= 0.8 ? "Fouled" : snapshot.sparks[i] ? "Firing" : "Off");
  return (
    <ComponentShell
      id="piston-cylinder"
      scene={<Scene live={bench.s} controls={controls} labels={labels} />}
      toolbar={
        <>
          <Toggle on={labels} title="Name the main parts" onClick={() => setLabels(!labels)}>
            Labels
          </Toggle>
          <Toggle on={paused} title="Freeze the cycle" onClick={() => setPaused(!paused)}>
            Pause
          </Toggle>
        </>
      }
      foot={
        <div className="eng-mon piston-monitor">
          <strong>{x.stroke}</strong>
          <span>{x.phase.toFixed(0)}° / 720°</span>
          <span className={snapshot.cht > IO390.limits.chtMax.value ? "piston-hot" : ""}>
            CHT <b>{snapshot.cht.toFixed(0)}°F</b>
          </span>
          <span>
            EGT <b>{snapshot.egt.toFixed(0)}°F</b>
          </span>
        </div>
      }
      panel={
        <div className="piston-panel">
          <h2>Inside the cylinder</h2>
          <p>Follow one cylinder through two crankshaft revolutions. Drag to orbit; scroll to zoom.</p>
          <h3>Operating conditions</h3>
          <p>A driven single-cylinder bench: shaft speed and charge are held externally so faults remain visible.</p>
          <Slider
            id="piston-engine-rpm"
            label="Shaft speed"
            min={0}
            max={2700}
            step={50}
            value={controls.rpm}
            onChange={(v) => change({ rpm: v })}
            fmt={(v) => `${v} rpm`}
          />
          <Slider
            id="piston-load"
            label="Cylinder charge"
            min={0.1}
            max={1}
            step={0.01}
            value={controls.load}
            onChange={(v) => change({ load: v })}
            fmt={(v) => `${(v * 100).toFixed(0)}%`}
          />
          <Slider
            id="piston-mixture"
            label="Fuel / air mixture"
            min={0}
            max={2.1}
            step={0.01}
            value={controls.phi}
            onChange={(v) => change({ phi: v })}
            fmt={(v) =>
              v === 0 ? "Fuel cut-off" : `φ ${v.toFixed(2)} · ${v < 1 ? "lean" : v > 1 ? "rich" : "stoichiometric"}`
            }
          />
          <p>
            φ = 1 is the chemically balanced fuel/air ratio; higher adds fuel. This bench control is not a cockpit
            mixture-lever calibration.
          </p>
          <Seg<Ignition>
            id="piston-ignition"
            label="Ignition"
            options={[
              ["both", "Both plugs"],
              ["top", "Top only"],
              ["bottom", "Bottom only"],
              ["off", "Off"],
            ]}
            value={controls.ignition}
            onChange={(v) => change({ ignition: v })}
          />
          <h3>Cylinder monitor</h3>
          <Readouts
            items={[
              ["CHT", `${snapshot.cht.toFixed(0)} °F`],
              ["EGT", `${snapshot.egt.toFixed(0)} °F`],
              ["Fuel / cylinder", `${snapshot.fuelGph.toFixed(2)} gph`],
              ["Relative work", `${(snapshot.work * 100).toFixed(0)}%`],
              ["Roughness", `${(snapshot.roughness * 100).toFixed(0)}%`],
              ["Combustion", snapshot.firing ? "Burning" : "No useful burn"],
            ]}
          />
          <div className="piston-thermal" aria-label="Cylinder temperatures">
            <label>
              CHT <meter min={59} max={500} high={IO390.limits.chtMax.value} optimum={350} value={snapshot.cht} />
            </label>
            <label>
              EGT <meter min={59} max={1700} value={snapshot.egt} />
            </label>
          </div>
          {snapshot.cht > IO390.limits.chtMax.value && (
            <p role="status" className="piston-hot">
              CHT exceeds the IO-390-C 465°F limit (IOM Table A-2, p. 53).
            </p>
          )}
          <p>
            EGT responds in seconds; CHT retains heat. Absolute temperatures and relative work are model estimates. EGT
            has no limit inferred from this display.
          </p>
          <h3>Scenarios</h3>
          <div className="piston-scenarios" role="group" aria-label="Cylinder scenarios">
            {BENCH_SCENARIOS.map((s) => (
              <button className="btn" key={s.id} aria-pressed={scenario === s.id} onClick={() => choose(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
          <p>
            {BENCH_SCENARIOS.find((s) => s.id === scenario)?.note ??
              "Custom conditions. Adjust mixture, ignition or valves and compare the response."}
          </p>
          <h3>Spark plugs & valves</h3>
          <Readouts
            items={[
              ["Top plug", plugStatus(0)],
              ["Bottom plug", plugStatus(1)],
              ["Top deposits", `${(snapshot.deposits[0] * 100).toFixed(0)}%`],
              ["Bottom deposits", `${(snapshot.deposits[1] * 100).toFixed(0)}%`],
            ]}
          />
          <button
            className="btn"
            onClick={() => {
              bench.service();
              setScenario(null);
              refreshLiveSnapshot(bench.s);
            }}
          >
            Service plugs
          </button>
          <p>
            Deposits darken the electrodes and suppress the spark when fouled. Accumulation is accelerated and
            illustrative; Service plugs represents maintenance, not an in-flight procedure.
          </p>
          <Seg<ValveFault>
            id="piston-intake"
            label="Intake valve fault"
            options={valveOptions}
            value={controls.intake}
            onChange={(v) => change({ intake: v })}
          />
          <Seg<ValveFault>
            id="piston-exhaust"
            label="Exhaust valve fault"
            options={valveOptions}
            value={controls.exhaust}
            onChange={(v) => change({ exhaust: v })}
          />
          <h3>Cycle controls</h3>
          <Slider
            id="piston-speed"
            label="Playback speed"
            min={2}
            max={30}
            step={1}
            value={controls.playback}
            onChange={(v) => change({ playback: v })}
            fmt={(v) => `${v} rpm (animation)`}
          />
          <Slider
            id="piston-angle"
            label="Crank angle · drag to pause"
            min={0}
            max={719}
            step={1}
            value={Math.floor(x.phase)}
            onChange={seek}
            fmt={(v) => `${v}°`}
          />
          <div className="piston-strokes" role="group" aria-label="Jump to stroke">
            {STROKES.map((s, i) => (
              <button className="btn" key={s} aria-pressed={x.stroke === s} onClick={() => seek(i * 180 + 90)}>
                {s}
              </button>
            ))}
          </div>
          <button
            className="btn"
            onClick={() => {
              seek(0);
              change({ playback: 10 });
            }}
          >
            Reset to firing TDC
          </button>
          <h3 className="piston-stroke-title">{x.stroke}</h3>
          <p>
            {x.stroke === "power" && !snapshot.firing
              ? "No useful combustion under the current conditions. The external bench drive continues moving the piston."
              : NOTES[x.stroke]}
          </p>
          <Readouts
            items={[
              ["Travel from TDC", `${x.travelMm.toFixed(1)} mm`],
              ["Chamber volume", `${x.volumeCc.toFixed(0)} cm³`],
              ["Intake valve", valves.intake > 0.001 ? "Open" : "Closed"],
              ["Exhaust valve", valves.exhaust > 0.001 ? "Open" : "Closed"],
              ["Ignition", x.spark && snapshot.sparks.some(Boolean) ? "Spark" : "—"],
            ]}
          />
          <h3>How to read the cutaway</h3>
          <p>
            Blue is intake, violet is compression, orange is power, and grey is exhaust. Valve timing extends beyond the
            nominal strokes, including overlap near exhaust TDC.
          </p>
          <h3>Sources & model limits</h3>
          <p>
            IO-390-C geometry and ignition timing: Lycoming Installation and Operation Manual, January 2017, Tables
            A-1/A-2, pp. 51–53; dual ignition and fouling: pp. 2, 37–38. Rod length and valve events are illustrative
            assumptions shared with the engine model.
          </p>
          <p>
            Mixture, dual-ignition and thermal response reuse the engine model’s calibrated relationships. The bench
            holds shaft speed and charge constant; it does not predict aircraft performance. Fouling rates, failure
            severity, valve lift and geometry details are illustrative. A stuck valve disables useful combustion in this
            simplified model; trapped-gas transients and mechanical damage are not solved.
          </p>
          <a
            href="https://www.lycoming.com/sites/default/files/attachments/IOM-IO-390-C%2520Series%2520-%25201-31-17.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Lycoming IO-390-C manual ↗
          </a>
          <p>
            Fouling mechanism: FAA Powerplant Handbook, pp. 4-33–4-34. Sticking valves: Figure 3-8, p. 3-5. Fault rates
            and severity here are illustrative.
          </p>
          <a
            href="https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/amt_powerplant_handbook.pdf"
            target="_blank"
            rel="noreferrer"
          >
            FAA Powerplant Handbook ↗
          </a>
        </div>
      }
    />
  );
}
