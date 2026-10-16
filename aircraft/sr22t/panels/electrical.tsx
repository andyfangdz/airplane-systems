"use client";
import { busTable, fuelAvail } from "../model";
import { useSR22T } from "../store";
import { PowerDiagram } from "../../cirrus/distribution";
import { BusCard, PowerControls } from "../../cirrus/panels";
import { Caution, Ctl, Facts, H3, Notes, Small } from "@/components/ui/controls";

export function Electrical() {
  const s = useSR22T((x) => x.s),
    E = useSR22T((x) => x.E),
    up = useSR22T((x) => x.update);
  return (
    <>
      <p className="lead">
        Two alternators and two batteries feed three distribution buses inside the Master Control Unit. A diode lets
        Main Dist Bus 1 back up Bus 2 but never the reverse, and the essential buses can be fed from every source — so a
        single failure never takes out the flight-critical loads.
      </p>
      <H3>Bolster master switches</H3>
      <Ctl>
        <PowerControls
          s={s}
          E={E}
          up={up}
          fuelAvail={fuelAvail}
          digits={2}
          timeLabel="Time with BAT 2 as sole source"
        />
      </Ctl>
      <Small>
        Currents, battery voltages and diode drop are illustrative. ALT 1 regulates M1 to 28 V and ALT 2 regulates M2 to
        28.75 V (SR22T POH 13772-007 7-47). BAT 1 has no published endurance and is not depleted by the timeline.
      </Small>
      <H3>Power distribution (Figure 7-10)</H3>
      <PowerDiagram s={s} E={E} digits={2} label="SR22T power distribution single-line diagram after POH Figure 7-10" />
      <Small>
        Main Dist Bus 1, Main Dist Bus 2 and the Ess Dist Bus are inside the Master Control Unit; the buses below them
        are on the circuit-breaker panel, the main and A/C buses grouped by the distribution bus that feeds them. With
        both alternators failed BAT 1 feeds the Ess Dist Bus directly; with BAT 1 gone too, BAT 2 feeds ESS BUS 1, and
        ESS BUS 2 back through ESSENTIAL POWER (POH 7-50; Fig 7-10 on 7-48). Pull ESSENTIAL POWER, BAT 2 or AVIONICS
        below, or flip a switch, to watch it change.
      </Small>
      <H3>Battery endurance (POH 3-17)</H3>
      <Facts
        rows={[
          [
            "BAT 2 alone",
            "With ALT 1, ALT 2 and BAT 1 off, BAT 2 keeps the PFD operational for approximately 30 minutes (POH 3-17)",
          ],
          ["BAT 1", "No published endurance; this model does not deplete BAT 1 on a timer"],
        ]}
      />
      <H3>Circuit-breaker buses</H3>
      <Small>
        Tap a breaker to pull it (white collar showing) or reset it. Pulled breakers remove that load everywhere in the
        model — try FLAPS, PFD A + PFD B, ALT 1, or STALL WARNING.
      </Small>
      <Small>
        {s.equip.fiki
          ? "Breaker panel with FIKI ice protection: ICE PROTECT 1 and 2 and STALL VANE HEAT (POH Fig 7-11)."
          : "Breaker panel without ice protection: ICE LIGHTS on MAIN BUS 1 (AMM 30-80)."}{" "}
        Change the equipment on the Overview.
      </Small>
      <div className="buses">
        {busTable(s.equip).map(([id, name, src, loads]) => (
          <BusCard key={id} name={name} src={src} loads={loads} v={E[id]} digits={2} cb={s.cb} up={up} />
        ))}
      </div>
      <Small>
        Fuse conflict: POH 7-49 text specifies 80 A for ALT 2 and the interconnect; Figure 7-10 prints 60 A. AMM 24-30
        text and Figure 24-30-1 also disagree. POH text governs this model. Breaker ratings: POH 7-50 to 7-61; ESSENTIAL
        POWER 20 A from AMM 24-50 PDF p. 750, AP SERVOS 5 A and YAW SERVO 3 A from AMM 22-10 PDF pp. 555–556.
      </Small>
      <H3>Details</H3>
      <Facts
        rows={[
          ["ALT 1", "100 A, gear-driven, right front, 28 V (POH 7-47)"],
          ["ALT 2", "70 A, belt-driven, left front, 28.75 V (POH 7-47)"],
          ["BAT 1", "24 V, 10 Ah, right firewall (POH 7-47; AMM 24-00 says 11 Ah; POH governs)"],
          ["BAT 2", "2 × 12 V, 7 Ah, aft of FS 222"],
          ["ALT 1 start", "Needs BAT 1 on"],
          ["ALT 2 start", "Needs BAT 1 or BAT 2 on"],
          ["External power", "28 V regulated; BAT 1 must be on"],
          ["Lightning", "TVS suppressors at bus entry points"],
        ]}
      />
      <Caution title="Caution">
        Alternators are self-exciting and need battery voltage to start: do not turn the batteries off in flight (POH
        7-47).
      </Caution>
      <H3>CAS by failure (G6)</H3>
      <Facts
        rows={[
          ["ALT 2 fails", "ALT 2"],
          ["ALT 1 fails", "ALT 1 · M BUS 1"],
          ["Both fail", "ALT 1 · ALT 2 · M BUS 1 · M BUS 2 · ESS BUS (red)"],
          ["BATT 1", "Battery 1 discharging with ALT 1 working: an MCU fault, not an ALT 1 failure (not modelled)"],
        ]}
      />
      <H3>Ground check logic</H3>
      <Notes
        items={[
          "BAT 2 alone should power only ESS BUS 1 and 2. Anything else lit means the interconnect diode has failed.",
          "Turn AVIONICS off before master switches, engine start or external power.",
        ]}
      />
    </>
  );
}
