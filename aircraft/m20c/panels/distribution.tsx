"use client";
import { Box, Cb, Dot, Key, Sw, W } from "@/components/ui/wiring";
import type { Elec, Sim } from "../model";

const V = (v: number) => (v > 0 ? v.toFixed(1) + " V" : "0 V");

/**
 * Live single-line diagram of the 1968 M20C electrical system: battery → master relay → bus; alternator → ALT 60 A → bus,
 * field from the bus through ALT FIELD and the regulator; the bus feeds the switch-breaker row and the push-to-reset breaker
 * panel; the starter hangs on the battery side of the relay. Drawn after the Ranger Operator's Manual's Fig. 2-4 schematic
 * (electric-gear circuits omitted). viewBox 340 wide, like the other airplanes' diagrams.
 */
export function PowerDiagram({ s, E }: { s: Sim; E: Elec }) {
  const e = s.elec,
    out = (n: string) => !!s.cb[n];
  const bus = E.bus > 0,
    batSide = E.batOk || (!e.fail.bat && !E.batDead);
  const altWire = E.genOn,
    fieldWire = bus && !out("ALT FIELD");
  const batWord = e.fail.bat
    ? "failed"
    : E.batDead
      ? "flat"
      : E.genOn
        ? `+${E.amps} A`
        : E.batLoad > 0
          ? `−${E.batLoad.toFixed(1)} A`
          : "0 A";
  return (
    <svg className="wiring" viewBox="0 0 340 300" role="img" aria-label="M20C power distribution single-line diagram">
      <Box x={6} y={6} w={90} label="BATTERY 35 Ah" value={batWord} lit={batSide} />
      <Box
        x={244}
        y={6}
        w={90}
        label="ALTERNATOR 60 A"
        value={E.genOn ? "on line" : e.fail.gen ? "failed" : "off line"}
        lit={E.genOn}
      />
      {/* master relay */}
      <W d="M51 38 V59" lit={batSide} />
      <W d="M51 73 V110" lit={bus} />
      <Sw x={51} y={66} closed={e.master} top={batSide} bot={bus} label="MASTER" sub="relay at the battery" />
      {/* starter off the battery side */}
      <W d="M51 46 H110 V60" lit={batSide} />
      <Sw x={110} y={67} closed={E.starterOn} top={batSide} bot={E.starterOn} label="START" sub="key pushed" side={1} />
      <W d="M110 74 V86" lit={E.starterOn} />
      <Box x={92} y={86} w={60} label="STARTER" value={E.starterOn ? "cranking" : "—"} lit={E.starterOn} h={32} />
      {/* alternator → ALT breaker → bus */}
      <W d="M289 38 V62" lit={altWire} />
      <W d="M289 74 V110" lit={bus && !out("ALT")} />
      <Cb x={289} y={68} open={out("ALT")} top={altWire} bot={bus && !out("ALT")} label="ALT 60" side={-1} />
      {/* bus */}
      <rect className={"b" + (bus ? " on" : "")} x={6} y={110} width={328} height={24} rx={4} />
      <text x={16} y={126}>
        BUS <tspan className="d">{V(E.bus)}</tspan>
      </text>
      <Dot x={51} y={110} lit={bus} />
      <Dot x={289} y={110} lit={bus} />
      {/* field: bus → ALT FIELD → regulator → alternator */}
      <W d="M250 134 V156" lit={bus} />
      <W d="M250 168 V180" lit={fieldWire} />
      <Cb x={250} y={162} open={out("ALT FIELD")} top={bus} bot={fieldWire} label="ALT FIELD" side={-1} />
      <Box x={214} y={180} w={72} label="REGULATOR" value={fieldWire ? "14 V" : "no field"} lit={fieldWire} />
      <W d="M286 196 H318 V38" lit={fieldWire} />
      <text x={320} y={100} className="d s" textAnchor="end">
        field
      </text>
      {/* loads */}
      <W d="M51 134 V160" lit={bus} />
      <W d="M140 134 V160" lit={bus} />
      <Box
        x={6}
        y={160}
        w={100}
        label={["SWITCH-BREAKERS", "fuel pump · pitot · beacon", "nav · landing"]}
        value={bus ? "live" : "dead"}
        lit={bus}
      />
      <Box
        x={112}
        y={160}
        w={96}
        label={["PUSH-TO-RESET", "gear & stall warn · ign", "inst · T&B · radios"]}
        value={bus ? "live" : "dead"}
        lit={bus}
      />
      <Key x={6} y={224} />
    </svg>
  );
}
