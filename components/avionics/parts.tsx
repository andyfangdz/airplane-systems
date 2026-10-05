"use client";
/** Building blocks shared by the GFC 700 and KAP 140 panels: hardware keys, the AFCS strip and the G1000 "fly" knobs. */
import "./avionics.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { BtnRow, Slider } from "@/components/ui/controls";
import type { AfcsAnnunc } from "@/lib/avionics/g1000";
import { nextCdi, wrap360, type FlightState, type FlySet } from "@/lib/avionics/flight";

const pad3 = (h: number) => String(Math.round(wrap360(h)) || 360).padStart(3, "0");
export { pad3 };

/**
 * Momentary hardware key (pointer or keyboard). `onDown` on press, `onUp(held)` on release;
 * `onHold` fires once after `holdMs`; `repeat` (ms) re-fires `onDown` while held (e.g. trim switches).
 */
export function HoldKey({ label, sub, onDown, onUp, onHold, holdMs = 500, repeat, className = "", disabled, title }: {
  label: ReactNode; sub?: string; onDown?: () => void; onUp?: (held: boolean) => void; onHold?: () => void; holdMs?: number; repeat?: number;
  className?: string; disabled?: boolean; title?: string;
}) {
  const [down, setDown] = useState(false);
  const r = useRef({ down: false, held: false, t: 0 as ReturnType<typeof setTimeout> | 0, i: 0 as ReturnType<typeof setInterval> | 0 });
  const stop = () => { clearTimeout(r.current.t || undefined); clearInterval(r.current.i || undefined); r.current.t = r.current.i = 0; };
  useEffect(() => stop, []);
  const press = () => {
    if (r.current.down || disabled) return;
    r.current.down = true; r.current.held = false; setDown(true);
    onDown?.();
    if (onHold) r.current.t = setTimeout(() => { r.current.held = true; onHold(); }, holdMs);
    if (repeat && onDown) r.current.i = setInterval(onDown, repeat);
  };
  const release = () => {
    if (!r.current.down) return;
    r.current.down = false; setDown(false); stop();
    onUp?.(r.current.held);
  };
  return (
    <button type="button" className={`avx-k ${className}`} data-down={down} disabled={disabled} title={title} aria-label={aria(label, sub)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); press(); }}
      onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
      onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); press(); } }}
      onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); release(); } }}>
      {label}{sub && <small>{sub}</small>}
    </button>
  );
}

/** Accessible name for a key with a small second line ("NOSE" + "UP" → "NOSE UP"). */
const aria = (label: ReactNode, sub?: string) => (typeof label === "string" && sub ? `${label} ${sub}` : undefined);

/** Plain bezel key. */
export const Key = ({ label, sub, onClick, disabled, className = "", title }: { label: ReactNode; sub?: string; onClick: () => void; disabled?: boolean; className?: string; title?: string }) => (
  <button type="button" className={`avx-k ${className}`} onClick={onClick} disabled={disabled} title={title} aria-label={aria(label, sub)}>{label}{sub && <small>{sub}</small>}</button>
);

/** HTML copy of the PFD AFCS status bar: system status | armed lateral (white) | active lateral (green) | AP/YD | active vertical + reference (green) | armed vertical (white). */
export function AfcsStrip({ a }: { a: AfcsAnnunc | null }) {
  const c = (col: string, blink?: boolean | null) => `avx-${col}${blink ? " avx-blink" : ""}`;
  if (!a) return <div className="avx-strip" aria-label="AFCS status: no power"><span /><span /><span /><span /><span /><span /></div>;
  const sysCol = a.sys?.level === "w" ? "r" : a.sys?.level === "c" ? "y" : "w";
  const latCol = a.latFlash === "y" ? "y" : "g", vertCol = a.vertFlash === "y" ? "y" : "g";
  const ctr = a.cws ? <b className="avx-w">CWS</b> : a.ap ? <b className="avx-g">AP</b>
    : a.apFlash ? <b className={c(a.apFlash === "abnormal" ? "r" : "y", true)}>AP</b> : null;
  const label = a.fd ? `AFCS: ${[a.latArm && a.latArm + " armed", a.lat, a.ap && "AP", a.vert, a.vertRef, a.vertArm && a.vertArm + " armed"].filter(Boolean).join(", ")}` : `AFCS: flight director off${a.apFlash ? ", AP flashing" : ""}`;
  return (
    <div className="avx-strip" role="status" aria-label={label}>
      <span>{a.sys && <b className={`${c(sysCol, a.sys.flash)} avx-boxed`}>{a.sys.text}</b>}</span>
      <span className="avx-w">{a.fd ? a.latArm : ""}</span>
      <span className={c(latCol, a.fd && !!a.latFlash)}>{a.fd ? a.lat : ""}</span>
      <span>{ctr}{a.yd && <b className="avx-g"> YD</b>}</span>
      <span className={c(vertCol, a.fd && !!a.vertFlash)}>{a.fd && <>{a.vert}{a.vertRef && <span className="avx-ref">{a.vertRef}</span>}</>}</span>
      <span className="avx-w">{a.fd ? a.vertArm : ""}</span>
    </div>
  );
}

/** Aural indicator line (autopilot disconnect / alert tones are not drawn on any display). */
export const ToneLine = ({ on, text }: { on: boolean; text: string }) => (
  <div className="avx-tone" aria-live="polite">{on ? <><i /><b>{text}</b></> : <span>&nbsp;</span>}</div>
);

/**
 * G1000 knobs and softkeys the autopilots use: HDG (bug, push = sync), CRS, ALT (selected altitude), CDI softkey,
 * and the throttle. `loc` = NAV1/NAV2 tuned to a localizer (CDI shows LOC instead of VOR).
 */
export function FlyControls({ fs, onSet, loc = [false, false], altLabel = "ALT knob (ALT SEL)", id = "avx", power = true }: {
  fs: FlightState; onSet: (p: FlySet) => void; loc?: [boolean, boolean]; altLabel?: string; id?: string; power?: boolean;
}) {
  const knob = (label: string, value: string, btns: [string, () => void][]) => (
    <div className="avx-knob">
      <span>{label}<b>{value}</b></span>
      <BtnRow>{btns.map(([t, f]) => <button key={t} type="button" className="btn" onClick={f}>{t}</button>)}</BtnRow>
    </div>
  );
  const hdg = (d: number) => () => onSet({ hdgBug: wrap360(Math.round(fs.hdgBug) + d) });
  const crs = (d: number) => () => onSet({ crs: wrap360(Math.round(fs.crs) + d) });
  const alt = (d: number) => () => onSet({ selAlt: Math.max(0, Math.min(25000, fs.selAlt + d)) });
  return (
    <div className="avx-fly">
      {knob("HDG knob", pad3(fs.hdgBug) + "°", [["−10", hdg(-10)], ["−1", hdg(-1)], ["PUSH SYNC", () => onSet({ hdgBug: Math.round(fs.hdg) })], ["+1", hdg(1)], ["+10", hdg(10)]])}
      {knob("CRS knob", pad3(fs.crs) + "°", [["−10", crs(-10)], ["−1", crs(-1)], ["+1", crs(1)], ["+10", crs(10)]])}
      {knob(altLabel, `${fs.selAlt} FT`, [["−1000", alt(-1000)], ["−100", alt(-100)], ["+100", alt(100)], ["+1000", alt(1000)]])}
      {knob("CDI softkey", fs.navSrc, [["CDI", () => onSet({ navSrc: nextCdi(fs.navSrc, loc[0], loc[1]) })]])}
      {power && <Slider id={`${id}-pwr`} label="Throttle (sets trimmed speed)" min={0} max={1} step={0.01} value={fs.power} onChange={(v) => onSet({ power: v })} fmt={(v) => Math.round(v * 100) + "%"} />}
    </div>
  );
}
