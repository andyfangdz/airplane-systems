"use client";
import { Box, Cb, Diode, Dot, Key, Sw, Term, W, wire } from "@/components/ui/wiring";
import type { Elec, Sim } from "../model";

const V = (v: number) => (v > 0 ? v.toFixed(1) + " V" : "0 V");

/**
 * Live single-line diagram after the AFM's simplified wiring diagram for serial numbers with Essential Bus (7.11; Rev. 8 p. 7-41,
 * Rev. 7 p. 7-38), with the G1000 / GFC 700 airplane's distribution the solver models (AMM-E 190-00545-01 Fig. 2-3): the AFM
 * figure is drawn for conventional instruments, with an ESSENTIAL AVIONIC BUS behind a second avionics relay, which the G1000
 * airplane does not have (those loads sit on ESSENTIAL), and without the optional tie relay bypass diode (OAM 40-126). Layout:
 * battery → battery relay (BAT) → relay-box bus bar (external power and the starter join here) → BATT 70 A → ESSENTIAL;
 * alternator → ALT 70 A → MAIN; ESSENTIAL → ESS TIE → tie relay ‖ bypass diode (MAIN → ESS only) → MAIN TIE → MAIN, the relay
 * opened by ESS. BUS ON; MAIN → AV BUSS → avionics master relay → MAIN AVIONICS; HORIZON (ESSENTIAL) or the emergency battery
 * → standby attitude and flood light, chosen by the HORIZON EMERGENCY switch. Both relay coils take power through MSTR CNTRL
 * (not drawn). The ALT switch is drawn in the alternator output for clarity (it switches the field). viewBox 340 wide, like
 * the Cessna and SR20 diagrams.
 */
export function PowerDiagram({ s, E }: { s: Sim; E: Elec }) {
  const e = s.elec, out = (n: string) => !!s.cb[n];
  const ess = E.ess > 0, main = E.main > 0, av = E.av > 0;
  const batCharged = !e.fail.bat && !E.batDead, batSide = batCharged || (e.bat && E.bar);
  const altWire = E.altOn || (main && !out("ALT"));
  // either side of the tie relay: the bypass diode lets the MAIN side reach the ESSENTIAL side, never the reverse
  const essSide = !out("ESS TIE") && ess, mainSide = !out("MAIN TIE") && main;
  const nodeB = mainSide || (E.tieClosed && essSide), nodeA = essSide || nodeB;
  const avMid = main && !out("AV BUSS"), avRelay = e.avMaster && !out("MSTR CNTRL");
  const hzMid = ess && !out("HORIZON"), emergOk = !E.emergDead;
  const batWord = e.fail.bat ? "failed" : E.batDead ? "flat" : E.batCharging ? "charging" : E.batLoad > 0 ? `−${E.batLoad.toFixed(1)} A` : "0 A";
  return (
    <svg className="wiring" viewBox="0 0 340 338" role="img" aria-label="DA40 power distribution single-line diagram">
      {/* sources */}
      <Box x={6} y={6} w={78} label="BATTERY" value={batWord} lit={batCharged} />
      <Box x={131} y={6} w={78} label="EXT PWR" value={e.ext ? "28.0 V" : "unplugged"} lit={e.ext} />
      <Box x={256} y={6} w={78} label="ALTERNATOR" value={E.altFeed ? `${E.amps} A` : e.fail.alt ? "failed" : "off line"} lit={E.altOn} />
      {/* battery relay (BAT) and ground power → relay-box bus bar */}
      <W d="M45 38 V59" lit={batSide} /><W d="M45 73 V86" lit={E.bar} />
      <Sw x={45} y={66} closed={e.bat} top={batSide} bot={E.bar} label="BAT" />
      <W d="M170 38 V86" lit={e.ext} />
      <rect className={"b" + (E.bar ? " on" : "")} x={6} y={86} width={203} height={24} rx={4} />
      <text x={16} y={102}>BUS BAR <tspan className="d">relay box · starter</tspan></text>
      <W d="M45 110 V122" lit={E.bar} /><W d="M45 134 V146" lit={ess} />
      <Cb x={45} y={128} open={out("BATT")} top={E.bar} bot={ess} label="BATT" />
      {/* alternator (ALT) → ALT breaker → MAIN */}
      <W d="M295 38 V59" lit={E.altOn} /><W d="M295 73 V122" lit={altWire} /><W d="M295 134 V146" lit={main} />
      <Sw x={295} y={66} closed={e.alt} top={E.altOn} bot={altWire} label="ALT" side={-1} />
      <Cb x={295} y={128} open={out("ALT")} top={altWire} bot={main} label="ALT" side={-1} />
      <Box x={6} y={146} w={78} label="ESSENTIAL" value={V(E.ess)} lit={ess} />
      <Box x={256} y={146} w={78} label="MAIN" value={V(E.main)} lit={main} />
      {/* ESS TIE → tie relay ‖ bypass diode → MAIN TIE */}
      <W d="M84 162 H102" lit={ess} /><W d="M114 162 H163 M136 162 V140 H165" lit={nodeA} />
      <W d="M177 162 H226 M175 140 H204 V162" lit={nodeB} /><W d="M238 162 H256" lit={main} />
      <Cb x={108} y={162} open={out("ESS TIE")} top={ess} bot={nodeA} label="ESS TIE" h />
      <Dot x={136} y={162} lit={nodeA} /><Dot x={204} y={162} lit={nodeB} />
      <Diode x={170} y={140} dir={-1} lit={nodeB} />
      <text x={170} y={122} textAnchor="middle" className="d s">bypass diode (OAM 40-126)</text>
      <Sw x={170} y={162} closed={E.tieClosed} top={nodeA} bot={nodeB} label="tie relay" sub={`ESS. BUS ${e.essBus ? "ON" : "OFF"}`} h />
      <Cb x={232} y={162} open={out("MAIN TIE")} top={nodeB} bot={main} label="MAIN TIE" h />
      {/* MAIN → AV BUSS → avionics master relay → MAIN AVIONICS */}
      <W d="M295 178 V194" lit={main} /><W d="M295 206 V229" lit={avMid} /><W d="M295 243 V262" lit={av} />
      <Cb x={295} y={200} open={out("AV BUSS")} top={main} bot={avMid} label="AV BUSS" side={-1} />
      <Sw x={295} y={236} closed={avRelay} top={avMid} bot={av} label={e.avMaster ? "ON" : "OFF"} sub="AVIONIC MASTER" side={-1} />
      <Box x={234} y={262} w={100} label="MAIN AVIONICS" value={V(E.av)} lit={av} />
      {/* ESSENTIAL → HORIZON breaker, or the emergency battery → standby attitude and flood light */}
      <W d="M45 178 V194" lit={ess} /><W d="M45 206 V229" lit={hzMid} />
      <Cb x={45} y={200} open={out("HORIZON")} top={ess} bot={hzMid} label="HORIZON" />
      <Term x={45} y={229} lit={hzMid} /><Term x={61} y={229} lit={emergOk} /><Term x={45} y={243} lit={E.stbyAtt} />
      <path d={e.emerg ? "M45 243 L61 229" : "M45 243 V229"} className={wire(E.stbyAtt)} />
      <W d="M61 229 H90" lit={emergOk} />
      <Box x={90} y={213} w={78} label="EMERG BATT" value={E.emergDead ? "flat" : e.emerg ? "supplying" : "standby"} lit={emergOk} />
      <text x={57} y={254} className="d s">HORIZON EMERGENCY</text>
      <text x={57} y={265}>{e.emerg ? "ON" : "OFF"}</text>
      <W d="M45 243 V274" lit={E.stbyAtt} />
      <Box x={6} y={274} w={116} label="STBY ATT + FLOOD" value={E.stbyAtt ? (e.emerg ? "emergency battery" : "HORIZON (ESS)") : "OFF flag"} lit={E.stbyAtt} />
      <Key x={150} y={262} />
    </svg>
  );
}
