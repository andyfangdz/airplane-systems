"use client";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Readouts, Slider } from "@/components/ui/controls";
import { refreshLiveSnapshot, useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { advanceAngle, cylinderAt } from "@/engines/components/piston-cylinder/model";
import { ComponentShell } from "../ComponentShell";
import { Toggle } from "../chrome";
import { useSimLoop } from "../sim";
import "./piston.css";

const Scene = dynamic(() => import("./PistonCylinderScene"), { ssr: false });
export type CylinderPlayback = { angle: number };
const STROKES = ["power", "exhaust", "intake", "compression"] as const;
const NOTES = {
  power: "Expanding gas drives the piston down, turning the crankshaft through the connecting rod.",
  exhaust: "The rising piston pushes spent gas through the open exhaust valve.",
  intake: "The descending piston draws a fresh charge through the open intake valve.",
  compression: "The piston rises to compress the trapped charge. Ignition starts before top dead centre.",
};

export default function PistonCylinderApp() {
  const [live] = useState<CylinderPlayback>(() => ({ angle: 0 }));
  const [paused, setPaused] = useState(false);
  const [labels, setLabels] = useState(true);
  const [rpm, setRpm] = useState(10);
  const advance = useCallback(
    (dt: number) => {
      live.angle = advanceAngle(live.angle, dt, rpm);
    },
    [live, rpm],
  );
  useSimLoop(advance, 0.1, !paused);
  const snapshot = useLiveSnapshot(live, 100);
  const x = cylinderAt(snapshot.angle);
  const seek = (angle: number) => {
    setPaused(true);
    live.angle = angle;
    refreshLiveSnapshot(live);
  };
  return (
    <ComponentShell
      id="piston-cylinder"
      scene={<Scene live={live} labels={labels} />}
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
          <span>Slow-motion teaching cycle</span>
        </div>
      }
      panel={
        <div className="piston-panel">
          <h2>Inside the cylinder</h2>
          <p>Follow one cylinder through two crankshaft revolutions. Drag to orbit; scroll to zoom.</p>
          <h3>Cycle controls</h3>
          <Slider
            id="piston-speed"
            label="Playback speed"
            min={2}
            max={30}
            step={1}
            value={rpm}
            onChange={setRpm}
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
              setRpm(10);
            }}
          >
            Reset to firing TDC
          </button>
          <h3 className="piston-stroke-title">{x.stroke}</h3>
          <p>{NOTES[x.stroke]}</p>
          <Readouts
            items={[
              ["Travel from TDC", `${x.travelMm.toFixed(1)} mm`],
              ["Chamber volume", `${x.volumeCc.toFixed(0)} cm³`],
              ["Intake valve", x.valves.intake > 0.001 ? "Open" : "Closed"],
              ["Exhaust valve", x.valves.exhaust > 0.001 ? "Open" : "Closed"],
              ["Ignition", x.spark ? "Spark" : "—"],
            ]}
          />
          <h3>How to read the cutaway</h3>
          <p>
            Blue is intake, violet is compression, orange is power, and grey is exhaust. Valve timing extends beyond the
            nominal strokes, including overlap near exhaust TDC.
          </p>
          <h3>Sources & model limits</h3>
          <p>
            IO-390-C geometry and ignition timing: Lycoming Installation and Operation Manual, January 2017, Table A-1,
            pp. 51–52. Rod length and valve events are illustrative assumptions shared with the engine model.
          </p>
          <p>
            This is a kinematic study aid. Shapes, valve lift and colours are schematic; playback rpm is not operating
            engine speed. Pressure, combustion and engine performance are not simulated.
          </p>
          <a
            href="https://www.lycoming.com/sites/default/files/attachments/IOM-IO-390-C%2520Series%2520-%25201-31-17.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Lycoming IO-390-C manual ↗
          </a>
        </div>
      }
    />
  );
}
