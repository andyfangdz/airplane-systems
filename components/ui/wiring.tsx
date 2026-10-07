"use client";
/**
 * Symbols for the live single-line electrical diagrams in the side panels (one per airplane, drawn by its electrical panel).
 * Breakers and switches sit on a wire at (x, y) with terminals 6–7 px either side; `top` / `bot` say whether the wire on each
 * side is live. They are drawn on a vertical wire, or on a horizontal one with `h` (then `top` is the left side and `bot` the right).
 * Wrap them in `<svg className="wiring">` for the theme colours.
 */
import "./wiring.css";
import type { ReactNode } from "react";

/** Wire class: dead (grey) or live (electrical colour). */
export const wire = (lit: boolean) => "w" + (lit ? " on" : "");
export const W = ({ d, lit }: { d: string; lit: boolean }) => <path d={d} className={wire(lit)} />;
export const Term = ({ x, y, lit }: { x: number; y: number; lit: boolean }) => <circle cx={x} cy={y} r={1.8} className={"t" + (lit ? " on" : "")} />;
/** Junction dot where wires meet. */
export const Dot = ({ x, y, lit }: { x: number; y: number; lit: boolean }) => <circle cx={x} cy={y} r={2.6} className={"j" + (lit ? " on" : "")} />;

/** Draws a symbol built on a vertical wire either as it is or turned onto a horizontal one (top → left). */
const Turn = ({ x, y, h, children }: { x: number; y: number; h?: boolean; children: ReactNode }) =>
  h ? <g transform={`rotate(-90 ${x} ${y})`}>{children}</g> : <>{children}</>;

/**
 * Breaker: an arc bridging two terminals; pulled or tripped, it lifts clear (amber). The label goes beside a vertical breaker
 * (`side` 1 = right; a long name can start on a `sub` line above it) or above a horizontal one, where "out" is written below the wire.
 */
export function Cb({ x, y, open, top, bot, label, sub, side = 1, h }: { x: number; y: number; open: boolean; top: boolean; bot: boolean; label: string; sub?: string; side?: 1 | -1; h?: boolean }) {
  const tx = x + side * 16, anchor = side > 0 ? "start" : "end";
  const name = <>{label}{open ? <tspan className="x"> ⏏ out</tspan> : null}</>;
  return (
    <g>
      <Turn x={x} y={y} h={h}>
        <Term x={x} y={y - 6} lit={top} /><Term x={x} y={y + 6} lit={bot} />
        <path d={open ? `M${x + 4} ${y - 9} a6.5 6.5 0 0 1 0 13` : `M${x} ${y - 6} a6.5 6.5 0 0 1 0 12`} className={open ? "w out" : wire(top && bot)} />
      </Turn>
      {h ? <>
        <text x={x} y={y - 14} textAnchor="middle" className="d s">{label}</text>
        {open ? <text x={x} y={y + 14} textAnchor="middle" className="x s">⏏ out</text> : null}
      </> : sub ? <>
        <text x={tx} y={y - 1} textAnchor={anchor} className="d s">{sub}</text>
        <text x={tx} y={y + 10} textAnchor={anchor}>{name}</text>
      </> : <text x={tx} y={y + 4} textAnchor={anchor}>{name}</text>}
    </g>
  );
}

/**
 * Switch or relay contact: a blade hinged on the lower (right, with `h`) terminal, closed onto the other one or swung open.
 * Beside a vertical one, `sub` goes above `label`; below a horizontal one, `label` goes above `sub`.
 */
export function Sw({ x, y, closed, top, bot, label, sub, side = 1, h }: { x: number; y: number; closed: boolean; top: boolean; bot: boolean; label: string; sub?: string; side?: 1 | -1; h?: boolean }) {
  const tx = x + side * 16, anchor = side > 0 ? "start" : "end";
  return (
    <g>
      <Turn x={x} y={y} h={h}>
        <Term x={x} y={y - 7} lit={top} /><Term x={x} y={y + 7} lit={bot} />
        <path d={closed ? `M${x} ${y + 7} V${y - 7}` : `M${x} ${y + 7} L${x + side * 9} ${y - 5}`} className={wire(closed ? top && bot : bot)} />
      </Turn>
      {h ? <>
        <text x={x} y={y + 17} textAnchor="middle" className="d">{label}</text>
        {sub ? <text x={x} y={y + 27} textAnchor="middle" className="d s">{sub}</text> : null}
      </> : sub ? <>
        <text x={tx} y={y - 1} textAnchor={anchor} className="d s">{sub}</text>
        <text x={tx} y={y + 10} textAnchor={anchor}>{label}</text>
      </> : <text x={tx} y={y + 4} textAnchor={anchor}>{label}</text>}
    </g>
  );
}

/** Diode pointing the way current can flow: on a horizontal wire `dir` 1 = right; with `v`, on a vertical one, 1 = down. */
export const Diode = ({ x, y, dir, lit, v }: { x: number; y: number; dir: 1 | -1; lit: boolean; v?: boolean }) => {
  const d = <path d={`M${x - 5 * dir} ${y - 5} L${x + 5 * dir} ${y} L${x - 5 * dir} ${y + 5} Z M${x + 5 * dir} ${y - 5} V${y + 5}`} className={"dio" + (lit ? " on" : "")} />;
  return v ? <g transform={`rotate(90 ${x} ${y})`}>{d}</g> : d;
};

/** Fuse on a horizontal wire. */
export const Fuse = ({ x, y, lit }: { x: number; y: number; lit: boolean }) => (
  <g><rect x={x - 6} y={y - 3} width={12} height={6} rx={1.5} className={"fz" + (lit ? " on" : "")} /><path d={`M${x - 6} ${y} H${x + 6}`} className={wire(lit)} /></g>
);

/** Source or bus: a name (one line, or several lines with the extras muted) over a value. */
export function Box({ x, y, w, label, value, lit, h }: { x: number; y: number; w: number; label: string | string[]; value: string; lit: boolean; h?: number }) {
  const lines = typeof label === "string" ? [label] : label;
  return (
    <g>
      <rect className={"b" + (lit ? " on" : "")} x={x} y={y} width={w} height={h ?? 20 + 12 * lines.length} rx={4} />
      {lines.map((l, i) => <text key={l} x={x + w / 2} y={y + 14 + 12 * i} textAnchor="middle" className={i ? "d" : undefined}>{l}</text>)}
      <text x={x + w / 2} y={y + 14 + 12 * lines.length} textAnchor="middle" className="d">{value}</text>
    </g>
  );
}

/** Symbol key, top left at (x, y): diode, breaker, switch, live wire. */
export const Key = ({ x, y }: { x: number; y: number }) => (
  <g className="key">
    <Diode x={x + 6} y={y + 4} dir={1} lit={false} /><text x={x + 20} y={y + 8} className="d">diode</text>
    <path d={`M${x + 6} ${y + 19} a6.5 6.5 0 0 1 0 12`} className="w" /><Term x={x + 6} y={y + 19} lit={false} /><Term x={x + 6} y={y + 31} lit={false} /><text x={x + 20} y={y + 29} className="d">breaker</text>
    <path d={`M${x + 6} ${y + 54} L${x + 15} ${y + 44}`} className="w" /><Term x={x + 6} y={y + 42} lit={false} /><Term x={x + 6} y={y + 54} lit={false} /><text x={x + 20} y={y + 51} className="d">switch</text>
    <path d={`M${x} ${y + 68} H${x + 14}`} className="w on" /><text x={x + 20} y={y + 71} className="d">live</text>
  </g>
);
