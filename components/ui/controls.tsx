"use client";
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Catalogue } from "@/lib/catalogue";
import type { SysId } from "@/lib/systems";
import { create } from "zustand";
import { selectSys } from "@/lib/fleet";
import { focusPart } from "@/lib/registry";

/**
 * The scenario the page last loaded, shown pressed on its button until the user changes something in the panel (a
 * button, switch, slider or box there that is not a scenario, a part locator or a disclosure), and a scenario another
 * system's panel asked for (TryLink), which its button loads when it mounts. Both cleared when the page goes
 * (useScenarioMarks).
 */
const useScenarioMark = create<{ mark: string | null; request: string | null; focusExample: boolean }>(() => ({
  mark: null,
  request: null,
  focusExample: false,
}));

/** Open the aircraft’s existing example without changing its simulation until the learner chooses it. */
export function showStudyExample() {
  useScenarioMark.setState({ focusExample: true });
  selectSys("overview");
}

/** Panel controls that change nothing in the simulation: locating a part, opening text, the walk-around's own steps. */
const NOT_A_CHANGE = "[data-scenario], .parts, .part-inspector, .eng-study, .lead-more, [aria-expanded], a, .walk";

/** Events that can change the simulation: a HoldButton pressed from the keyboard sends no click, only its keydown. */
const CHANGE_EVENTS = ["click", "keydown", "input", "change"];

function clearOnChange(e: Event) {
  const t = e.target;
  if (!(t instanceof Element) || !t.closest(".panel") || t.closest(NOT_A_CHANGE)) return;
  if ((e.type === "click" || e.type === "keydown") && !t.closest("button")) return;
  if (e instanceof KeyboardEvent && e.key !== " " && e.key !== "Enter") return;
  if (useScenarioMark.getState().mark !== null) useScenarioMark.setState({ mark: null });
}

/** A page's scenario mark: kept while the user only reads, cleared by a change in the panel and when the page goes. */
export function useScenarioMarks() {
  useEffect(() => {
    // capture, so a control that stops its event's propagation still counts
    for (const type of CHANGE_EVENTS) document.addEventListener(type, clearOnChange, true);
    return () => {
      for (const type of CHANGE_EVENTS) document.removeEventListener(type, clearOnChange, true);
      useScenarioMark.setState({ mark: null, request: null, focusExample: false });
    };
  }, []);
}

/**
 * Loads a scenario. Its actions run only from an event, keeping their imperative simulation writes outside render.
 * The button shows pressed while its scenario is the one loaded (`mark`, by default its text, names it on the page).
 */
export function ScenarioButton({
  children,
  mark,
  before,
  onClick,
  after,
}: {
  children: ReactNode;
  mark?: string;
  before?: () => void;
  onClick: () => void;
  after?: () => void;
}) {
  const key = mark ?? (typeof children === "string" ? children : undefined);
  const pressed = useScenarioMark((x) => key !== undefined && x.mark === key),
    requested = useScenarioMark((x) => key !== undefined && x.request === key);
  const run = () => {
    before?.();
    onClick();
    after?.();
    if (key !== undefined) useScenarioMark.setState({ mark: key });
  };
  const runRequested = useEffectEvent(run);
  useEffect(() => {
    if (!requested) return;
    useScenarioMark.setState({ request: null });
    runRequested();
  }, [requested]);
  return (
    <button
      type="button"
      className="btn"
      data-scenario=""
      aria-pressed={key === undefined ? undefined : pressed}
      onClick={run}
    >
      {children}
    </button>
  );
}

/**
 * A card under an overview's introduction that does its example: it opens `sys` and loads the scenario whose
 * ScenarioButton there is marked `mark`.
 */
export function TryLink({
  sys,
  mark,
  title,
  children,
}: {
  sys: SysId;
  mark: string;
  title: string;
  children: ReactNode;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const focusExample = useScenarioMark((x) => x.focusExample);
  useEffect(() => {
    if (!focusExample) return;
    useScenarioMark.setState({ focusExample: false });
    button.current?.focus({ preventScroll: true });
    button.current?.scrollIntoView({ block: "end" });
  }, [focusExample]);
  return (
    <button
      ref={button}
      type="button"
      className="try-link"
      onClick={() => {
        useScenarioMark.setState({ request: mark });
        selectSys(sys);
      }}
    >
      <b>{title}</b>
      <span>{children}</span>
    </button>
  );
}

export function Seg<T extends string | number>({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="row">
      <div className="lbl">
        <span>{label}</span>
      </div>
      <div className="seg" role="group" aria-label={label}>
        {options.map(([v, t]) => (
          <button
            key={String(v)}
            id={`${id}-${v}`}
            type="button"
            aria-pressed={v === value}
            onClick={() => onChange(v)}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Slider({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  fmt,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  fmt: (v: number) => string;
}) {
  return (
    <div className="row">
      <label htmlFor={id}>
        <span>{label}</span>
        <output>{fmt(value)}</output>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={fmt(value)}
        onChange={(e) => onChange(+e.target.value)}
      />
    </div>
  );
}

export function Check({
  id,
  label,
  checked,
  disabled,
  onChange,
  title,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  /** Hover text for the whole control, e.g. what it does and its source. */
  title?: string;
}) {
  return (
    <label className="chk" title={title}>
      <input
        id={id}
        type="checkbox"
        disabled={disabled}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function Rocker({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="rock" aria-label={label} aria-pressed={on} onClick={onToggle}>
      <div className="body" />
      <span>{label}</span>
    </button>
  );
}

export type Reading = string | [string, "" | "bad" | "warnc"];
/**
 * A number in a reading, with its sign and a trailing % or °: "27.8", "−1.5", "1,800", "92%", "100 %", "12:30". Not a
 * digit inside a name ("N6189Q") or one that numbers a capitalised name ("ESS 2", "ALT 1", "MAIN BUS 3").
 */
const NUMBER = /((?<![\w.])(?<!\b[A-Z]{2,} )[+\-−]?\d(?:[\d,.:]*\d)?(?:\s?%|°)?)/;
/** A reading's numbers set in the mono face (tabular, so they don't jitter as they change); its words in the body face. */
function readingRuns(t: string) {
  return t.split(NUMBER).map((run, i) =>
    i % 2 ? (
      <span key={i} className="n">
        {run}
      </span>
    ) : (
      run
    ),
  );
}
export function Readouts({ items }: { items: [string, Reading][] }) {
  return (
    <div className="readouts">
      {items.map(([l, r]) => {
        const [t, c] = Array.isArray(r) ? r : [r, ""];
        return (
          <div className="ro" key={l}>
            <span>{l}</span>
            <b className={c}>{readingRuns(t)}</b>
          </div>
        );
      })}
    </div>
  );
}

export const Facts = ({ rows }: { rows: [ReactNode, ReactNode][] }) => (
  <dl className="facts">
    {rows.map(([k, v], i) => (
      <Frag key={i}>
        <dt>{k}</dt>
        <dd>{v}</dd>
      </Frag>
    ))}
  </dl>
);
const Frag = ({ children }: { children: ReactNode }) => <>{children}</>;

export const Notes = ({ items }: { items: ReactNode[] }) => (
  <ul className="notes">
    {items.map((n, i) => (
      <li key={i}>{n}</li>
    ))}
  </ul>
);
export const Caution = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="caution">
    <strong>{title}</strong>
    {children}
  </div>
);
export const Small = ({ children }: { children: ReactNode }) => <p className="small">{children}</p>;
export const H3 = ({ children }: { children: ReactNode }) => <h3>{children}</h3>;
export const Ctl = ({ children }: { children: ReactNode }) => <div className="ctl">{children}</div>;
export const BtnRow = ({ children }: { children: ReactNode }) => <div className="btnrow">{children}</div>;

/**
 * "Tap to locate": follows the catalogue's visible parts, flies to a part and highlights it briefly. On phones the list
 * starts folded behind a count, so the controls under it aren't a long scroll away (the toggle is hidden on desktop).
 */
export function PartsList({ cat, sys }: { cat: Catalogue; sys: SysId }) {
  const visible = useSyncExternalStore(cat.subscribeVisibility, cat.visibleSnapshot, cat.visibleSnapshot);
  const parts = cat.pinned(sys, visible);
  const [open, setOpen] = useState(false);
  const id = useId();
  if (parts.length === 0) return null;
  const count = `${parts.length} ${parts.length === 1 ? "part" : "parts"}`;
  return (
    <>
      <button
        type="button"
        className="parts-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {open ? `Hide the ${count}` : `Show the ${count}`}
      </button>
      <ul id={id} className="parts" data-folded={open ? undefined : ""}>
        {parts.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => focusPart(p.name!)}>
              <b>{p.name}</b>
              <span>{p.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Momentary button (pointer or keyboard), e.g. a spring-loaded switch position. `onDown` on press, `onUp(held)` on release;
 * `onHold` fires once after `holdMs`; `repeat` (ms) re-fires `onRepeat` (default `onDown`) while held (e.g. trim switches).
 * Losing focus or unmounting while held (Tab away, switching system or airplane) counts as a release.
 */
export interface HoldButtonProps {
  onDown?: () => void;
  onUp?: (held: boolean) => void;
  onHold?: () => void;
  holdMs?: number;
  repeat?: number;
  onRepeat?: () => void;
  className?: string;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  pressed?: boolean;
  children: ReactNode;
}
export function HoldButton({
  onDown,
  onUp,
  onHold,
  holdMs = 500,
  repeat,
  onRepeat,
  className,
  disabled,
  title,
  ariaLabel,
  pressed,
  children,
}: HoldButtonProps) {
  const [down, setDown] = useState(false);
  const r = useRef({
    down: false,
    held: false,
    t: 0 as ReturnType<typeof setTimeout> | 0,
    i: 0 as ReturnType<typeof setInterval> | 0,
  });
  const stop = () => {
    clearTimeout(r.current.t || undefined);
    clearInterval(r.current.i || undefined);
    r.current.t = r.current.i = 0;
  };
  const upRef = useRef(onUp);
  useLayoutEffect(() => {
    upRef.current = onUp;
  }, [onUp]);
  useEffect(
    () => () => {
      stop();
      if (r.current.down) {
        r.current.down = false;
        upRef.current?.(r.current.held);
      }
    },
    [],
  );
  const press = () => {
    if (r.current.down || disabled) return;
    r.current.down = true;
    r.current.held = false;
    setDown(true);
    onDown?.();
    if (onHold)
      r.current.t = setTimeout(() => {
        r.current.held = true;
        onHold();
      }, holdMs);
    const again = onRepeat ?? onDown;
    if (repeat && again) r.current.i = setInterval(again, repeat);
  };
  const release = () => {
    if (!r.current.down) return;
    r.current.down = false;
    setDown(false);
    stop();
    onUp?.(r.current.held);
  };
  return (
    <button
      type="button"
      className={className}
      data-down={down}
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        press();
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onBlur={release}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          press();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          release();
        }
      }}
    >
      {children}
    </button>
  );
}
