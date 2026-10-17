"use client";
/**
 * The preflight study walk panel and scene markers shared by every airplane; all inspection wording, order, sources and
 * targets come from the selected airplane's data. The panel replaces the system panel while open: on desktops it sits in
 * the right-hand panel, on phones under a shortened 3D view. Each item flies the camera to its station and then to the
 * item's parts, highlights them, dims the rest and shows the item's system in X-ray.
 */
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type TouchEvent } from "react";
import * as THREE from "three";
import { useStore } from "zustand";
import { Pin } from "./scene/Part";
import { WalkSceneContent } from "@/components/ui/WalkSceneContent";
import { fleetStationStart, fleetTally, fleetWalkClock, WALK_MAP_MARK_R, type FleetWalkStep } from "@/lib/fleet-walk";
import type { FleetWalkController, FleetWalkPhase } from "@/lib/fleet-walk-store";
import { useAircraftSceneReady } from "@/lib/aircraft-session";
import { view as scene } from "@/lib/registry";
import { SPOT_COLOR } from "@/lib/spot";
import { revealStage, useView, type AircraftSessionOwner } from "@/lib/view";
import "./walkaround.css";

/** Wait after flying to a station before framing the item, ms (the camera flight takes 1 s). */
const STATION_SETTLE_MS = 1100;

/** Keep the screen awake while the walk is open; a refusal (or no Wake Lock support) is ignored. */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<Sentinel> } }).wakeLock;
    if (!wl) return;
    let lock: Sentinel | null = null,
      live = true;
    const request = () => {
      if (document.visibilityState !== "visible") return;
      wl.request("screen").then(
        (l) => {
          if (live) lock = l;
          else l.release().catch(() => {});
        },
        () => {},
      );
    };
    request();
    // the browser drops the lock when the page is hidden; take it again on return
    document.addEventListener("visibilitychange", request);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", request);
      lock?.release().catch(() => {});
    };
  }, []);
}
/** Camera, highlight and X-ray system for the current step. */
function useStepScene<S>(
  controller: FleetWalkController<S>,
  step: FleetWalkStep<S> | undefined,
  phase: FleetWalkPhase,
) {
  const previousStation = useRef<number | null>(null);
  const ready = useAircraftSceneReady(controller.logic.data.id);
  const canFrame = !!step && ready;
  const deferred = useRef<{
    owner: AircraftSessionOwner | null;
    step: FleetWalkStep<S>;
    moves: number;
    cam: number | undefined;
  } | null>(null);
  useEffect(() => {
    const { flyTo, session: owner, walking } = useView.getState();
    const session = controller.session();
    if (!walking || !session.prior || (owner && owner.aircraft !== controller.logic.data.id)) return;
    const isCurrent = () => {
      const view = useView.getState();
      return view.session === owner && view.walking && controller.session().steps === session.steps;
    };
    if (!step) {
      deferred.current = null;
      // intro and resume: the first station's view; finished: the whole airplane
      useView.setState({ spot: null, sys: "overview" });
      const first = controller.logic.data.stations[0].cam;
      const [p, t] = phase === "done" ? controller.systems[0].cam : [first.p, first.t];
      flyTo(p, t);
      previousStation.current = null;
      return;
    }
    useView.setState({
      sys: step.item.system ?? "overview",
      spot: controller.logic.stepSpot(step),
      focus: null,
    });
    if (!canFrame) {
      // The card and station selection work while assets load; exact part framing needs prepared geometry.
      flyTo(step.station.cam.p, step.station.cam.t);
      previousStation.current = step.station.n;
      deferred.current = { owner, step, moves: scene.moves, cam: useView.getState().cam?.id };
      return controller.cancelFrame;
    }
    const pending = deferred.current;
    deferred.current = null;
    if (pending?.owner === owner && pending.step === step) {
      // A camera gesture or another camera request while loading takes precedence over late item framing.
      if (pending.moves === scene.moves && pending.cam === useView.getState().cam?.id) controller.frame(step);
      return controller.cancelFrame;
    }
    if (previousStation.current === step.station.n) {
      controller.frame(step);
      return controller.cancelFrame;
    }
    // a new station: walk to it first, then look at the item
    previousStation.current = step.station.n;
    flyTo(step.station.cam.p, step.station.cam.t);
    const timer = setTimeout(() => {
      if (isCurrent()) controller.frame(step);
    }, STATION_SETTLE_MS);
    return () => {
      clearTimeout(timer);
      controller.cancelFrame();
    };
  }, [controller, step, phase, canFrame]);
}
/** Escape leaves the walk; the arrow keys step through the items, unless a form control has focus. */
function useSession<S>(controller: FleetWalkController<S>, at: number, walking: boolean) {
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (document.querySelector(".tour")) return; // the welcome tour has the keys
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
  // save when the page goes away, and when it is hidden: a phone may discard a backgrounded page without a pagehide
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden") controller.checkpoint();
    };
    addEventListener("pagehide", controller.checkpoint);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      removeEventListener("pagehide", controller.checkpoint);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [controller]);
}
/** A horizontal swipe on the card: left for the next item, right for the previous. */
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
      // approximate: swipe thresholds are a feel choice (60 px, mostly horizontal)
      if (Math.abs(x) > 60 && Math.abs(x) > 1.5 * Math.abs(y)) controller.goStep(x < 0 ? at + 1 : at - 1);
    },
  };
}
/** `**text**` in the data's wording is bold. */
function Bold({ text }: { text: string }) {
  return text.split("**").map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
}
/** Top-down outline with the stations placed around it, nose up; tap a number to go there. */
function MiniMap<S>({
  controller,
  steps,
  at,
  marks,
}: {
  controller: FleetWalkController<S>;
  steps: FleetWalkStep<S>[];
  at: number;
  marks: Record<string, string>;
}) {
  const { data, copy, sightLine } = controller.logic;
  const ready = useAircraftSceneReady(data.id);
  // airplane [x, z] → map: right wing to the right, nose up
  const px = (z: number) => z * 10,
    py = (x: number) => -x * 10;
  // an item checked from somewhere else: the line of sight from where the pilot stands
  const step = steps[at];
  const sight = useMemo(() => (ready && step ? sightLine(step) : null), [ready, sightLine, step]);
  return (
    <svg className="walk-map" viewBox={copy.map.viewBox} role="group" aria-label={copy.mapLabel}>
      <title>{copy.mapTitle}</title>
      <path d={copy.map.fuselage} className="fus" />
      <path d={copy.map.wings} className="wing" />
      {data.stations.map((station) => {
        const own = steps.filter((s) => s.station.n === station.n),
          done = own.length > 0 && own.every((s) => marks[s.item.id]),
          current = step?.station.n === station.n;
        return (
          <g
            key={station.n}
            className={`stn${current ? " cur" : ""}${done ? " done" : ""}`}
            transform={`translate(${px(station.map[1])},${py(station.map[0])})`}
            role="button"
            tabIndex={0}
            aria-label={`Station ${station.n}: ${station.title}${done ? `, ${copy.stationDone}` : ""}`}
            aria-current={current ? "step" : undefined}
            onClick={() => controller.goStep(fleetStationStart(steps, station.n))}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              controller.goStep(fleetStationStart(steps, station.n));
            }}
          >
            <circle r={WALK_MAP_MARK_R * 10} />
            <text dy="3.4">{done ? "✓" : station.n}</text>
          </g>
        );
      })}
      {/* drawn over the markers, which it may cross */}
      {sight && (
        <g className="sight" aria-label="Line of sight">
          <line x1={px(sight[0].z)} y1={py(sight[0].x)} x2={px(sight[1].z)} y2={py(sight[1].x)} />
          <circle cx={px(sight[1].z)} cy={py(sight[1].x)} r={2.2} />
        </g>
      )}
    </svg>
  );
}
function Intro<S>({ controller }: { controller: FleetWalkController<S> }) {
  const from = useStore(controller.store, (w) => w.from),
    { data, copy } = controller.logic,
    completed = from === 1 && controller.logic.loadProgress()?.done;
  return (
    <>
      <p className="walk-notice" role="note">
        <b>{copy.notice}</b> {data.applicability}
      </p>
      <div className="walk-warn" role="note">
        <b>{copy.warnTitle}</b>
        <p>{data.general}</p>
        {copy.throughoutLead && <p>{copy.throughoutLead}</p>}
        {[data.throughout, ...(copy.also ?? [])].map((list) => (
          <ul key={list[0]}>
            {list.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        ))}
        {copy.consequence && <p>{copy.consequence}</p>}
      </div>
      <div className="walk-actions">
        {completed && (
          <button type="button" className="btn" onClick={controller.resume}>
            Review previous walk
          </button>
        )}
        <button type="button" className="walk-go" onClick={controller.begin}>
          {from > 1 ? `Begin at station ${from}` : copy.begin}
        </button>
      </div>
    </>
  );
}
function Resume<S>({ controller }: { controller: FleetWalkController<S> }) {
  const steps = useStore(controller.store, (w) => w.steps),
    { copy, loadProgress } = controller.logic,
    saved = loadProgress(),
    step = steps.find((s) => s.item.id === saved?.at);
  return (
    <>
      <p className="walk-notice" role="note">
        <b>{copy.notice}</b>
      </p>
      <h3 className="walk-q">{copy.resumeTitle}</h3>
      {step && <p>{copy.resumed(step)}</p>}
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
/** The current item's card: progress, station map, the item and its notes, and the mark and step buttons. */
export function Item<S>({
  controller,
  step,
  at,
  steps,
}: {
  controller: FleetWalkController<S>;
  step: FleetWalkStep<S>;
  at: number;
  steps: FleetWalkStep<S>[];
}) {
  const big = useStore(controller.store, (w) => w.big);
  const marks = useStore(controller.store, (w) => w.marks),
    swipe = useSwipe(controller, at),
    { station, item } = step;
  const { data, copy, stepParts } = controller.logic,
    own = steps.filter((s) => s.station.n === station.n),
    index = own.indexOf(step),
    missing = stepParts(step).missing,
    mark = marks[item.id];
  const ref = copy.refSuffix ? `${item.ref} · ${copy.refSuffix}` : item.ref,
    url = item.sourceUrl ?? data.sourceUrl;
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
      <MiniMap controller={controller} steps={steps} at={at} marks={marks} />
      <h3 className="walk-stn">
        {station.n}. {station.title}
      </h3>
      {station.warning && (
        <p className={`walk-alert ${station.caution ? "caution" : "warning"}`} role="note">
          <b>{station.caution ? "Caution" : "Warning"}</b> {station.warning}
        </p>
      )}
      {station.note && index === 0 && (
        <p className="walk-note" role="note">
          <b>Note</b> {station.note}
        </p>
      )}
      <div className="walk-card">
        <WalkSceneContent big={big}>
          <div className="walk-current" key={item.id} tabIndex={0} role="group" aria-label="Current checklist item">
            <div className="walk-line">
              <span className="walk-id">{item.id}</span>
              <span className="walk-text">{item.text}</span>
              {mark && <span className={`walk-mark ${mark}`}>{mark === "ok" ? `✓ ${copy.ok}` : "Skipped"}</span>}
            </div>
            {item.technique && <span className="walk-tech">{copy.technique}</span>}
            {item.configurationCue && <span className="walk-tech">{copy.configurationCue}</span>}
            <div className="walk-std">{item.standard}</div>
          </div>
        </WalkSceneContent>
        {item.look && <p className="walk-look">{item.look}</p>}
        {item.steps && (
          <ol className="walk-steps">
            {item.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        )}
        {item.note && (
          <p className="walk-note">
            <b>Note</b> {item.note}
          </p>
        )}
        {item.why && <p className="walk-why">{item.why}</p>}
        {item.see && <p className="walk-see">{item.see}</p>}
        {missing.length > 0 && (
          <p className="walk-nm">
            {copy.missingLead} {missing.map((name) => `${name} (${data.missing[name]})`).join("; ")}
          </p>
        )}
        {url ? (
          <a className="walk-ref" href={url} target="_blank" rel="noreferrer">
            {ref}
          </a>
        ) : (
          <span className="walk-ref">{ref}</span>
        )}
      </div>
      <details className="walk-through">
        <summary>Throughout the walk-around</summary>
        <ul>
          {data.throughout.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        <span className="walk-ref">{copy.throughoutRef}</span>
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
            ✓ {copy.ok}
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
  const w = useStore(controller.store),
    { copy, data } = controller.logic,
    counts = fleetTally(w.steps, w.marks);
  return (
    <div className="walk-done">
      <h3 className="walk-q">{copy.doneTitle}</h3>
      <dl className="walk-sum">
        <dt>{copy.ok}</dt>
        <dd>{counts.ok}</dd>
        <dt>Skipped</dt>
        <dd>{counts.skip}</dd>
        <dt>{copy.unmarked}</dt>
        <dd>{counts.open}</dd>
        {counts.tech.of > 0 && (
          <>
            <dt>Technique items</dt>
            <dd>
              {counts.tech.ok} of {counts.tech.of} {copy.ok.toLowerCase()}
            </dd>
          </>
        )}
        <dt>Time</dt>
        <dd>{fleetWalkClock(controller.elapsed(w))}</dd>
      </dl>
      <p className="walk-next">
        <Bold text={data.next} />
      </p>
      <p className="walk-notice" role="note">
        <b>{copy.notice}</b>
      </p>
      <div className="walk-actions">
        <button type="button" className="btn" onClick={() => controller.goStep(w.steps.length - 1)}>
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
/** The walk in the side panel (desktop) or under the 3D view (phone). */
export function FleetWalkPanel<S>({ controller }: { controller: FleetWalkController<S> }) {
  const phase = useStore(controller.store, (w) => w.phase),
    at = useStore(controller.store, (w) => w.at),
    big = useStore(controller.store, (w) => w.big),
    steps = useStore(controller.store, (w) => w.steps);
  const { data, copy } = controller.logic,
    step = phase === "walk" ? steps[at] : undefined;
  useWakeLock();
  useStepScene(controller, step, phase);
  useSession(controller, at, phase === "walk");
  // Phones: reveal the current check after advancing or jumping stations.
  useEffect(revealStage, [at, phase]);
  return (
    <div className={`walk${big ? " walk-big" : ""}`}>
      <div className="walk-hd">
        <span className="walk-title">{copy.title}</span>
        <button type="button" className="walk-x" aria-label={copy.exit} onClick={controller.close}>
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
        <Item controller={controller} step={step} at={at} steps={steps} />
      ) : null}
      <div className="walk-ft">
        <label className="walk-opt">
          <input type="checkbox" checked={big} onChange={(event) => controller.setBig(event.target.checked)} /> Larger
          text
        </label>
        <span className="walk-src">
          {data.sourceUrl ? (
            <a href={data.sourceUrl} target="_blank" rel="noreferrer">
              {data.source}
            </a>
          ) : (
            data.source
          )}
        </span>
      </div>
    </div>
  );
}

/** Halo colour for emphasized parts: a bright accent beside the orange spot. */
export const EMPHASIS_COLOR = "#FFE14D";
/** Halo radius, m, and pulse rate, Hz. */
const HALO_R = 0.018, // approximate: display size, not a source value
  PULSE_HZ = 1.2; // approximate: display rate, not a source value
/** Arrowhead at the far end of a line of sight, m. */
const ARROW_LEN = 0.12, // approximate: display size, not a source value
  ARROW_R = 0.03; // approximate: display size, not a source value

/**
 * The walk in the scene: a label pin on the current item's parts, so small ones (drains, static ports) are easy to find;
 * the line of sight for an item checked from somewhere else; pulsing halos on an emphasized item's parts. Physical details
 * the model doesn't have stay explicit in the study card.
 */
export function FleetWalkMarker<S>({ controller }: { controller: FleetWalkController<S> }) {
  const ready = useAircraftSceneReady(controller.logic.data.id);
  const walking = useView((v) => v.walking && v.ac === controller.logic.data.id),
    phase = useStore(controller.store, (w) => w.phase),
    at = useStore(controller.store, (w) => w.at),
    steps = useStore(controller.store, (w) => w.steps);
  const step = ready && walking && phase === "walk" ? steps[at] : undefined;
  const centre = useMemo(() => (step ? controller.logic.stepCentroid(step) : null), [controller, step]);
  if (!step || !centre) return null;
  return (
    <>
      <Pin at={centre} label={`${step.item.id} ${step.item.text}`} color={SPOT_COLOR} />
      <Sight controller={controller} step={step} />
      <Halos controller={controller} step={step} />
    </>
  );
}
/** A dashed line with an arrowhead, drawn through the skin, from where the pilot stands to what they look at. */
function Sight<S>({ controller, step }: { controller: FleetWalkController<S>; step: FleetWalkStep<S> }) {
  const obj = useMemo(() => {
    const line = controller.logic.sightLine(step);
    if (!line) return null;
    const [a, b] = line;
    const dir = b.clone().sub(a).normalize();
    const l = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a, b.clone().addScaledVector(dir, -ARROW_LEN)]),
      // approximate: dash and gap lengths are a display choice
      new THREE.LineDashedMaterial({ color: SPOT_COLOR, dashSize: 0.08, gapSize: 0.05, depthTest: false }),
    );
    l.computeLineDistances();
    const head = new THREE.Mesh(
      new THREE.ConeGeometry(ARROW_R, ARROW_LEN, 12)
        .translate(0, -ARROW_LEN / 2, 0)
        .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir))
        .translate(b.x, b.y, b.z),
      new THREE.MeshBasicMaterial({ color: SPOT_COLOR, depthTest: false }),
    );
    l.renderOrder = head.renderOrder = 10;
    return new THREE.Group().add(l, head);
  }, [controller, step]);
  useEffect(
    () => () =>
      obj?.children.forEach((o) => {
        const m = o as THREE.Mesh;
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }),
    [obj],
  );
  return obj ? <primitive object={obj} /> : null;
}
/** Pulsing halos on every instance of an emphasized item's parts, drawn through the skin. */
function Halos<S>({ controller, step }: { controller: FleetWalkController<S>; step: FleetWalkStep<S> }) {
  const pts = useMemo(() => controller.logic.emphasisPoints(step), [controller, step]);
  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({ color: EMPHASIS_COLOR, transparent: true, depthTest: false, depthWrite: false }),
    [],
  );
  const geo = useMemo(() => new THREE.SphereGeometry(HALO_R, 16, 12), []);
  useEffect(
    () => () => {
      mat.dispose();
      geo.dispose();
    },
    [mat, geo],
  );
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    // approximate: the pulse's opacity and size range are a display choice
    const k = 0.5 + 0.5 * Math.sin(clock.elapsedTime * PULSE_HZ * 2 * Math.PI);
    mat.setValues({ opacity: 0.35 + 0.5 * k });
    group.current?.children.forEach((o) => o.scale.setScalar(1 + 0.6 * k));
  });
  if (!pts.length) return null;
  return (
    <group ref={group}>
      {pts.map((p, i) => (
        <mesh key={i} position={p} geometry={geo} material={mat} renderOrder={11} />
      ))}
    </group>
  );
}

/** An airplane's walk entry (`AircraftDef.walk`) and its scene marker, for its controller. */
export function fleetWalkUi<S>(controller: FleetWalkController<S>) {
  function Panel() {
    return <FleetWalkPanel controller={controller} />;
  }
  function Marker() {
    return <FleetWalkMarker controller={controller} />;
  }
  return {
    Marker,
    walk: { Panel, open: () => controller.open(), close: controller.close, boot: controller.boot },
  };
}
