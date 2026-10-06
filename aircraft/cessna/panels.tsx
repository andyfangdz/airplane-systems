"use client";
/**
 * Panel building blocks shared by the Cessna NAV III singles: the MASTER / AVIONICS split rockers and the
 * ARM–OFF–TEST STBY BATT switch, a live Figure 7-7 bus diagram, the breaker board (only ESS / AVN breakers
 * pull; the others can only trip and be reset — POH 7-57), EIS electrical readouts and the annunciation table.
 * Stateless: the airplane passes its electrical state, solution and an update callback.
 */
import "./cessna.css";
import type { ReactNode } from "react";
import { Facts, HoldButton, Readouts, Rocker } from "@/components/ui/controls";
import type { Nav3AnnDef } from "./annunciations";
import { FEEDER, PULLABLE, amp, cbKey, mBattAlert, sBattAlert, voltsAlert, type Breaker, type Nav3Bus, type Nav3Elec, type Nav3Solution } from "./electrical";

type Upd = (fn: (d: Nav3Elec) => void) => void;

/**
 * MASTER (ALT | BAT), AVIONICS (BUS 1 | BUS 2) and STBY BATT (ARM / OFF / TEST, TEST momentary) with its green TEST lamp.
 * `testSeconds`: how long the POH says to hold TEST — 10 s in the 172S, 20 s in the 182T (POH 4-13); don't share the value.
 */
export function Nav3Switches({ e, E, up, testHeld = 0, testSeconds = 10 }: { e: Nav3Elec; E: Nav3Solution; up: Upd; testHeld?: number; testSeconds?: number }) {
  const hold = (on: boolean) => up((d) => { d.stby = on ? "TEST" : "OFF"; });
  return (
    <div className="n3-row">
      <div className="n3-stby">
        <b>STBY BATT <span className={"n3-lamp" + (E.testLamp ? " on" : "")} aria-label={E.testLamp ? "TEST lamp on" : "TEST lamp off"} /> TEST</b>
        <div className="n3-seg" role="group" aria-label="STBY BATT switch">
          <button type="button" aria-pressed={e.stby === "ARM"} onClick={() => up((d) => { d.stby = "ARM"; })}>ARM</button>
          <button type="button" aria-pressed={e.stby === "OFF"} onClick={() => up((d) => { d.stby = "OFF"; })}>OFF</button>
          <HoldButton pressed={e.stby === "TEST"} title={`Hold for the ${testSeconds}-second energy test (spring-loaded)`} onDown={() => hold(true)} onUp={() => hold(false)}>
            {e.stby === "TEST" ? `${testHeld.toFixed(0)} s` : "TEST"}
          </HoldButton>
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

const tone = (a: "warning" | "caution" | null) => (a === "warning" ? "bad" : a === "caution" ? "warnc" : "") as "" | "bad" | "warnc";
/** EIS ELECTRICAL block as the G1000 shows it: M BUS / E BUS volts and M BATT / S BATT amps, coloured by the POH rules in electrical.ts. */
export function Nav3Meters({ E }: { E: Nav3Solution }) {
  const v = (x: number | null): [string, "" | "bad" | "warnc"] => (x == null ? ["✕", "bad"] : [x.toFixed(1), tone(voltsAlert(x))]);
  return (
    <div className="n3-meter">
      <Readouts items={[["M BUS V", v(E.mBus)], ["E BUS V", v(E.eBus)], ["M BATT A", [amp(E.mBatt), tone(mBattAlert(E.mBatt))]], ["S BATT A", [amp(E.sBatt), tone(sBattAlert(E.sBatt))]]]} />
    </div>
  );
}

/* ---------- Figure 7-7 single-line diagram ---------- */
// Symbols for the diagram below. Vertical breakers and switches sit on a wire at (x, y) with terminals 6–7 px above and below;
// `top`/`bot` say whether the wire on each side is live.
const wire = (lit: boolean) => "w" + (lit ? " on" : "");
const Term = ({ x, y, lit }: { x: number; y: number; lit: boolean }) => <circle cx={x} cy={y} r={1.8} className={"t" + (lit ? " on" : "")} />;
/** Breaker: an arc bridging two terminals; pulled or tripped, it lifts clear (amber). */
function Cb({ x, y, open, top, bot, label, side = 1 }: { x: number; y: number; open: boolean; top: boolean; bot: boolean; label: string; side?: 1 | -1 }) {
  return (
    <g>
      <Term x={x} y={y - 6} lit={top} /><Term x={x} y={y + 6} lit={bot} />
      <path d={open ? `M${x + 4} ${y - 9} a6.5 6.5 0 0 1 0 13` : `M${x} ${y - 6} a6.5 6.5 0 0 1 0 12`} className={open ? "w out" : wire(top && bot)} />
      <text x={x + side * 16} y={y + 4} textAnchor={side > 0 ? "start" : "end"}>{label}{open ? <tspan className="x"> ⏏ out</tspan> : null}</text>
    </g>
  );
}
/** Switch contact: a blade hinged on the lower terminal, closed onto the upper one or swung open. */
function Sw({ x, y, closed, top, bot, label, sub, side = 1 }: { x: number; y: number; closed: boolean; top: boolean; bot: boolean; label: string; sub?: string; side?: 1 | -1 }) {
  const tx = x + side * 16, anchor = side > 0 ? "start" : "end";
  return (
    <g>
      <Term x={x} y={y - 7} lit={top} /><Term x={x} y={y + 7} lit={bot} />
      <path d={closed ? `M${x} ${y + 7} V${y - 7}` : `M${x} ${y + 7} L${x + side * 9} ${y - 5}`} className={wire(closed ? top && bot : bot)} />
      {sub ? <>
        <text x={tx} y={y - 1} textAnchor={anchor} className="d s">{sub}</text>
        <text x={tx} y={y + 10} textAnchor={anchor}>{label}</text>
      </> : <text x={tx} y={y + 4} textAnchor={anchor}>{label}</text>}
    </g>
  );
}
/** Diode on a horizontal wire, pointing the way current can flow (`dir` 1 = right). */
const Diode = ({ x, y, dir, lit }: { x: number; y: number; dir: 1 | -1; lit: boolean }) => (
  <path d={`M${x - 5 * dir} ${y - 5} L${x + 5 * dir} ${y} L${x - 5 * dir} ${y + 5} Z M${x + 5 * dir} ${y - 5} V${y + 5}`} className={"dio" + (lit ? " on" : "")} />
);
function Box({ x, y, w, label, value, lit, h = 32 }: { x: number; y: number; w: number; label: string; value: string; lit: boolean; h?: number }) {
  return (
    <g>
      <rect className={"b" + (lit ? " on" : "")} x={x} y={y} width={w} height={h} rx={4} />
      <text x={x + w / 2} y={y + 14} textAnchor="middle">{label}</text>
      <text x={x + w / 2} y={y + 26} textAnchor="middle" className="d">{value}</text>
    </g>
  );
}

/**
 * Live single-line diagram after Figure 7-7 Sheets 1–3: the alternator and main battery (external power joins the battery side
 * of the battery relay) → MASTER ALT / BAT → J-box main node → feeder breakers B and A → ELECTRICAL BUS 1 and 2; each bus feeds
 * the CROSSFEED and ESSENTIAL buses through its own diode, and its avionics bus through the AVN breaker and the AVIONICS switch;
 * the standby battery reaches only the ESSENTIAL bus, through the STBY BATT switch (ARM) and the STDBY BATT breaker.
 * Symmetric about x = 170 so it reads at phone width (viewBox 340 wide ≈ 1:1 in the side panel).
 */
export function Nav3Diagram({ e, E }: { e: Nav3Elec; E: Nav3Solution }) {
  const on = (b: Nav3Bus) => E.v[b] > 0, V = (b: Nav3Bus) => (on(b) ? E.v[b].toFixed(1) + " V" : "0 V");
  const node = E.node > 0;
  const battOk = !e.fail.bat && e.socMain > 0.02, stbyOk = e.socStby > 0.002;
  const batSide = battOk || e.ext || (e.bat && node);
  const fB = !!e.cb[FEEDER.E1], fA = !!e.cb[FEEDER.E2];
  const a1 = !!e.cb["E1:AVN 1"], a2 = !!e.cb["E2:AVN 2"];
  const sbIn = !e.cb["ESS:STDBY BATT"], arm = e.stby === "ARM";
  const sbMid = sbIn && (on("ESS") || (arm && stbyOk)), sbBat = stbyOk || (arm && sbIn && on("ESS"));
  const W = (d: string, lit: boolean) => <path d={d} className={wire(lit)} />;
  const stbyWord = E.stbyOnline ? "supplying" : E.sBatt > 0 ? "charging" : arm ? "armed" : e.stby === "TEST" ? "test" : "off";
  return (
    <svg className="n3-dia" viewBox="0 0 340 394" role="img" aria-label="Electrical system single-line diagram after POH Figure 7-7">
      {/* sources */}
      <Box x={6} y={6} w={96} label="ALTERNATOR" value={E.altOn ? `${E.altAmps.toFixed(1)} A` : e.fail.alt ? "failed" : "off line"} lit={E.altOn} />
      <Box x={122} y={6} w={96} label="MAIN BATT" value={e.fail.bat ? "failed" : `${amp(E.mBatt)} A`} lit={battOk} />
      <Box x={238} y={6} w={96} label="EXT PWR" value={e.ext ? "28.0 V" : "unplugged"} lit={e.ext} />
      {W("M286 38 V48 H170", e.ext)}
      <circle cx={170} cy={48} r={2.6} className={"j" + (batSide ? " on" : "")} />
      {/* MASTER switch: ALT and BAT halves */}
      {W("M54 38 V59", E.altOn)}{W("M54 73 V86", node)}
      <Sw x={54} y={66} closed={e.alt} top={E.altOn} bot={node} label="ALT" side={-1} />
      {W("M170 38 V59", batSide)}{W("M170 73 V86", node)}
      <Sw x={170} y={66} closed={e.bat} top={batSide} bot={node} label="BAT" />
      <text x={112} y={70} textAnchor="middle" className="d">MASTER</text>
      {/* J-box main node */}
      <rect className={"b" + (node ? " on" : "")} x={6} y={86} width={328} height={24} rx={4} />
      <text x={16} y={102}>J-BOX <tspan className="d">power distribution module</tspan></text>
      <text x={326} y={102} textAnchor="end" className="d">{node ? E.node.toFixed(1) + " V" : "0 V"}</text>
      {/* feeder breakers → ELECTRICAL BUS 1 / 2 */}
      {W("M54 110 V122", node)}{W("M54 134 V146", on("E1"))}
      <Cb x={54} y={128} open={fB} top={node} bot={on("E1")} label="FEEDER B" />
      {W("M286 110 V122", node)}{W("M286 134 V146", on("E2"))}
      <Cb x={286} y={128} open={fA} top={node} bot={on("E2")} label="FEEDER A" side={-1} />
      <Box x={6} y={146} w={96} label="ELEC BUS 1" value={V("E1")} lit={on("E1")} />
      <Box x={238} y={146} w={96} label="ELEC BUS 2" value={V("E2")} lit={on("E2")} />
      {/* diode-ORed CROSSFEED and ESSENTIAL buses */}
      {W("M98 178 V258 H108 M98 210 H108", on("E1"))}
      {W("M118 210 H128", on("XF"))}{W("M118 258 H128", on("ESS"))}
      <circle cx={98} cy={210} r={2.6} className={"j" + (on("E1") ? " on" : "")} />
      <Diode x={113} y={210} dir={1} lit={on("E1")} /><Diode x={113} y={258} dir={1} lit={on("E1")} />
      {W("M242 178 V258 H232 M242 210 H232", on("E2"))}
      {W("M222 210 H212", on("XF"))}{W("M222 258 H212", on("ESS"))}
      <circle cx={242} cy={210} r={2.6} className={"j" + (on("E2") ? " on" : "")} />
      <Diode x={227} y={210} dir={-1} lit={on("E2")} /><Diode x={227} y={258} dir={-1} lit={on("E2")} />
      <Box x={128} y={194} w={84} label="CROSSFEED" value={V("XF")} lit={on("XF")} />
      <Box x={128} y={242} w={84} label="ESSENTIAL" value={V("ESS")} lit={on("ESS")} />
      {/* avionics buses: AVN breaker → AVIONICS switch half */}
      {W("M26 178 V194", on("E1"))}{W("M26 206 V229", on("E1") && !a1)}{W("M26 243 V262", on("AV1"))}
      <Cb x={26} y={200} open={a1} top={on("E1")} bot={on("E1") && !a1} label="AVN 1" />
      <Sw x={26} y={236} closed={e.avn1} top={on("E1") && !a1} bot={on("AV1")} label="BUS 1" sub="AVIONICS" />
      <Box x={6} y={262} w={80} label="AVN BUS 1" value={V("AV1")} lit={on("AV1")} />
      {W("M314 178 V194", on("E2"))}{W("M314 206 V229", on("E2") && !a2)}{W("M314 243 V262", on("AV2"))}
      <Cb x={314} y={200} open={a2} top={on("E2")} bot={on("E2") && !a2} label="AVN 2" side={-1} />
      <Sw x={314} y={236} closed={e.avn2} top={on("E2") && !a2} bot={on("AV2")} label="BUS 2" sub="AVIONICS" side={-1} />
      <Box x={254} y={262} w={80} label="AVN BUS 2" value={V("AV2")} lit={on("AV2")} />
      {/* standby battery → STBY BATT switch → STDBY BATT breaker → ESSENTIAL */}
      {W("M170 274 V300", on("ESS"))}{W("M170 312 V329", sbMid)}{W("M170 343 V356", sbBat)}
      <Cb x={170} y={306} open={!sbIn} top={on("ESS")} bot={sbMid} label="STDBY BATT" />
      <Sw x={170} y={336} closed={arm} top={sbMid} bot={sbBat} label={e.stby} sub="STBY BATT" />
      <Box x={110} y={356} w={120} label="STBY BATTERY" value={`${stbyWord} · ${amp(E.sBatt)} A`} lit={stbyOk} />
      {/* key */}
      <g className="key">
        <Diode x={14} y={322} dir={1} lit={false} /><text x={28} y={326} className="d">diode</text>
        <path d="M14 337 a6.5 6.5 0 0 1 0 12" className="w" /><Term x={14} y={337} lit={false} /><Term x={14} y={349} lit={false} /><text x={28} y={347} className="d">breaker</text>
        <path d="M14 372 L23 362" className="w" /><Term x={14} y={360} lit={false} /><Term x={14} y={372} lit={false} /><text x={28} y={369} className="d">switch</text>
        <path d="M8 386 H22" className="w on" /><text x={28} y={389} className="d">live</text>
      </g>
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

/** The airplane's G1000 NAV III annunciation set (POH 7-51) with levels, tones and triggers. */
export const Nav3AnnTable = ({ defs }: { defs: Nav3AnnDef[] }) =>
  <Facts rows={defs.map((a) => [<b key={a.text} style={{ color: a.level === "w" ? "var(--warn)" : "#B98A00" }}>{a.text}</b>, `${a.level === "w" ? "Warning" : "Caution"} · ${a.tone} tone · ${a.trigger} (${a.cite})`])} />;

