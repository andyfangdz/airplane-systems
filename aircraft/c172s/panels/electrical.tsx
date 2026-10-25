"use client";
import { StudySection } from "@/components/ui/StudySection";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { Caution, Ctl, Facts, H3, Notes, PartsList, Readouts, Small } from "@/components/ui/controls";
import { NAV3_BUSES } from "../../cessna/electrical";
import { BreakerBoard, Nav3Diagram, Nav3Meters, Nav3Switches } from "../../cessna/panels";
import {
  Nav3BatteryReadouts,
  Nav3Dimmer,
  Nav3GroundAndOutlet,
  Nav3LightSwitches,
  Nav3Scenarios,
  Nav3TripButtons,
} from "../../cessna/electrical-panel";
import { BREAKERS, ELEC_CFG, live, type Sim } from "../model";
import { CAT } from "../parts";
import { scenarioColdDark, useC172 } from "../store";

/** Scenarios restart the standby battery timer. */
const resetTimers = () => {
  live.timers.stby = 0;
};

export function Electrical() {
  const snapshot = useLiveSnapshot(live, 250);
  const s = useC172((x) => x.s),
    E = useC172((x) => x.E),
    up = useC172((x) => x.update);
  const e = s.elec;
  const upE = (fn: (d: Sim["elec"]) => void) => up((d) => fn(d.elec));
  const run = (d: Sim) => {
    d.eng.running = true;
    d.eng.mags = "BOTH";
    if (d.eng.mix < 0.1) d.eng.mix = 0.85;
    if (d.eng.throttle < 0.3 && !d.ground) d.eng.throttle = 0.86;
  };
  return (
    <>
      <p className="lead">
        A 28-volt DC system: a belt-driven 60-ampere alternator with an Alternator Control Unit, a 24-volt main battery
        on the left firewall and a standby battery behind the panel. Everything meets in the power distribution module
        (J-box), which feeds ELECTRICAL BUS 1 and BUS 2; both feed the CROSSFEED and ESSENTIAL buses through diodes, and
        each feeds an avionics bus through the AVIONICS switch. The standby battery takes over the essential bus by
        itself when main bus voltage falls below 20 V (POH 7-47 – 7-58, Figure 7-7).
      </p>
      <H3>Switches</H3>
      <Ctl>
        <Nav3Switches e={e} E={E} up={upE} testHeld={snapshot.testHeld} />
        <Nav3GroundAndOutlet e={e} outlet12={E.outlet12} cabinPwr={s.lights.cabinPwr} upE={upE} up={up} />
        <Nav3Meters E={E} />
        <Nav3BatteryReadouts e={e} E={E} cfg={ELEC_CFG} />
      </Ctl>
      <Small>
        Hold TEST for the 10-second standby battery test with the MASTER off, then ARM: the PFD comes up on the standby
        battery (BUS E ≥ 24 V, M BUS ≤ 1.5 V, S BATT negative, STBY BATT shown) (POH 4-12). “Standby battery weak /
        cold” keeps the TEST lamp out and puts BUS E below 24 V on the standby battery, as the cold-weather note warns
        (POH 4-47); its shorter endurance is illustrative. Currents are illustrative.
      </Small>
      <H3>Failures &amp; scenarios</H3>
      <Ctl>
        <Nav3Scenarios s={s} up={up} run={run} coldDark={scenarioColdDark} onScenario={resetTimers} />
      </Ctl>
      <Small>
        With the alternator failed the main battery carries both main buses until M BUS falls below 20 V; then the
        standby battery carries the essential bus “for at least 30 minutes” (POH 3-17). Speed the battery clock up to
        watch it happen. Battery capacities are assumptions (main 8 Ah per the equipment list; standby not given). CABIN
        PWR 12V feeds the 10 A outlet on the pedestal through the CABIN LTS/PWR breaker: off for takeoff and landing,
        and in both load-shed checklists (POH 2-19, 3-17, 7-77).
      </Small>
      {(E.highVolts || E.mBatt > 40) && (
        <Caution title="HIGH VOLTS annunciator comes on or M BATT amps more than 40">
          MASTER (ALT only) — OFF, then shed load: AVIONICS BUS 1, PITOT HEAT, BEACON, LAND, TAXI, NAV, STROBE, CABIN
          PWR 12V off; keep COM1/NAV1; AVIONICS BUS 2 off unless in cloud; land as soon as practical (POH 3-17).
        </Caution>
      )}
      {E.lowVolts && s.eng.running && (
        <Caution title="LOW VOLTS">
          If it stays on above 1,000 RPM: MASTER (ALT only) OFF → ALT FIELD breaker CHECK IN → MASTER (ALT and BAT) ON →
          check LOW VOLTS off, M BUS ≥ 27.5 V, M BATT charging. If it stays on, MASTER (ALT only) OFF, shed load, land
          as soon as practical (POH 3-19).
        </Caution>
      )}
      <StudySection title="How power flows">
        <H3>Power distribution (Figure 7-7)</H3>
        <Nav3Diagram e={e} E={E} />
      </StudySection>
      <H3>Circuit breakers</H3>
      <Small>
        Tap an ESS or AVN breaker to pull it (white collar) or reset it. ELECTRICAL BUS 1, BUS 2 and CROSSFEED breakers
        can't be pulled (POH 7-57) — they can only trip (amber) and be reset. Ratings shown where a source gives them;
        hover a breaker for its load and source.
      </Small>
      <BreakerBoard breakers={BREAKERS} buses={NAV3_BUSES} E={E} cb={e.cb} up={upE} />
      <Nav3TripButtons cb={e.cb} up={upE} />
      <StudySection title="Reference and source notes">
        <H3>Monitoring (POH 7-53 – 7-56)</H3>
        <Facts
          rows={[
            ["M BUS volts", "Measured at the WARN breaker (CROSSFEED BUS); ~28 V normal, 27–29 V at 1,800 RPM"],
            ["E BUS volts", "Measured at NAV 1 ENG (ESSENTIAL BUS)"],
            ["VOLTS red", "Above 32.0 V or below 24.5 V"],
            ["M BATT amps", "White above −1.5 A; < 5 A charge after 30 min of cruise"],
            ["S BATT amps", "+ white charging, − amber discharging (normally < 4 A)"],
            ["LOW VOLTS", "Red: main bus below 24.5 V (ACU signal)"],
            ["HIGH VOLTS", "Red: bus above 32.0 V — the ACU should have tripped ALT FIELD at ~31.75 V"],
            ["M BATT > 40 A", "Same emergency checklist as HIGH VOLTS: MASTER (ALT only) OFF, shed load (POH 3-17)"],
            ["STBY BATT", "Amber: standby discharging > 0.5 A for > 10 s"],
          ]}
        />

        <Caution title="Caution">
          Both AVIONICS switches OFF before turning the MASTER on or off, starting the engine or connecting external
          power (POH 7-47). MASTER ALT and BAT off before plugging in ground power.
        </Caution>
        <Notes
          items={[
            "There is no hot battery bus: with the MASTER off only the standby battery (ARM) can power anything, and only the essential bus.",
            "On the standby battery alone: PFD, ADC/AHRS, NAV 1/engine unit, COM 1 and standby instrument lights — no MFD, transponder, audio panel or cooling fans (POH 3-38, 7-73).",
            "To stretch the main battery, the POH suggests MASTER (ALT and BAT) OFF and flying on the ESS BUS from the standby battery, saving the main battery for flaps and the landing light (POH 3-38).",
            "ALT FIELD may open during a normal start (nuisance); reset it once. If it opens again after the reset, leave it open and have it fixed before flight (POH 7-56). In flight, attempt one reset only (POH 3-37).",
          ]}
        />
      </StudySection>
      <H3>Components — tap to locate</H3>
      <PartsList cat={CAT} sys="electrical" />
    </>
  );
}

export function Lighting() {
  const s = useC172((x) => x.s),
    E = useC172((x) => x.E),
    up = useC172((x) => x.update);
  const L = s.lights,
    lit = E.lit;
  return (
    <>
      <p className="lead">
        Position lights on the wing tips and the rudder, a strobe in each wing tip, a flashing beacon on top of the fin
        and landing and taxi lights in the left wing leading edge, plus courtesy lights under each wing. Inside: two
        overhead flood lights, a rear dome light, a map light under the pilot&apos;s wheel and internally lit panels on
        four dimmers (POH 7-59 – 7-61).
      </p>
      <H3>LIGHTS switches (up = ON)</H3>
      <Ctl>
        <Nav3LightSwitches L={L} lit={lit} up={up} />
      </Ctl>
      <Small>
        Exterior glows show in the Overview and Lighting views. Trip LAND LT on the Electrical page, or lose BUS 1 or
        BUS 2, to see a light go out. “DOME” is the overhead push button that also works the courtesy lights.
      </Small>
      <H3>Dimmers</H3>
      <Ctl>
        <Nav3Dimmer k="flood" label="FLOOD LIGHT (overhead)" L={L} up={up} />
        <Nav3Dimmer k="swcb" label="SW/CB PANELS" L={L} up={up} />
        <Nav3Dimmer k="pedestal" label="PEDESTAL" L={L} up={up} />
        <Nav3Dimmer k="avionics" label="AVIONICS (off = photocell)" L={L} up={up} />
        <Nav3Dimmer k="stbyInd" label="STBY IND" L={L} up={up} />
        <Readouts
          items={[
            ["Panel lights", lit.panel ? "ON" : "off"],
            ["Standby instruments", lit.stbyInd ? "ON" : "off"],
            ["Map light", lit.map ? "ON (with NAV)" : "off"],
            ["PFD / MFD lighting", L.avionics < 0.03 ? "Photocell (auto)" : `Manual ${Math.round(L.avionics * 100)}%`],
          ]}
        />
        <Small>
          AVIONICS fully counter-clockwise lets the displays set their own brightness by photocell — recommended by day;
          turn it on at night to set the PFD, MFD and audio panel lighting yourself (POH 7-61). STBY IND also lights the
          magnetic compass.
        </Small>
      </Ctl>
      <H3>Lights — tap to locate</H3>
      <PartsList cat={CAT} sys="lighting" />
      <H3>Breakers (Figure 7-7)</H3>
      <Facts
        rows={[
          ["BEACON · LAND", "BCN LT, LAND LT — ELECTRICAL BUS 1"],
          ["TAXI · NAV · STROBE", "TAXI LT, NAV LTS, STROBE LTS — ELECTRICAL BUS 2"],
          ["Panel and pedestal", "PANEL LTS — ELECTRICAL BUS 2"],
          ["Overhead lights, 12 V outlet", "CABIN LTS/PWR — ELECTRICAL BUS 1"],
          ["Standby instrument lights", "STDBY IND LTS — ESSENTIAL BUS"],
          ["Map light", "On NAV LTS: turn NAV on first"],
        ]}
      />
      <Notes
        items={[
          "Don't use the strobes, beacon or recognition lights when flying through cloud or overcast — reflections, particularly at night, can cause vertigo (POH 7-60).",
          "Use the taxi light in the pattern to save the landing light (POH 4-31). Some airplanes have LED landing/taxi/recognition lights in both leading edges with a LAND – RECOG/TAXI – OFF switch.",
          "Light failure: usually a bulb. Check PANEL LTS (inside) or the light's breaker; reset once (POH 7-62).",
          "KOEL: strobes are required for every kind of operation; nav lights and the landing light (for hire) at night.",
        ]}
      />
    </>
  );
}
