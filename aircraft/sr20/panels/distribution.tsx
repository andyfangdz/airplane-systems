"use client";
import { Box, Cb, Diode, Fuse, Key, Sw, W } from "@/components/ui/wiring";
import type { Elec, Sim } from "../model";

const V = (v: number) => (v > 0 ? v.toFixed(1) + " V" : "0 V");
const amp = (a: number) => (a > 0 ? "+" : "") + a + " A";

/**
 * Live single-line diagram of the power distribution the solver models (POH §7 Power Distribution): ALT 1 and BAT 1 feed Main Dist Bus 1,
 * ALT 2 feeds Main Dist Bus 2, and MDB 1 backs MDB 2 up through a diode (never the reverse); both feed the Ess Dist Bus through
 * diodes. All three are in the MCU. The breaker-panel buses hang off them (grouped by the bus that feeds them); BAT 2 reaches
 * only the essential buses, through its breaker and switch, and BAT 1 feeds the CONV BUS directly through a 5 A fuse.
 * The ALT switches are drawn in the alternator output for clarity (they switch the field). Symmetric about x = 170 like the
 * Cessna diagram, so it reads at phone width.
 */
export function PowerDiagram({ s, E }: { s: Sim; E: Elec }) {
  const e = s.elec;
  const m1 = E.mdb1 > 0, m2 = E.mdb2 > 0, edb = E.edb > 0, ess = E.ess1 > 0;
  const bat1Charged = !E.bat1Dead, bat1Side = bat1Charged || (e.bat1 && m1);
  const b2In = !s.cb["BAT 2"], bat2Charged = !E.bat2Dead;
  const b2Mid = b2In && (ess || (e.bat2 && bat2Charged)), b2Bat = bat2Charged || (e.bat2 && b2In && ess);
  const avIn = !s.cb["AVIONICS"], av1 = E.main1 > 0 && avIn;
  const bat1Word = e.fail.bat1 ? "failed" : E.bat1Dead ? "flat" : E.bat1ok ? amp(E.b1) : "0 A";
  const bat2Word = E.bat2Dead ? "flat" : !E.bat2ok ? "isolated" : E.bat2Supplying ? "supplying" : "charging";
  return (
    <svg className="wiring" viewBox="0 0 340 360" role="img" aria-label="SR20 power distribution single-line diagram">
      {/* sources */}
      <Box x={6} y={6} w={58} label="ALT 1" value={E.alt1 ? amp(E.a1) : e.fail.alt1 ? "failed" : "off"} lit={E.alt1} />
      <Box x={72} y={6} w={58} label="BAT 1" value={bat1Word} lit={bat1Charged} />
      <Box x={238} y={6} w={96} label="ALT 2" value={E.alt2 ? amp(E.a2) : e.fail.alt2 ? "failed" : "off line"} lit={E.alt2} />
      {/* CONV BUS: straight off BAT 1, ahead of its relay */}
      <W d="M130 22 H135 M147 22 H152" lit={E.conv > 0} />
      <Fuse x={141} y={22} lit={E.conv > 0} />
      <text x={141} y={13} textAnchor="middle" className="d s">5 A</text>
      <Box x={152} y={6} w={64} label="CONV BUS" value={V(E.conv)} lit={E.conv > 0} />
      {/* bolster master switches */}
      <W d="M35 38 V59" lit={E.alt1} /><W d="M35 73 V86" lit={m1} />
      <Sw x={35} y={66} closed={e.alt1} top={E.alt1} bot={m1} label="ALT 1" />
      <W d="M101 38 V59" lit={bat1Side} /><W d="M101 73 V86" lit={m1} />
      <Sw x={101} y={66} closed={e.bat1} top={bat1Side} bot={m1} label="BAT 1" />
      <W d="M286 38 V59" lit={E.alt2} /><W d="M286 73 V86" lit={m2} />
      <Sw x={286} y={66} closed={e.alt2} top={E.alt2} bot={m2} label="ALT 2" side={-1} />
      {/* MCU: the three distribution buses and their diodes */}
      <rect className="area" x={2} y={80} width={336} height={104} rx={6} />
      <text x={8} y={178} className="d s">MCU</text>
      <Box x={6} y={86} w={124} label="MAIN DIST 1" value={V(E.mdb1)} lit={m1} />
      <Box x={210} y={86} w={124} label="MAIN DIST 2" value={V(E.mdb2)} lit={m2} />
      <W d="M130 102 H165" lit={m1} /><Diode x={170} y={102} dir={1} lit={m1} /><W d="M175 102 H210" lit={m2} />
      <W d="M110 118 V158 H113" lit={m1} /><Diode x={118} y={158} dir={1} lit={m1} />
      <W d="M230 118 V158 H227" lit={m2} /><Diode x={222} y={158} dir={-1} lit={m2} />
      <W d="M123 158 H128 M217 158 H212" lit={edb} />
      <Box x={128} y={142} w={84} label="ESS DIST" value={V(E.edb)} lit={edb} />
      {/* breaker-panel buses */}
      <W d="M52 118 V200" lit={m1} />
      <Box x={6} y={200} w={92} label={["MAIN BUS 3", "A/C BUS 1, 2"]} value={V(E.mdb1)} lit={m1} />
      <W d="M288 118 V200" lit={m2} />
      <Box x={242} y={200} w={92} label={["MAIN BUS 1, 2", "NON ESS BUS"]} value={V(E.mdb2)} lit={m2} />
      <W d="M170 174 V200" lit={edb} />
      <Box x={114} y={200} w={112} label="ESS BUS 1, 2" value={V(E.ess1)} lit={ess} />
      {/* MAIN BUS 1 → AVIONICS breaker → AVIONICS switch → AVIONICS BUS */}
      <W d="M288 244 V262" lit={E.main1 > 0} /><W d="M288 274 V293" lit={av1} /><W d="M288 307 V322" lit={E.avx > 0} />
      <Cb x={288} y={268} open={!avIn} top={E.main1 > 0} bot={av1} label="AVIONICS" side={-1} />
      <Sw x={288} y={300} closed={e.avionics} top={av1} bot={E.avx > 0} label={e.avionics ? "ON" : "OFF"} sub="AVIONICS" side={-1} />
      <Box x={242} y={322} w={92} label="AVIONICS BUS" value={V(E.avx)} lit={E.avx > 0} />
      {/* essential buses → BAT 2 breaker → BAT 2 switch → BAT 2 */}
      <W d="M170 232 V250" lit={ess} /><W d="M170 262 V283" lit={b2Mid} /><W d="M170 297 V312" lit={b2Bat} />
      <Cb x={170} y={256} open={!b2In} top={ess} bot={b2Mid} label="BAT 2" side={-1} />
      <Sw x={170} y={290} closed={e.bat2} top={b2Mid} bot={b2Bat} label={e.bat2 ? "ON" : "OFF"} sub="BAT 2" side={-1} />
      <Box x={120} y={312} w={100} label="BAT 2" value={bat2Word} lit={bat2Charged} />
      <Key x={8} y={262} />
    </svg>
  );
}
