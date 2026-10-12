"use client";
/** Common accessible study controls; all inspection wording, order, sources and targets come from the selected airplane. */
import { useEffect, useMemo, useRef, type TouchEvent } from "react";
import { Pin } from "./scene/Part";
import { WalkSceneContent } from "@/components/ui/WalkSceneContent";
import { useTicker } from "./ui/controls";
import { fleetStationStart, fleetStepSide, fleetTally, fleetWalkClock, type FleetWalkStep } from "@/lib/fleet-walk";
import type { FleetWalkController, FleetWalkPhase } from "@/lib/fleet-walk-store";
import { SPOT_COLOR } from "@/lib/spot";
import { revealStage, useView } from "@/lib/view";
import "@/aircraft/sr22t/panels/walkaround.css";
import "./fleet-walkaround.css";

const NOTICE = "Study aid · use the approved checklist for your aircraft.";
function useStepScene<S>(
  controller: FleetWalkController<S>,
  step: FleetWalkStep<S> | undefined,
  phase: FleetWalkPhase,
) {
  const previousStation = useRef<number | null>(null);
  useEffect(() => {
    const { flyTo } = useView.getState();
    if (!step) {
      useView.setState({ spot: null, sys: "overview" });
      const [p, t] =
        phase === "done"
          ? controller.systems[0].cam
          : [controller.logic.data.stations[0].cam.p, controller.logic.data.stations[0].cam.t];
      flyTo(p, t);
      previousStation.current = null;
      return;
    }
    useView.setState({
      sys: step.item.system,
      spot: { names: controller.logic.stepParts(step).shown, side: fleetStepSide(step) },
      focus: null,
    });
    const pose = controller.logic.stepPose(step);
    if (previousStation.current === step.station.n) {
      flyTo(pose.p, pose.t);
      return;
    }
    previousStation.current = step.station.n;
    flyTo(step.station.cam.p, step.station.cam.t);
    const timer = setTimeout(() => useView.getState().flyTo(pose.p, pose.t), 1100);
    return () => clearTimeout(timer);
  }, [controller, step, phase]);
}
function useSession<S>(controller: FleetWalkController<S>, at: number, walking: boolean) {
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (document.querySelector(".tour")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        controller.close();
        return;
      }
      const target = document.activeElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      )
        return;
      if (walking && event.key === "ArrowRight") controller.goStep(at + 1);
      else if (walking && event.key === "ArrowLeft") controller.goStep(at - 1);
      else return;
      event.preventDefault();
    };
    addEventListener("keydown", keyboard);
    return () => removeEventListener("keydown", keyboard);
  }, [controller, at, walking]);
  useEffect(() => {
    addEventListener("pagehide", controller.checkpoint);
    return () => removeEventListener("pagehide", controller.checkpoint);
  }, [controller]);
}
function useSwipe<S>(controller: FleetWalkController<S>, at: number) {
  const first = useRef<{ x: number; y: number } | null>(null);
  return {
    onTouchStart: (event: TouchEvent) => {
      const t = event.touches[0];
      first.current = t ? { x: t.clientX, y: t.clientY } : null;
    },
    onTouchEnd: (event: TouchEvent) => {
      const a = first.current,
        b = event.changedTouches[0];
      first.current = null;
      if (!a || !b) return;
      const x = b.clientX - a.x,
        y = b.clientY - a.y;
      if (Math.abs(x) > 60 && Math.abs(x) > 1.5 * Math.abs(y)) controller.goStep(x < 0 ? at + 1 : at - 1);
    },
  };
}
function MiniMap<S>({
  controller,
  at,
  marks,
}: {
  controller: FleetWalkController<S>;
  at: number;
  marks: Record<string, string>;
}) {
  const { data, steps } = controller.logic;
  return (
    <svg className="walk-map" viewBox="-80 -65 160 125" role="group" aria-label={`${data.short} preflight stations`}>
      <title>{data.short}: approximate station map, nose up</title>
      <path d="M-3,-34 L-6,-18 L-6,19 L-2,39 L2,39 L6,19 L6,-18 L3,-34 Z" className="fus" />
      <path
        d="M-6,-8 L-58,-6 L-58,3 L-6,7 Z M6,-8 L58,-6 L58,3 L6,7 Z M-19,27 L19,27 L19,33 L-19,33 Z"
        className="wing"
      />
      {data.stations.map((station) => {
        const own = steps.filter((step) => step.station === station),
          done = own.every((step) => marks[step.item.id]),
          current = steps[at]?.station === station;
        return (
          <g
            key={station.n}
            className={`stn${current ? " cur" : ""}${done ? " done" : ""}`}
            transform={`translate(${station.map[1] * 10},${-station.map[0] * 10})`}
            role="button"
            tabIndex={0}
            aria-label={`Station ${station.n}: ${station.title}${done ? ", reviewed" : ""}`}
            aria-current={current ? "step" : undefined}
            onClick={() => controller.goStep(fleetStationStart(steps, station.n))}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                controller.goStep(fleetStationStart(steps, station.n));
              }
            }}
          >
            <circle r={7.5} />
            <text dy="3.4">{done ? "✓" : station.n}</text>
          </g>
        );
      })}
    </svg>
  );
}
function Intro<S>({ controller }: { controller: FleetWalkController<S> }) {
  const from = controller.useWalk((w) => w.from),
    { data } = controller.logic,
    completed = from === 1 && controller.logic.loadProgress()?.done;
  return (
    <>
      <p className="walk-notice" role="note">
        <b>{NOTICE}</b> {data.applicability}
      </p>
      <div className="walk-warn" role="note">
        <b>Before inspection</b>
        <p>{data.general}</p>
        <ul>
          {data.throughout.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
      </div>
      <div className="walk-actions">
        {completed && (
          <button type="button" className="btn" onClick={controller.resume}>
            Review previous walk
          </button>
        )}
        <button type="button" className="walk-go" onClick={controller.begin}>
          {from > 1 ? `Begin at station ${from}` : "Begin study walk"}
        </button>
      </div>
    </>
  );
}
function Resume<S>({ controller }: { controller: FleetWalkController<S> }) {
  const { data, steps, loadProgress } = controller.logic,
    saved = loadProgress(),
    step = steps.find((s) => s.item.id === saved?.at);
  return (
    <>
      <p className="walk-notice">
        <b>{NOTICE}</b>
      </p>
      <h3 className="walk-q">Resume {data.short} study walk?</h3>
      {step && (
        <p>
          Saved at station {step.station.n}, {step.station.title}: {step.item.id} {step.item.text}.
        </p>
      )}
      <div className="walk-actions">
        <button type="button" className="walk-go" onClick={controller.resume}>
          Resume
        </button>
        <button type="button" className="btn" onClick={controller.reset}>
          Start over
        </button>
      </div>
    </>
  );
}
function Item<S>({ controller, step, at }: { controller: FleetWalkController<S>; step: FleetWalkStep<S>; at: number }) {
  const big = controller.useWalk((w) => w.big);
  const marks = controller.useWalk((w) => w.marks),
    swipe = useSwipe(controller, at),
    { station, item } = step;
  const { data, steps, stepParts } = controller.logic,
    own = steps.filter((s) => s.station === station),
    index = own.indexOf(step),
    missing = stepParts(step).missing;
  return (
    <div className="walk-item" {...swipe}>
      <div className="walk-prog" aria-live="polite">
        Station {station.n} of {data.stations.length} · item {index + 1} of {own.length}
      </div>
      <div
        className="walk-bar"
        role="progressbar"
        aria-label="Study position"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={at + 1}
      >
        <i style={{ width: `${(100 * (at + 1)) / steps.length}%` }} />
      </div>
      <MiniMap controller={controller} at={at} marks={marks} />
      <h3 className="walk-stn">
        {station.n}. {station.title}
      </h3>
      {station.warning && (
        <p className="walk-alert warning" role="note">
          <b>Warning</b> {station.warning}
        </p>
      )}
      {station.note && index === 0 && (
        <p className="walk-note">
          <b>Note</b> {station.note}
        </p>
      )}
      <div className="walk-card">
        <WalkSceneContent big={big}>
          <div className="walk-current" key={item.id} tabIndex={0} role="group" aria-label="Current checklist item">
            <div className="walk-line">
              <span className="walk-id">{item.id}</span>
              <span className="walk-text">{item.text}</span>
              {marks[item.id] && (
                <span className={`walk-mark ${marks[item.id]}`}>
                  {marks[item.id] === "ok" ? "✓ Reviewed" : "Skipped"}
                </span>
              )}
            </div>
            <div className="walk-std">{item.standard}</div>
          </div>
        </WalkSceneContent>
        {item.note && (
          <p className="walk-note">
            <b>Note</b> {item.note}
          </p>
        )}
        {item.why && <p className="walk-why">{item.why}</p>}
        {missing.length > 0 && (
          <p className="walk-nm">
            Physical detail outside the model: {missing.map((name) => `${name} (${data.missing[name]})`).join("; ")}
          </p>
        )}
        <a className="walk-ref" href={item.sourceUrl ?? data.sourceUrl} target="_blank" rel="noreferrer">
          {item.ref} · {data.short}
        </a>
      </div>
      <details className="walk-through">
        <summary>Throughout the walk-around</summary>
        <ul>
          {data.throughout.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        <span className="walk-ref">{data.source}</span>
      </details>
      <WalkSceneContent big={big}>
        <div className="walk-actions">
          <button
            type="button"
            className="walk-nav"
            aria-label="Previous item"
            disabled={at === 0}
            onClick={() => controller.goStep(at - 1)}
          >
            ←
          </button>
          <button type="button" className="btn walk-skip" onClick={() => controller.mark("skip")}>
            Skip
          </button>
          <button type="button" className="walk-go" onClick={() => controller.mark("ok")}>
            ✓ Reviewed
          </button>
          <button
            type="button"
            className="walk-nav"
            aria-label="Next item"
            disabled={at === steps.length - 1}
            onClick={() => controller.goStep(at + 1)}
          >
            →
          </button>
        </div>
      </WalkSceneContent>
    </div>
  );
}
function Done<S>({ controller }: { controller: FleetWalkController<S> }) {
  const w = controller.useWalk(),
    counts = fleetTally(controller.logic.steps, w.marks);
  return (
    <div className="walk-done">
      <h3 className="walk-q">Study walk complete</h3>
      <dl className="walk-sum">
        <dt>Reviewed</dt>
        <dd>{counts.ok}</dd>
        <dt>Skipped</dt>
        <dd>{counts.skip}</dd>
        <dt>Unmarked</dt>
        <dd>{counts.open}</dd>
        <dt>Time</dt>
        <dd>{fleetWalkClock(controller.elapsed(w))}</dd>
      </dl>
      <p className="walk-next">{controller.logic.data.next}</p>
      <p className="walk-notice">
        <b>{NOTICE}</b>
      </p>
      <div className="walk-actions">
        <button type="button" className="btn" onClick={() => controller.goStep(controller.logic.steps.length - 1)}>
          Review items
        </button>
        <button type="button" className="btn" onClick={controller.reset}>
          Reset
        </button>
        <button type="button" className="walk-go" onClick={controller.close}>
          Exit
        </button>
      </div>
    </div>
  );
}
export function FleetWalkPanel<S>({ controller }: { controller: FleetWalkController<S> }) {
  const phase = controller.useWalk((w) => w.phase),
    at = controller.useWalk((w) => w.at),
    big = controller.useWalk((w) => w.big);
  const { data, steps } = controller.logic,
    step = phase === "walk" ? steps[at] : undefined;
  useTicker(1000);
  useStepScene(controller, step, phase);
  useSession(controller, at, phase === "walk");
  useEffect(revealStage, [at, phase]);
  return (
    <div className={`walk fleet-walkaround${big ? " walk-big" : ""}`}>
      <div className="walk-hd">
        <span className="walk-title">{data.short} preflight study walk</span>
        <button
          type="button"
          className="walk-x"
          aria-label={`Exit the ${data.short} study walk`}
          onClick={controller.close}
        >
          Exit
        </button>
      </div>
      {phase === "intro" ? (
        <Intro controller={controller} />
      ) : phase === "resume" ? (
        <Resume controller={controller} />
      ) : phase === "done" ? (
        <Done controller={controller} />
      ) : step ? (
        <Item controller={controller} step={step} at={at} />
      ) : null}
      <div className="walk-ft">
        <label className="walk-opt">
          <input type="checkbox" checked={big} onChange={(event) => controller.setBig(event.target.checked)} /> Larger
          text
        </label>
        <span className="walk-src">
          <a href={data.sourceUrl} target="_blank" rel="noreferrer">
            {data.source}
          </a>
        </span>
      </div>
    </div>
  );
}
export function FleetWalkMarker<S>({ controller }: { controller: FleetWalkController<S> }) {
  const walking = useView((v) => v.walking && v.ac === controller.logic.data.id),
    phase = controller.useWalk((w) => w.phase),
    at = controller.useWalk((w) => w.at);
  const step = walking && phase === "walk" ? controller.logic.steps[at] : undefined;
  const centre = useMemo(() => (step ? controller.logic.stepCentroid(step) : null), [controller, step]);
  return step && centre ? <Pin at={centre} label={`${step.item.id} ${step.item.text}`} color={SPOT_COLOR} /> : null;
}
