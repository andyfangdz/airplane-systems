"use client";
import { BUSES, fuelAvail } from "../model";
import { DISTRIBUTION_DIAGRAM, ELECTRICAL_FACTS } from "../electrical-installation";
import { useSR20 } from "../store";
import { PowerDiagram } from "../../cirrus/distribution";
import { BusCard, PowerControls } from "../../cirrus/panels";
import { Caution, Ctl, Facts, H3, Notes, Small } from "@/components/ui/controls";

export function Electrical() {
  const s = useSR20((x) => x.s),
    E = useSR20((x) => x.E),
    up = useSR20((x) => x.update);
  return (
    <>
      <p className="lead">
        Two alternators and two batteries feed three distribution buses inside the Master Control Unit. A diode lets
        Main Dist Bus 1 back up Bus 2 but never the reverse. The essential buses can be fed from every source, so
        remaining sources can continue supplying the flight-critical loads (POH 7-49–7-53).
      </p>
      <H3>Bolster master switches</H3>
      <Ctl>
        <PowerControls
          s={s}
          E={E}
          up={up}
          fuelAvail={fuelAvail}
          digits={1}
          timeLabel="Time on batteries (after ALT failure)"
        />
      </Ctl>
      <Small>
        Currents are illustrative, anchored to a normal G6 readout (ALT 1 +23 A, ALT 2 +13 A, BAT 1 +1 A, ESS 28.0 V, M1
        27.7 V, M2 28.7 V). Battery times use the Costanzo training deck&apos;s rule of thumb — actual endurance depends
        on load shedding.
      </Small>
      <H3>Power distribution (Figure 7-10)</H3>
      <PowerDiagram
        distribution={DISTRIBUTION_DIAGRAM}
        s={s}
        E={E}
        digits={1}
        label="SR20 power distribution single-line diagram after POH Figure 7-10"
        desc="Main distribution 1 can supply main distribution 2 through an 80 amp fuse and diode. ALT 2 cannot supply main distribution 1. BAT 2 supplies the essential buses through its breaker and ESSENTIAL POWER. The master alternator switches control field circuits; the symbols here summarize that control. External power and the starter contactor are represented in the 3D hardware."
      />
      <Small>
        Main Dist Bus 1, Main Dist Bus 2 and the Ess Dist Bus are inside the Master Control Unit; the buses below them
        are on the circuit-breaker panel, the main and A/C buses grouped by the distribution bus that feeds them. With
        both alternators failed BAT 1 feeds the Ess Dist Bus directly; with BAT 1 gone too, BAT 2 feeds ESS BUS 1, and
        ESS BUS 2 back through ESSENTIAL POWER (POH 7-52–7-55). Pull ESSENTIAL POWER, BAT 2 or AVIONICS below, or flip a
        switch, to watch it change.
      </Small>
      <H3>Battery endurance (rule of thumb)</H3>
      <Facts
        rows={[
          ["ALT 2 fails", "ALT 1 powers Main Dist Bus 2 through the diode — no time limit"],
          ["ALT 1 fails", "BAT 1 carries Main Dist Bus 1 ≈ 30 min, then it drops off"],
          ["Both fail", "BAT 1 carries both main buses ≈ 15 min, then BAT 2 carries the essential buses ≈ 45 min"],
        ]}
      />
      <H3>Circuit-breaker buses</H3>
      <Small>
        Tap a breaker to pull it (white collar showing) or reset it. Pulled breakers remove that load everywhere in the
        model — try FLAPS, PFD A + PFD B, ALT 1, or STALL WARNING.
      </Small>
      <div className="buses">
        {BUSES.map(([id, name, src, loads]) => (
          <BusCard key={id} name={name} src={src} loads={loads} v={E[id]} digits={1} cb={s.cb} up={up} />
        ))}
      </div>
      <H3>Details</H3>
      <Facts
        rows={[
          ["ALT 1", `${ELECTRICAL_FACTS.alt1Rating.value} A, right front, ${ELECTRICAL_FACTS.alt1Voltage.value} V`],
          ["ALT 2", `${ELECTRICAL_FACTS.alt2Rating.value} A, left front, ${ELECTRICAL_FACTS.alt2Voltage.value} V`],
          [
            "BAT 1",
            `${ELECTRICAL_FACTS.bat1Voltage.value} V, ${ELECTRICAL_FACTS.bat1Capacity.value} Ah, right firewall`,
          ],
          ["BAT 2", `2 × 12 V, ${ELECTRICAL_FACTS.bat2Capacity.value} Ah, aft of FS 222`],
          ["ALT 1 start", "Needs BAT 1 on"],
          ["ALT 2 start", "Needs BAT 1 or BAT 2 on"],
          ["External power", "28 V regulated; BAT 1 must be on"],
          ["Lightning", "Two console TVS plus eight harness TVS with dual ADAHRS (AMM 24-50 p. 3)"],
        ]}
      />
      <H3>Inside the MCU and its wiring</H3>
      <Facts
        rows={[
          [
            "Alternator control",
            "Separate field relays and voltage regulators; ALT switches control field power, not the output cables",
          ],
          ["ALT 1 field", "5 A ALT 1 breaker on A/C BUS 1; BAT 1 needed for initial excitation (POH 7-55)"],
          ["ALT 2 field", "5 A ALT 2 breaker on ESS BUS 2; BAT 1 or BAT 2 needed for initial excitation (POH 7-55)"],
          [
            "MCU contactors",
            "BAT 1, starter and external-power relays; BAT 2 relay is next to its battery (AMM 24-30 pp. 4–5)",
          ],
          [
            "MCU sensing",
            "Three current shunts send measurements to the GEA engine airframe unit (AMM 24-30 p. 5; POH 7-56)",
          ],
          [
            "Source protection",
            "ALT 1: 100 A fuse; BAT 1 main feed: 125 A in Fig 7-10; MDB 1 → MDB 2: 80 A fuse and diode",
          ],
          ["Essential protection", "Two 50 A feeds into ESS DIST; eight separate 30 A breaker-bus feeders (POH 7-51)"],
          ["BAT 2 construction", "Series connection gives 24 V at 7 Ah; a local relay connects it to ESS BUS 1"],
          [
            "Ground power contacts",
            "Two longer power contacts and one short relay-control contact; reverse polarity prevents relay engagement (AMM 24-40 p. 1)",
          ],
        ]}
      />
      <Notes
        items={[
          "Source disagreement: POH 7-51 text specifies an 80 A ALT 2 output fuse, while Fig 7-10 (7-50) and SR20 AMM 24-30 p. 1 / 24-50 p. 1 specify 60 A. The model uses the POH text and records the disagreement; it does not imply a maintenance replacement rating.",
          "Both SR20 IO-390 alternators are belt driven. The right-front 100 A and left-front 70 A units use separate schematic belt lanes. SR22T alternator drives and voltage settings are not substituted.",
          "MCU component positions, harness lanes and cable sizes are schematic. Relays glow with control power; digital data and electrical power use separate paths. External power hardware is shown, but connecting a ground source is not simulated.",
          "The constant-power CONV bus connects to BAT 1 ahead of its master relay, through a 5 A fuse on top of the MCU. It powers the convenience-light controller and optional gateway even with the masters off.",
        ]}
      />
      <Caution title="Caution">
        Running with the alternators off drains the batteries until the battery relay opens, removing alternator field
        power and preventing a restart.
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
