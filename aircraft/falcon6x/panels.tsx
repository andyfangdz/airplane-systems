"use client";
import type { AircraftDef } from "../types";
import type { ReactNode } from "react";
import type { Vec3 } from "@/lib/math";
import { BtnRow, Facts, H3, PartsList, Small, TryLink } from "@/components/ui/controls";
import { selectSys } from "@/lib/fleet";
import { sysVars } from "@/lib/systems";
import { useView } from "@/lib/view";
import { FlaperonDemo } from "./FlaperonDemo";
import { useEntryStudy } from "./entry-study";
import { CAT } from "./parts";
import { SYS } from "./systems";

const brochure = "https://www.marketingfalcon.com/brochures/6XOverview/SK90Q7rK7:MaL7e2oH";
const aircraftCertificate = "https://www.easa.europa.eu/en/downloads/138391/en";
const engineCertificate = "https://www.easa.europa.eu/en/downloads/33453/en";
const commonsPhoto = "https://commons.wikimedia.org/wiki/File:F-WSIX_-_Dassault_Falcon_6X.jpg";

function Source({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

function inspect(position: Vec3, target: Vec3, xray: boolean) {
  const view = useView.getState();
  view.set({ xray, focus: null });
  view.flyTo(position, target);
}

function AirstairButton() {
  const open = useEntryStudy((s) => s.open);
  return (
    <button
      type="button"
      className="btn"
      onClick={() => {
        useEntryStudy.setState({ open: !open });
        inspect([10.84, 0.69, -6.4], [8.25, -0.68, -1.15], false);
      }}
    >
      {open ? "Close airstair" : "Open airstair"}
    </button>
  );
}

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
      <H3>Documents and photographs</H3>
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
          <a href={brochure} target="_blank" rel="noreferrer">
            Falcon 6X Overview · floor plans, photographs and three-view drawing
          </a>
        </li>
        <li>
          <Source href={aircraftCertificate}>EASA airframe type certificate · A.580</Source>
        </li>
        <li>
          <Source href={engineCertificate}>EASA PW800 engine type certificate · IM.E.096</Source>
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
      <Small>
        These dimensions follow Dassault’s three-view. EASA’s type data sheet lists 25.546 m length, 25.942 m span and
        7.856 m height. <Source href={aircraftCertificate + "#page=9"}>EASA, p. 9</Source>
      </Small>
      <H3>Passenger entry</H3>
      <BtnRow>
        <AirstairButton />
      </BtnRow>
      <Small>
        The stairs form the inside of the lowered port door.{" "}
        <Source href="https://aviationweek.com/business-aviation/aircraft-propulsion/gallery-dassault-aviation-rolls-out-falcon-6x">
          Rollout photographs
        </Source>
      </Small>
      <figure className="falcon-reference-photo">
        <Source href={commonsPhoto}>
          <img
            src="/aircraft/falcon6x/f-wsix.png"
            width="720"
            height="324"
            loading="lazy"
            alt="Port side of F-WSIX at Bordeaux-Mérignac, with the 6X tail marking and registration on the left nacelle."
          />
        </Source>
        <figcaption>
          F-WSIX at Bordeaux-Mérignac, March 2021. <Source href={commonsPhoto}>Dylan Agbagni · CC0</Source>
        </figcaption>
      </figure>
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
        locate the fan, then follow the core airflow from the booster to the exhaust.
      </p>
      <Facts
        rows={[
          ["Engine type", "High-bypass turbofan"],
          ["Dassault published thrust", "13,500 lbf per engine"],
          ["EASA static takeoff rating", "13,850 lbf · 5 minutes"],
          ["Fan", "Single-piece bladed disk"],
          ["Combustor", "TALON X"],
        ]}
      />
      <H3>Inside the right engine</H3>
      <BtnRow>
        <button type="button" className="btn" onClick={() => inspect([-4.45, 2.25, 7.9], [-6.62, 0.56, 2.17], true)}>
          Inspect engine core
        </button>
      </BtnRow>
      <p>
        The outer stream bypasses the core. Core air passes through a two-stage booster and an eight-stage compressor
        before reaching the annular combustor. Two high-pressure turbine stages drive the compressor. Four low-pressure
        stages drive the fan and booster.
      </p>
      <Small>
        Stage counts follow the PW812D certificate. Blade profiles and spacing are illustrative.{" "}
        <Source href={engineCertificate + "#page=7"}>EASA, pp. 7–8</Source> ·{" "}
        <Source href="https://www.rtx.com/prattwhitney/products/business-aviation-engines/pw800">
          Pratt &amp; Whitney PW800 imagery
        </Source>
      </Small>
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
      <Small>
        <Source href={brochure + "#page=60"}>Dassault annotated wing, pp. 60–61</Source> ·{" "}
        <Source href="https://www.dassaultfalcon.com/news/digital-flight-control-system-dfcs/">
          Digital flight controls
        </Source>
      </Small>
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
      <Small>Cabin length excludes the flight deck and baggage compartment.</Small>
      <H3>Tour the 14-seat layout</H3>
      <BtnRow>
        <button className="btn" type="button" onClick={() => inspect([5.65, 0.48, 0.06], [-2.55, 0.1, 0], false)}>
          Look down the aisle
        </button>
        <AirstairButton />
      </BtnRow>
      <p>
        Four club chairs face across the forward lounge. Farther aft, a four-place conference table faces the credenza.
        Two three-place divans face each other across the rear aisle.
      </p>
      <Small>
        Furnishings follow the photographed LX-TIN cabin.{" "}
        <Source href="https://globaljet.aero/sites/default/files/2025-07/Dassault%20Falcon%206X_LX-TIN_0.pdf">
          Global Jet photographs and floor plan, pp. 1–2
        </Source>
      </Small>
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
      <H3>From the nose to the HUD</H3>
      <BtnRow>
        <button className="btn" type="button" onClick={() => inspect([12.8, 0.89, -1.17], [11.46, 0.16, 0], false)}>
          Look at the nose camera
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => {
            const [eye, target] = SYS.find((system) => system.id === "avionics")!.cam;
            inspect(eye, target, false);
          }}
        >
          Return to flight deck
        </button>
      </BtnRow>
      <p>
        The window ahead of the windshield covers four lenses serving six sensors. FalconEye combines daylight,
        low-light and thermal imagery with database terrain on the pilot’s head-up display.
      </p>
      <Small>
        The display pages are illustrative.{" "}
        <Source href="https://www.dassaultfalcon.com/go-deeper/falconeye/">Dassault’s FalconEye illustrations</Source> ·{" "}
        <Source href="https://50skyshades.com/news/business-aviation/dassault-aviation-at-ebace2022-falcon-6x-first-public-appearance-and-interview-with-vadim-feldzer">
          6X flight deck photographed at EBACE
        </Source>
      </Small>
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
