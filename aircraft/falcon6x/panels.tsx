"use client";
import type { AircraftDef } from "../types";
import { Facts, H3, PartsList, Small, TryLink } from "@/components/ui/controls";
import { selectSys } from "@/lib/fleet";
import { sysVars } from "@/lib/systems";
import { useView } from "@/lib/view";
import { FlaperonDemo } from "./FlaperonDemo";
import { CAT } from "./parts";
import { SYS } from "./systems";

function Overview() {
  const theme = useView((v) => v.theme);
  return (
    <>
      <p className="lead">
        The Falcon 6X is a long-range business jet with two aft-mounted turbofans. Follow the swept wing to its
        flaperons, or use X-ray to look inside the cabin and flight deck.
      </p>
      <TryLink sys="controls" mark="falcon6x-high-lift" title="Explore the flaperons">
        Lower both flaperons, then select a roll input to see how the pair moves.
      </TryLink>
      <H3>Performance</H3>
      <Facts
        rows={[
          ["Range at Mach 0.80", "5,500 nm"],
          ["Range at Mach 0.85", "5,100 nm"],
          ["Maximum operating Mach", "0.90"],
          ["Maximum certified altitude", "51,000 ft"],
        ]}
      />
      <Small>Dassault’s range figures assume eight passengers, three crew and NBAA IFR reserves.</Small>
      <div className="overview-systems">
        <H3>Systems</H3>
        <div className="overview-grid">
          {SYS.slice(1).map((system) => (
            <button
              key={system.id}
              type="button"
              style={sysVars(system.id, theme)}
              onClick={() => selectSys(system.id)}
            >
              <b>{system.name}</b>
              <span>{system.blurb}</span>
            </button>
          ))}
        </div>
      </div>
      <H3>Dassault references</H3>
      <ul className="notes">
        <li>
          <a href="https://www.dassaultfalcon.com/businessjets/falcon-6x/" target="_blank" rel="noreferrer">
            Falcon 6X specifications
          </a>
        </li>
        <li>
          <a
            href="https://www.marketingfalcon.com/brochures/6XFactsFigures/SK90Q7rK7:PjcHTGLv"
            target="_blank"
            rel="noreferrer"
          >
            Facts &amp; Figures · September 2023
          </a>
        </li>
        <li>
          <a
            href="https://www.marketingfalcon.com/brochures/6XOverview/SK90Q7rK7:MaL7e2oH"
            target="_blank"
            rel="noreferrer"
          >
            Falcon 6X Overview · June 2026
          </a>
        </li>
      </ul>
      <p className="disc">
        This study model uses published dimensions. Component shapes, positions and movement are approximate.
      </p>
    </>
  );
}

function Airframe() {
  return (
    <>
      <p className="lead">
        Turn off X-ray to see the F-WSIX demonstrator’s paint. Follow the polished leading edges out to the curved
        wingtips, then orbit behind the jet to see how the horizontal stabilizer meets the fin above the engines.
      </p>
      <Facts
        rows={[
          ["Wingspan", "25.94 m · 85.1 ft"],
          ["Length", "25.68 m · 84.3 ft"],
          ["Height", "7.47 m · 24.5 ft"],
          ["Wing area", "72.4 m² · 779.3 ft²"],
        ]}
      />
      <H3>Locate on the airframe</H3>
      <PartsList cat={CAT} sys="airframe" />
    </>
  );
}

function Engines() {
  return (
    <>
      <p className="lead">
        A pylon on each side of the aft fuselage carries a Pratt &amp; Whitney Canada PW812D. Look into either inlet to
        locate the fan at the front of the nacelle.
      </p>
      <Facts
        rows={[
          ["Engine type", "High-bypass turbofan"],
          ["Thrust per engine", "13,500 lbf · 60 kN at sea level, ISA"],
          ["Fan", "Single-piece bladed disk"],
          ["Combustor", "TALON X"],
        ]}
      />
      <H3>Locate the engines</H3>
      <PartsList cat={CAT} sys="engine" />
    </>
  );
}

function Controls() {
  return (
    <>
      <p className="lead">
        The digital flight control system coordinates the control surfaces in pitch, roll and yaw. On each wing, a
        flaperon combines the high-lift function of a flap with the roll control of an aileron.
      </p>
      <FlaperonDemo />
      <H3>Locate the flight controls</H3>
      <PartsList cat={CAT} sys="controls" />
    </>
  );
}

function Cabin() {
  return (
    <>
      <p className="lead">
        The passenger cabin extends aft from the entry area in three lounge zones. A skylight brings daylight into the
        entry, while windows run along both sides of the cabin.
      </p>
      <Facts
        rows={[
          ["Length", "12.30 m · 40.3 ft"],
          ["Width", "2.58 m · 102 in"],
          ["Height", "1.98 m · 78 in"],
          ["Typical seating", "14 passengers"],
          ["Cabin windows", "Up to 30, plus the skylight"],
        ]}
      />
      <Small>Cabin length excludes the flight deck and baggage compartment. The model shows a 12-seat example.</Small>
      <H3>Locate in the cabin</H3>
      <PartsList cat={CAT} sys="cabin" />
    </>
  );
}

function FlightDeck() {
  return (
    <>
      <p className="lead">
        The crew uses sidesticks to command the digital flight controls. Ahead of the crew, the EASy IV flight deck
        presents navigation and aircraft information.
      </p>
      <Facts
        rows={[
          ["Avionics", "EASy IV with Honeywell Primus Epic"],
          ["FalconEye", "Combines camera imagery with synthetic terrain on the head-up display"],
          ["Flight planning", "Graphical flight planning and electronic charts"],
        ]}
      />
      <H3>Locate in the flight deck</H3>
      <PartsList cat={CAT} sys="avionics" />
    </>
  );
}

export const PANELS: AircraftDef["panels"] = {
  overview: Overview,
  airframe: Airframe,
  engine: Engines,
  controls: Controls,
  cabin: Cabin,
  avionics: FlightDeck,
};
