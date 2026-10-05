"use client";
import { selectSys } from "@/lib/fleet";
import { sysColor } from "@/lib/systems";
import { useView } from "@/lib/view";
import { BtnRow, Ctl, Facts, H3, Notes, PartsList, Readouts, Rocker, Slider, Small } from "@/components/ui/controls";
import { extLit } from "../model";
import { CAT } from "../parts";
import { scenarioCruise, scenarioRamp, useDA40 } from "../store";
import { SYS } from "../systems";

export function Overview() {
  const theme = useView((x) => x.theme);
  const air = useDA40((x) => x.s.air), running = useDA40((x) => x.s.eng.running);
  return (
    <>
      <p className="lead">A study model of AFM Section 7 for Paramus Flying Club&apos;s 2008 Diamond DA40 XLS, N949KC (Canadian-built s/n 40.949): G1000 with the GFC 700 autopilot, Lycoming IO-360-M1A and an MT three-blade constant-speed propeller. Pick a system to fly the camera to it, hover parts for their notes, and work the switches, levers, breakers and failures in the panel. Everything is linked — pull a breaker and the bus, the load, the displays, the annunciations and the 3D model respond.</p>
      <H3>Scenario</H3>
      <Ctl>
        <BtnRow>
          <button type="button" className="btn" onClick={scenarioCruise}>Normal cruise · 4,500 ft</button>
          <button type="button" className="btn" onClick={() => { scenarioRamp(); selectSys("engine"); }}>Cold &amp; dark on the ramp → start</button>
        </BtnRow>
        <Readouts items={[["Where", air ? "Airborne" : "On the ramp"], ["Engine", running ? "RUNNING" : ["STOPPED", "bad"]]]} />
      </Ctl>
      <H3>At a glance</H3>
      <Facts rows={[
        ["Engine", "Lycoming IO-360-M1A · 180 hp @ 2,700 RPM"],
        ["Propeller", "MT MTV-12-B/183-59b, 3 blades, Ø 1.83 m, constant speed"],
        ["Fuel", "Long-range tanks: 2 × 25.5 US gal, 50 usable · AVGAS 100LL"],
        ["Electrical", "28 V · 70 A alternator · 11 Ah battery · emergency battery"],
        ["Buses", "ESSENTIAL · MAIN · MAIN AVIONICS"],
        ["Flaps", "Electric: UP 0° · T/O 20° · LDG 42°"],
        ["Avionics", "Garmin G1000 (GDU 1040 PFD, GDU 1044 MFD, GIA 63W ×2)"],
        ["Autopilot", "Garmin GFC 700, two-axis with pitch trim"],
        ["Dimensions", "Span 11.94 m · length 8.01 m · height 1.97 m"],
        ["Speeds", "VNE 178 · VNO 129 · VFE 108 / 91 · VA 111 KIAS (1,200 kg)"],
      ]} />
      <H3>Systems</H3>
      <div className="overview-grid">
        {SYS.slice(1).map((s) => (
          <button key={s.id} type="button" style={{ "--c": sysColor(s.id, theme) } as React.CSSProperties} onClick={() => selectSys(s.id)}>
            <b>{s.name}</b><span>{s.blurb}</span>
          </button>
        ))}
      </div>
      <p className="disc">Unofficial study aid. Built from the Diamond DA 40 Airplane Flight Manual Doc. No. 6.01.01-E Rev. 8 (Section 7, with Sections 2–6 where needed; the available copy is for s/n 40.698), the Garmin AFM Supplements 190-00492-10 Rev 2 (G1000 with GFC 700, DA 40) and 190-00303-02 Rev 9 (G1000), the GFC 700 AFMS 190-00492-00 Rev 2, the G1000 Cockpit Reference Guide for the DA40 190-00324-07 Rev A, the G1000/DA40 System Maintenance Manuals 190-00303-03 Rev 6 and 190-00545-01 Rev E, the Garmin GFC 700 electrical load analysis, the EASA TCDS for control-surface and flap angles, and AOPA&apos;s 2008 XLS review for the XLS package. Where the AFM is silent (control routing, servo and antenna locations, cabin-heat ducting) the model says so and is approximate. Geometry is approximate. Always use the AFM, supplements and equipment list carried in N949KC.</p>
    </>
  );
}

export function Airframe() {
  return (
    <>
      <p className="lead">A GFRP semi-monocoque fuselage — a teardrop cabin pod tapering into a slim tail boom — with a stub wing built into the fuselage. The outer wings bolt to the stub wing at the root rib, and a T-tail sits on top of the fin. No wing struts.</p>
      <Facts rows={[
        ["Fuselage", "GFRP semi-monocoque, GFRP/CFRP main bulkheads (AFM 7-3)"],
        ["Firewall", "Fire-resistant mat + stainless-steel cladding"],
        ["Wings", "Front and rear spar, separate top and bottom shells (fail-safe); GFRP/CFRP sandwich"],
        ["Airfoil", "Wortmann FX 63-137/20 - W4 · dihedral 5° · LE sweep 1°"],
        ["Wing area", "13.54 m² (145.7 ft²) · MAC 1.121 m · AR 10.53"],
        ["Empennage", "GFRP T-tail, twin-spar stabilizers; rudder and elevator sandwich"],
        ["Span / length / height", "11.94 m / 8.01 m / 1.97 m (AFM 1-6)"],
        ["Track / wheelbase", "2.97 m / 1.68 m (AFM 1-7)"],
        ["Datum", "2.194 m forward of the root-rib leading edge (AFM 6-3)"],
        ["Levelling", "Wedge 600:31 on the tail boom in front of the fin"],
        ["MTOM", "1,200 kg / 2,646 lb with MÄM 40-227 (XLS); 1,150 kg otherwise"],
        ["CG limits", "Fwd 2.40 m to 2.48 m at 1,200 kg · aft 2.55 m (long-range tanks)"],
        ["Load factors", "+3.8 / −1.52 g (Normal) · flaps +2.0 g"],
        ["Paint", "White overall — keeps the composite cool (AFM 8-9)"],
      ]} />
      <H3>Structure — tap to locate</H3>
      <PartsList parts={CAT.pinned("airframe")} />
      <H3>Notes</H3>
      <Notes items={[
        "Both wings and the horizontal stabilizer can be removed for road transport (AFM 8-8).",
        "Seven static dischargers are fitted and all seven are required for IFR (AFMS p. 20).",
        "Jack points are on the lower fuselage at the left and right root ribs and at the tail fin (AFM 8-7).",
        "Pushing the tail down at the fuselage/fin junction lifts the nose wheel to turn the airplane on its main gear (AFM 8-3, 8-7).",
        "The model's dimensions and stations follow AFM §1.7 and the G1000 SMM station marks (FS 1775 panel, FS 2410 jack point, FS 3832 avionics enclosure); shapes are traced from the three-view and photos.",
      ]} />
    </>
  );
}

export function Lighting() {
  const s = useDA40((x) => x.s), E = useDA40((x) => x.E), up = useDA40((x) => x.update);
  const L = s.lights, x = extLit(s, E);
  const st = (sw: boolean, lit: boolean): [string, "" | "bad"] | string => (lit ? "ON" : sw ? ["NO PWR", "bad"] : "off");
  const flip = (k: "landing" | "taxi" | "position" | "strobe") => up((d) => { d.lights[k] = !d.lights[k]; });
  return (
    <>
      <p className="lead">Combined position and strobe (anti-collision) lights are in both wing tips. The landing and taxi lights are built into the left wing. Inside, an electroluminescent flood-light panel under the glareshield lights the whole panel, and it is one of the two loads the emergency battery keeps alive. There is no beacon: the strobes are the anti-collision lights.</p>
      <H3>LIGHTS switches (upper-left panel)</H3>
      <Ctl>
        <div className="switches">
          <Rocker label="LANDING" on={L.landing} onToggle={() => flip("landing")} />
          <Rocker label="TAXI" on={L.taxi} onToggle={() => flip("taxi")} />
          <Rocker label="POSITION" on={L.position} onToggle={() => flip("position")} />
          <Rocker label="STROBE" on={L.strobe} onToggle={() => flip("strobe")} />
        </div>
        <Slider id="instr" label="INSTRUMENT knob" min={0} max={1} step={0.05} value={L.instr} onChange={(v) => up((d) => { d.lights.instr = v; })} fmt={(v) => (v < 0.02 ? "OFF" : Math.round(v * 100) + "%")} />
        <Slider id="flood" label="FLOOD knob" min={0} max={1} step={0.05} value={L.flood} onChange={(v) => up((d) => { d.lights.flood = v; })} fmt={(v) => (v < 0.02 ? "OFF" : Math.round(v * 100) + "%")} />
        <Readouts items={[
          ["Landing", st(L.landing, x.land)], ["Taxi", st(L.taxi, x.taxi)], ["Position", st(L.position, x.pos)], ["Strobes", st(L.strobe, x.strobe)],
          ["Instrument lts", L.instr > 0 ? (E.instPwr ? "ON" : ["NO PWR", "bad"]) : "off"],
          ["Flood light", E.floodPwr && (L.flood > 0 || s.elec.emerg) ? (s.elec.emerg ? "ON · EMERG BATT" : "ON") : L.flood > 0 ? ["NO PWR", "bad"] : "off"],
        ]} />
      </Ctl>
      <Small>Exterior glows show in the Overview and Lighting views. Try the Electrical panel&apos;s ESS BUS switch: the landing light and flood light stay (ESSENTIAL), the taxi, position and strobe lights go dark (MAIN).</Small>
      <H3>Lights — tap to locate</H3>
      <PartsList parts={CAT.pinned("lighting")} />
      <H3>Power</H3>
      <Facts rows={[
        ["LANDING 5 A", "ESSENTIAL — Whelen 70346 or HID lamp, left wing"],
        ["TAXI/MAP 5 A", "MAIN — taxi light and crew map light"],
        ["POSITION 5 A", "MAIN — Whelen A600 red (L) / green (R)"],
        ["STROBE 5 A", "MAIN — Whelen A490ATS power supplies in the wings"],
        ["FLOOD 5 A", "ESSENTIAL — or the emergency battery"],
        ["INST 3 A", "MAIN — instrument lighting dimmer"],
      ]} />
      <H3>Notes</H3>
      <Notes items={[
        "Strobes off when taxiing close to other aircraft or at night in cloud, fog or haze; position lights always on at night (AFMS p. 45).",
        "With the alternator failed and ESS BUS ON, only the landing light and flood light remain (AFMS p. 30).",
        "With HORIZON EMERGENCY ON the emergency battery runs the standby attitude indicator and the flood light for 1 h 30 min (AFM 7-42).",
        "A separate white tail light is not listed in the documents; the aft-facing white light is assumed to be in the wing-tip units. Strobe flash rate is not given — the model shows a double flash.",
      ]} />
    </>
  );
}
