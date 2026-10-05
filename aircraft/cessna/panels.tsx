"use client";
/**
 * Panel building blocks shared by the Cessna NAV III singles: the MASTER / AVIONICS split rockers and the
 * ARM–OFF–TEST STBY BATT switch, a live Figure 7-7 bus diagram, the breaker board (only ESS / AVN breakers
 * pull; the others can only trip and be reset — POH 7-57), EIS electrical readouts and the annunciation table.
 * Stateless: the airplane passes its electrical state, solution and an update callback.
 */
import "./cessna.css";
import type { ReactNode } from "react";
import { Facts, Readouts, Rocker } from "@/components/ui/controls";
import { NAV3_ANN } from "./annunciations";
import { FEEDER, NAV3_BUS_NAME, PULLABLE, cbKey, type Breaker, type Nav3Bus, type Nav3Elec, type Nav3Solution } from "./electrical";

type Upd = (fn: (d: Nav3Elec) => void) => void;

/** MASTER (ALT | BAT), AVIONICS (BUS 1 | BUS 2) and STBY BATT (ARM / OFF / TEST, TEST momentary) with its green TEST lamp. */
export function Nav3Switches({ e, E, up, testHeld = 0 }: { e: Nav3Elec; E: Nav3Solution; up: Upd; testHeld?: number }) {
  const hold = (on: boolean) => up((d) => { d.stby = on ? "TEST" : "OFF"; });
  return (
    <div className="n3-row">
      <div className="n3-stby">
        <b>STBY BATT <span className={"n3-lamp" + (E.testLamp ? " on" : "")} aria-label={E.testLamp ? "TEST lamp on" : "TEST lamp off"} /> TEST</b>
        <div className="n3-seg" role="group" aria-label="STBY BATT switch">
          <button type="button" aria-pressed={e.stby === "ARM"} onClick={() => up((d) => { d.stby = "ARM"; })}>ARM</button>
          <button type="button" aria-pressed={e.stby === "OFF"} onClick={() => up((d) => { d.stby = "OFF"; })}>OFF</button>
          <button type="button" aria-pressed={e.stby === "TEST"} title="Hold for the 10-second energy test (spring-loaded)"
            onPointerDown={(ev) => { ev.currentTarget.setPointerCapture?.(ev.pointerId); hold(true); }} onPointerUp={() => hold(false)} onPointerCancel={() => hold(false)}
            onKeyDown={(ev) => { if ((ev.key === " " || ev.key === "Enter") && !ev.repeat) { ev.preventDefault(); hold(true); } }}
            onKeyUp={(ev) => { if (ev.key === " " || ev.key === "Enter") hold(false); }}>{e.stby === "TEST" ? `${testHeld.toFixed(0)} s` : "TEST"}</button>
        </div>
      </div>
      <div className="n3-split" aria-label="MASTER switch">
        <b>MASTER</b>
        <Rocker label="ALT" on={e.alt} onToggle={() => up((d) => { d.alt = !d.alt; if (d.alt) d.bat = true; })} />
        <Rocker label="BAT" on={e.bat} onToggle={() => up((d) => { d.bat = !d.bat; if (!d.bat) d.alt = false; })} />
      </div>
      <div className="n3-split" aria-label="AVIONICS switch">
        <b>AVIONICS</b>
        <Rocker label="BUS 1" on={e.avn1} onToggle={() => up((d) => { d.avn1 = !d.avn1; })} />
        <Rocker label="BUS 2" on={e.avn2} onToggle={() => up((d) => { d.avn2 = !d.avn2; })} />
      </div>
    </div>
  );
}

const amp = (a: number) => (a > 0 ? "+" : "") + a.toFixed(1);
/** EIS ELECTRICAL block as the G1000 shows it: M BUS / E BUS volts and M BATT / S BATT amps, with the POH colour rules. */
export function Nav3Meters({ E }: { E: Nav3Solution }) {
  const v = (x: number | null): [string, "" | "bad" | "warnc"] => (x == null ? ["✕", "bad"] : [x.toFixed(1), x > 32 || x < 24.5 ? "bad" : ""]);
  return (
    <div className="n3-meter">
      <Readouts items={[["M BUS V", v(E.mBus)], ["E BUS V", v(E.eBus)], ["M BATT A", [amp(E.mBatt), E.mBatt < -1.5 ? "warnc" : ""]], ["S BATT A", [amp(E.sBatt), E.sBatt < 0 ? "warnc" : ""]]]} />
    </div>
  );
}

/** Live single-line diagram after Figure 7-7: sources → J-box → feeders → buses, diode-ORed crossfeed and essential buses, avionics switches, standby battery. */
export function Nav3Diagram({ e, E }: { e: Nav3Elec; E: Nav3Solution }) {
  const on = (b: Nav3Bus) => E.v[b] > 0;
  const W = (d: string, lit: boolean) => <path d={d} className={"w" + (lit ? " on" : "")} />;
  const B = (x: number, y: number, w: number, label: string, lit: boolean, v?: number, h = 22) => (
    <g>
      <rect className={"b" + (lit ? " on" : "")} x={x} y={y} width={w} height={h} rx={4} />
      <text x={x + w / 2} y={y + (v != null ? 9 : 14)} textAnchor="middle">{label}</text>
      {v != null && <text x={x + w / 2} y={y + 19} textAnchor="middle" className="d">{lit ? v.toFixed(1) + " V" : "0 V"}</text>}
    </g>
  );
  const node = E.node > 0, src = (x: boolean) => x;
  return (
    <svg className="n3-dia" viewBox="0 0 360 214" role="img" aria-label="Electrical system diagram (POH Figure 7-7)">
      {B(4, 8, 62, "ALTERNATOR", src(E.altOn))}
      {B(4, 52, 62, "MAIN BATT", src(e.bat && !e.fail.bat && e.socMain > 0.02))}
      {B(4, 96, 62, "EXT PWR", src(e.ext))}
      {W("M66 19 H84 V58", E.altOn)}
      {W("M66 63 H84", e.bat && node)}
      {W("M66 107 H84 V68", e.ext && e.bat)}
      {B(84, 46, 56, "J-BOX", node, E.node, 30)}
      {W("M140 54 H160 V20 H176", on("E1"))}
      {W("M140 70 H160 V110 H176", on("E2"))}
      <text x={150} y={36} textAnchor="middle" className="d">{e.cb[FEEDER.E1] ? "B ⏏" : "B"}</text>
      <text x={150} y={98} textAnchor="middle" className="d">{e.cb[FEEDER.E2] ? "A ⏏" : "A"}</text>
      {B(176, 9, 62, "BUS 1", on("E1"), E.v.E1)}
      {B(176, 99, 62, "BUS 2", on("E2"), E.v.E2)}
      {W("M238 20 H270", on("AV1"))}
      {W("M238 110 H252 V188 H270", on("AV2"))}
      {B(270, 9, 86, "AVN BUS 1", on("AV1"), E.v.AV1)}
      {B(270, 177, 86, "AVN BUS 2", on("AV2"), E.v.AV2)}
      <text x={254} y={14} textAnchor="middle" className="d">{e.avn1 ? "●" : "○"}</text>
      <text x={258} y={150} textAnchor="middle" className="d">{e.avn2 ? "●" : "○"}</text>
      {W("M207 31 V60 H270", on("XF") || on("ESS"))}
      {W("M207 99 V70 H270", on("XF") || on("ESS"))}
      {W("M228 65 V120 H270", on("ESS"))}
      <text x={218} y={52} className="d">▶|</text>
      {B(270, 54, 86, "CROSSFEED", on("XF"), E.v.XF)}
      {B(270, 109, 86, "ESSENTIAL", on("ESS"), E.v.ESS)}
      {B(176, 160, 62, "STBY BATT", E.stbyOnline || E.sBatt > 0, undefined)}
      {W("M238 171 H262 V131 H270", e.stby === "ARM" && (E.stbyOnline || E.sBatt > 0))}
      <text x={207} y={200} textAnchor="middle" className="d">{e.stby}{E.stbyOnline ? " · supplying" : E.sBatt > 0 ? " · charging" : ""}</text>
    </svg>
  );
}

/** Breaker board: tap a pullable breaker (ESS / AVN buses) to pull or reset it; tripped breakers on the other buses can only be reset. */
export function BreakerBoard({ breakers, buses, E, cb, up, extra }: {
  breakers: Breaker[]; buses: [Nav3Bus, string, string][]; E: Nav3Solution; cb: Record<string, boolean>; up: Upd; extra?: Partial<Record<Nav3Bus, ReactNode>>;
}) {
  return (
    <div className="buses n3-buses">
      {buses.map(([id, name, src]) => {
        const v = E.v[id], lit = v > 0;
        return (
          <div key={id} className={"bus" + (lit ? " on" : "")}>
            <div className="top"><span className="lamp" /><span className="nm">{name}</span><span className="v">{lit ? v.toFixed(1) + " V" : "0 V"}</span></div>
            <div className="src">{src}{PULLABLE[id] ? " · pullable" : " · non-pullable"}</div>
            <div className="loads">
              {breakers.filter((b) => b.bus === id).map((b) => {
                const k = cbKey(b), outNow = !!cb[k], pull = PULLABLE[id];
                const cls = "chip" + (outNow ? (pull ? " pulled" : " tripped") : "") + (!pull && !outNow ? " fixed" : "");
                const title = `${b.label}${b.amps ? ` — ${b.amps} A${b.unverified ? " (unverified)" : ""}` : ""}: ${b.feeds}${b.src ? ` (rating ${b.src})` : " (rating not given in the POH)"}`;
                return (
                  <button key={k} type="button" className={cls} aria-pressed={outNow} title={title} disabled={!pull && !outNow}
                    onClick={() => up((d) => { if (d.cb[k]) delete d.cb[k]; else if (pull) d.cb[k] = true; })}>
                    {b.label}{b.amps ? <i> {b.amps}{b.unverified ? "?" : ""}</i> : null}{E.amps[k] > 0.05 ? <i> · {E.amps[k].toFixed(1)}A</i> : null}
                  </button>
                );
              })}
            </div>
            {extra?.[id]}
          </div>
        );
      })}
    </div>
  );
}

/** The G1000 NAV III annunciation set (POH 7-51) with levels, tones and triggers. */
export const Nav3AnnTable = () => <Facts rows={NAV3_ANN.map((a) => [<b key={a.text} style={{ color: a.level === "w" ? "var(--warn)" : "#B98A00" }}>{a.text}</b>, `${a.level === "w" ? "Warning" : "Caution"} · ${a.tone} tone · ${a.trigger} (${a.cite})`])} />;

export { NAV3_BUS_NAME };
