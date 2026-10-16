"use client";
/**
 * The SureFly SIM page: the module on a bench in 3D with its LED, timing and a timing dial over it, and a panel to set
 * its dip switch, time it to the engine (SF1001 §2.7–2.11) and run it.
 */
import dynamic from "next/dynamic";
import { ComponentShell } from "../ComponentShell";
import { ViewToggles } from "../chrome";
import { f0 } from "@/lib/format";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { MAX_ADVANCE, readDip, ledCodeText } from "@/engines/components/surefly/model";
import { bench, useBenchLoop, useSfView, useUi } from "./store";
import { SureFlyPanel } from "./Panel";
import "./surefly.css";

const Scene = dynamic(() => import("./Scene"), { ssr: false, loading: () => <div /> });

const TOGGLES = [
  ["xray", "X-ray", "See through the case to the shaft, sensors and coils"],
  ["labels", "Labels", "Name the main parts"],
  ["slow", "Slow motion", "Turn the drawn shaft slowly enough to see each spark"],
  ["paused", "Pause", "Freeze the bench"],
] as const;

function Toolbar() {
  const view = useSfView();
  return <ViewToggles items={TOGGLES} view={view} set={view.set} />;
}

/** The crank angle on a degree wheel: #1's top centre, where it fires now, data-plate timing and the 38° ceiling. */
function Dial({ crank, btdc, fires, plate }: { crank: number; btdc: number; fires: boolean; plate: number }) {
  // clockwise from the top, as the crank turns seen from the front (schematic)
  const at = (deg: number, r: number) => {
    const a = (deg - 90) * (Math.PI / 180);
    return [50 + r * Math.cos(a), 50 + r * Math.sin(a)] as const;
  };
  const tick = (deg: number, r0: number, r1: number) => {
    const [x0, y0] = at(deg, r0),
      [x1, y1] = at(deg, r1);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const ticks = Array.from({ length: 36 }, (_, i) => tick(i * 10, i % 9 ? 41 : 37, 45)).join("");
  const a = crank % 360;
  // #1's compression top centre is at 0 (720): power, exhaust, intake, then compression
  const stroke = ["power", "exhaust", "intake", "compression"][Math.floor((((crank % 720) + 720) % 720) / 180)];
  return (
    <svg className="sf-dial" viewBox="0 0 100 100" role="img" aria-label={`Crank ${f0(a)}° after #1 top centre`}>
      <circle cx="50" cy="50" r="45" className="face" />
      <path d={ticks} className="ticks" />
      <path d={tick(-MAX_ADVANCE, 30, 45)} className="max" />
      <path d={tick(-plate, 30, 45)} className="plate" />
      {fires && <path d={tick(-btdc, 22, 46)} className="spark" />}
      <path d={tick(0, 28, 47)} className="tdc" />
      <path d={tick(a, 0, 40)} className="needle" />
      <circle cx="50" cy="50" r="2.5" className="hub" />
      <text x="50" y="31" textAnchor="middle">
        TDC
      </text>
      <text x="50" y="66" textAnchor="middle" className="small">
        #1 {stroke}
      </text>
    </svg>
  );
}

function Readout() {
  const b = useLiveSnapshot(bench, 100);
  const dip = useUi((x) => x.dip),
    stage = useUi((x) => x.stage);
  const { mode, timing } = readDip(dip);
  // the LED changes faster than the snapshot: it gets its own fast sample
  const fast = useLiveSnapshot(bench, 40);
  // the spark the crank sees: the SIM's timing less its sync error when it is clocked off
  const actual = b.btdc - b.err;
  return (
    <div className="eng-mon sf-mon" aria-label="SIM readout">
      <Dial crank={b.crank} btdc={actual} fires={b.fires} plate={timing} />
      <div className="mon-big">
        <div>
          <span>Timing</span>
          <b className={b.fires ? "" : "warnc"}>{b.fires ? actual.toFixed(1) : "–"}</b>
          <i>° BTDC</i>
        </div>
        <div>
          <span>RPM</span>
          <b>{f0(b.rpm)}</b>
          <i />
        </div>
        <div>
          <span>MAP</span>
          <b>{b.sensed.toFixed(1)}</b>
          <i>inHg</i>
        </div>
        <div>
          <span>LED</span>
          <b className={`sf-led${fast.led ? " on" : ""}`} aria-label={fast.led ? "LED on" : "LED off"} />
          <i>{stage === "time" ? "timing" : ledCodeText(dip)}</i>
        </div>
      </div>
      <div className="sf-why">
        {mode === "advance" ? "Advance" : "Fixed"} {timing}° · {b.why}
      </div>
    </div>
  );
}

export default function SureFlyApp() {
  useBenchLoop();
  return (
    <ComponentShell id="surefly" scene={<Scene />} toolbar={<Toolbar />} foot={<Readout />} panel={<SureFlyPanel />} />
  );
}
