"use client";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Rocker, Seg, Slider, Small, useTicker } from "@/components/ui/controls";
import { FEEDER, NAV3_BUSES, nav3Init } from "../../cessna/electrical";
import { BreakerBoard, Nav3Diagram, Nav3Meters, Nav3Switches } from "../../cessna/panels";
import { BREAKERS, elecCfg, live, type Sim } from "../model";
import { CAT } from "../parts";
import { useC182 } from "../store";

const reset = (d: Sim) => { const k = { socMain: d.elec.socMain, socStby: d.elec.socStby }; d.elec = { ...nav3Init(), ...k }; };

export function Electrical() {
  useTicker(250);
  const s = useC182((x) => x.s), E = useC182((x) => x.E), up = useC182((x) => x.update);
  const e = s.elec, cfg = elecCfg(s);
  const upE = (fn: (d: Sim["elec"]) => void) => up((d) => fn(d.elec));
  const scen = (label: string, fn: (d: Sim) => void) => (
    <button key={label} type="button" className="btn" onClick={() => { live.timers.stby = 0; up((d) => { reset(d); fn(d); }); }}>{label}</button>
  );
  const run = (d: Sim) => { d.eng.running = true; d.eng.mags = "BOTH"; if (d.eng.mix < 0.1) d.eng.mix = 0.85; if (d.eng.throttle < 0.3 && !d.ground) d.eng.throttle = 0.82; };
  const mins = (Ah: number, soc: number, amps: number) => (amps < -0.2 ? `${Math.round((Ah * soc) / -amps * 60)} min` : "—");
  return (
    <>
      <p className="lead">A 28-volt DC system: a belt-driven 60-ampere alternator (95 A optional) with an Alternator Control Unit, a 24-volt main battery in the tailcone and a standby battery behind the panel. Everything meets in the power distribution module (J-box) on the left forward firewall, which feeds ELECTRICAL BUS 1 and BUS 2; both feed the CROSSFEED and ESSENTIAL buses through diodes, and each feeds an avionics bus through the AVIONICS switch. The standby battery takes over the essential bus by itself when main bus voltage falls below 20 V (POH 7-46 – 7-57, Figure 7-7).</p>
      <H3>Switches</H3>
      <Ctl>
        <Nav3Switches e={e} E={E} up={upE} testHeld={live.testHeld} testSeconds={20} />
        <Check id="ext" label="External power connected (28 V regulated)" checked={e.ext} onChange={(v) => upE((d) => { d.ext = v; })} />
        <div className="row"><div className="lbl"><span>Switch panel</span><span>12 V outlet {E.outlet12 ? "live" : s.lights.cabinPwr ? "— no power" : "off"}</span></div>
          <div className="switches"><Rocker label="CABIN PWR 12V" on={s.lights.cabinPwr} onToggle={() => up((d) => { d.lights.cabinPwr = !d.lights.cabinPwr; })} /></div>
        </div>
        <Seg id="altA" label="Alternator fitted" options={[[60, "60 A (standard)"], [95, "95 A (optional)"]] as [60 | 95, string][]} value={s.altAmps} onChange={(v) => up((d) => { d.altAmps = v; })} />
        <Nav3Meters E={E} />
        <Readouts items={[
          ["Alternator", E.altOn ? `${E.altAmps.toFixed(1)} A` : ["OFF", "bad"]], ["Bus load", `${E.load.toFixed(1)} A`],
          ["Main battery", e.fail.bat ? ["FAILED", "bad"] : `${Math.round(e.socMain * 100)}% · ${mins(cfg.mainAh, e.socMain, E.mBatt)}`],
          ["Standby battery", e.stby !== "ARM" || e.cb["ESS:STDBY BATT"] ? [e.stby !== "ARM" ? "OFF" : "C/B OUT (STDBY BATT)", "warnc"] : E.stbyOnline ? [`Supplying · ${mins(cfg.stbyAh, e.socStby, E.sBatt)}`, "warnc"] : `${Math.round(e.socStby * 100)}% · ${E.sBatt > 0 ? "charging" : "standing by"}`],
        ]} />
      </Ctl>
      <Small>Hold TEST for 20 seconds with the MASTER off — the green lamp must not go off — then ARM: the PFD comes up on the standby battery (BUS E ≥ 24 V, M BUS ≤ 1.5 V, BATT S negative, STBY BATT shown) (POH 4-13). Which alternator N8050J and N21200 have isn&apos;t in the POH. Currents are illustrative.</Small>
      <H3>Failures &amp; scenarios</H3>
      <Ctl>
        <BtnRow>
          <Check id="fAlt" label="Alternator fails (belt)" checked={e.fail.alt} onChange={(v) => upE((d) => { d.fail.alt = v; })} />
          <Check id="fOv" label="Regulator runaway (over-voltage)" checked={e.fail.ov} onChange={(v) => upE((d) => { d.fail.ov = v; })} />
          <Check id="fOvS" label="ACU over-voltage sensor dead" checked={e.fail.ovSense} onChange={(v) => upE((d) => { d.fail.ovSense = v; })} />
          <Check id="fBat" label="Main battery failed" checked={e.fail.bat} onChange={(v) => upE((d) => { d.fail.bat = v; })} />
          <Check id="fSb" label="Standby battery weak / cold" checked={e.fail.stby} onChange={(v) => upE((d) => { d.fail.stby = v; })} />
        </BtnRow>
        <div className="row"><div className="lbl"><span>Scenarios</span></div>
          <BtnRow>
            {scen("Normal", (d) => { run(d); })}
            {scen("Alternator failure", (d) => { run(d); d.elec.fail.alt = true; })}
            {scen("ACU over-voltage trip", (d) => { run(d); d.elec.fail.ov = true; })}
            {scen("HIGH VOLTS (ACU failed)", (d) => { run(d); d.elec.fail.ov = true; d.elec.fail.ovSense = true; })}
            {scen("Feeder A trips (BUS 2)", (d) => { run(d); d.elec.cb[FEEDER.E2] = true; })}
            {scen("Standby battery only", (d) => { run(d); d.elec.bat = false; d.elec.alt = false; })}
            {scen("Pre-start STBY BATT check", (d) => { d.eng.running = false; d.eng.mags = "OFF"; d.elec.bat = d.elec.alt = d.elec.avn1 = d.elec.avn2 = false; d.elec.stby = "ARM"; })}
          </BtnRow>
        </div>
        <Seg id="warp" label="Battery clock" options={[[1, "×1"], [10, "×10"], [60, "×60"]]} value={s.warp} onChange={(v) => up((d) => { d.warp = v; })} />
        <Slider id="socM" label="Main battery charge" min={0} max={1} step={0.01} value={e.socMain} onChange={(v) => upE((d) => { d.socMain = v; })} fmt={(v) => Math.round(v * 100) + "%"} />
        <Slider id="socS" label="Standby battery charge" min={0} max={1} step={0.01} value={e.socStby} onChange={(v) => upE((d) => { d.socStby = v; })} fmt={(v) => Math.round(v * 100) + "%"} />
      </Ctl>
      <Small>With the alternator failed the main battery carries both main buses until M BUS falls below 20 V; then the standby battery carries the essential bus “for at least 30 minutes” (POH 3-15). Speed the battery clock up to watch it happen. Capacities: main 12.75 Ah (equipment list); standby 6.2 Ah is the 2007 edition&apos;s figure for the same part — the 2005 POH gives none.</Small>
      {(E.highVolts || E.mBatt > 40) && <Caution title="HIGH VOLTS annunciator comes on or M BAT AMPS more than 40">MASTER (ALT only) — OFF, then reduce load: AVIONICS BUS 1, PITOT HEAT, BEACON, LAND (as required), TAXI, NAV, STROBE, CABIN PWR 12V off; COM1 and NAV1 tuned and selected; AVIONICS BUS 2 off (KEEP ON if in clouds — it also runs the KAP 140, audio panel, transponder and MFD); land as soon as practical (POH 3-15, 3-16).</Caution>}
      {E.lowVolts && s.eng.running && <Caution title="LOW VOLTS">Below 1,000 RPM: throttle 1,000 RPM and check it goes off. At higher RPM: MASTER (ALT only) OFF → ALT FIELD breaker CHECK IN → MASTER (ALT and BAT) ON → LOW VOLTS off, M BUS ≥ 27.5 V, M BAT AMPS charging. If it stays on, MASTER (ALT only) OFF, reduce load, land as soon as practical (POH 3-17 – 3-19).</Caution>}
      <H3>Power distribution (Figure 7-7)</H3>
      <Nav3Diagram e={e} E={E} />
      <H3>Circuit breakers (Figure 7-7 Sheet 2)</H3>
      <Small>Tap an ESS or AVN breaker to pull it (white collar) or reset it. ELECTRICAL BUS 1, BUS 2 and CROSSFEED breakers can&apos;t be pulled (POH 7-55) — they can only trip (amber) and be reset. Only FLAP 10 A, PITOT HEAT 10 A, WARN 5 A and AUTO PILOT 5 A are rated in the documents; the others are left blank. Hover a breaker for its load and source.</Small>
      <BreakerBoard breakers={BREAKERS} buses={NAV3_BUSES} E={E} cb={e.cb} up={upE} />
      <BtnRow>
        <button type="button" className="btn" onClick={() => upE((d) => { d.cb["E1:LAND LT"] = true; })}>Trip LAND LT</button>
        <button type="button" className="btn" onClick={() => upE((d) => { d.cb["XF:ALT FIELD"] = true; })}>Trip ALT FIELD</button>
        <button type="button" className="btn" onClick={() => upE((d) => { d.cb["XF:WARN"] = !d.cb["XF:WARN"]; })}>{e.cb["XF:WARN"] ? "Reset" : "Trip"} WARN</button>
        <button type="button" className="btn" onClick={() => upE((d) => { d.cb[FEEDER.E1] = !d.cb[FEEDER.E1]; })}>{e.cb[FEEDER.E1] ? "Reset" : "Trip"} feeder B (BUS 1)</button>
        <button type="button" className="btn" onClick={() => upE((d) => { d.cb[FEEDER.E2] = !d.cb[FEEDER.E2]; })}>{e.cb[FEEDER.E2] ? "Reset" : "Trip"} feeder A (BUS 2)</button>
      </BtnRow>
      <Small>WARN feeds the stall warning, autopilot warning (PITCH TRIM and the disconnect horn), ELT warning, main bus voltmeter, hour meter, starter relay, standby battery controller and main bus sense — trip it and watch the starter, Hobbs, stall horn and M BUS reading go (Fig. 7-7).</Small>
      <H3>Monitoring (POH 7-53 – 7-55)</H3>
      <Facts rows={[["M BUS volts", "Measured at the WARN breaker (CROSSFEED BUS); ≈ 28 V normal, 27–29 V at 1,800 RPM"], ["E BUS volts", "Measured at NAV 1 ENG (ESSENTIAL BUS)"], ["VOLTS red", "At or below 24.5 V (POH 7-53); above 32.0 V per the 2007 edition (GFC 7-57)"], ["M BATT amps", "+ charging; < 5 A charge after 30 min of cruise"], ["S BATT amps", "+ charging, − discharging (normally < 4 A)"], ["LOW VOLTS", "Red, continuous tone (tone inhibited on the ground): main bus below 24.5 V (ACU signal) — expected on the ground before start (POH 7-54, 4-8; CRG 115)"], ["HIGH VOLTS", "Red: bus above 32.0 V (2007 edition threshold, GFC 7-60) — the ACU should have opened ALT FIELD at ≈ 31.75 V"], ["STBY BATT", "Amber: standby battery discharging"]]} />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("electrical")} />
      <Caution title="Caution">Both AVIONICS switches OFF before turning the MASTER on or off, starting the engine or connecting external power (POH 7-47, 4-12).</Caution>
      <Notes items={["There is no hot battery bus: with the MASTER off only the standby battery (ARM) can power anything, and only the essential bus.", "On the standby battery alone: PFD, ADC/AHRS, NAV 1/engine unit (EIS), COM 1 and the standby instrument lights — no MFD, transponder, audio panel, autopilot, cooling fans or exterior lights (POH 3-35, 7-69).", "To stretch the main battery, the POH suggests MASTER (ALT and BAT) OFF and flying on the ESS BUS from the standby battery, saving the main battery for the flaps and the landing light (POH 3-35).", "ALT FIELD may open during a normal start (transient over-voltage); reset it once. If it opens again, don't reset it (POH 7-55, 3-34).", "Electrical fire: STBY BATT OFF, MASTER OFF, vents closed, extinguisher, AVIONICS OFF, all other switches except MAGNETOS OFF (POH 3-10)."]} />
    </>
  );
}

export function Lighting() {
  useTicker(400);
  const s = useC182((x) => x.s), E = useC182((x) => x.E), up = useC182((x) => x.update);
  const L = s.lights, lit = E.lit;
  type Sw = "beacon" | "land" | "taxi" | "nav" | "strobe";
  const flip = (k: Sw) => up((d) => { d.lights[k] = !d.lights[k]; });
  const st = (sw: boolean, on: boolean): [string, "" | "bad"] | string => (on ? "ON" : sw ? ["NO PWR", "bad"] : "off");
  const dim = (k: "flood" | "swcb" | "pedestal" | "avionics" | "stbyInd", label: string) =>
    <Slider id={"dim" + k} label={label} min={0} max={1} step={0.05} value={L[k]} onChange={(v) => up((d) => { d.lights[k] = v; })} fmt={(v) => (v < 0.03 ? "OFF" : Math.round(v * 100) + "%")} />;
  return (
    <>
      <p className="lead">Navigation lights on the wing tips and the tip of the stinger, a strobe in each wing tip, a flashing beacon on top of the fin, and landing and taxi lights in the left wing leading edge, plus courtesy lights under each wing. Inside: one dimmable, rotatable front flood light and a rear dome light in the overhead console, a map light under the pilot&apos;s wheel and internally lit panels on four dimmers (POH 7-57 – 7-60).</p>
      <H3>LIGHTS switches (up = ON)</H3>
      <Ctl>
        <div className="switches">
          {(["beacon", "land", "taxi", "nav", "strobe"] as Sw[]).map((k) => <Rocker key={k} label={k.toUpperCase()} on={L[k]} onToggle={() => flip(k)} />)}
          <Rocker label="DOME" on={L.dome} onToggle={() => up((d) => { d.lights.dome = !d.lights.dome; })} />
        </div>
        <Readouts items={[["Beacon", st(L.beacon, lit.beacon)], ["Landing", st(L.land, lit.land)], ["Taxi", st(L.taxi, lit.taxi)], ["Nav + tail", st(L.nav, lit.nav)], ["Strobes", st(L.strobe, lit.strobe)], ["Dome + courtesy", st(L.dome, lit.dome)]]} />
      </Ctl>
      <Small>Exterior glows show in the Overview and Lighting views. Trip LAND LT on the Electrical page, or lose BUS 1 or BUS 2, to see a light go out. “DOME” is the overhead push button that also works the courtesy lights. Light colours and flash rates are not in the POH (standard red / green / white assumed).</Small>
      <H3>Dimmers</H3>
      <Ctl>
        {dim("flood", "FLOOD LIGHT (overhead console)")}
        {dim("swcb", "SW/CB PANELS")}
        {dim("pedestal", "PEDESTAL")}
        {dim("avionics", "AVIONICS (off = photocell)")}
        {dim("stbyInd", "STDBY IND")}
        <Readouts items={[["Panel lights", lit.panel ? "ON" : "off"], ["Standby instruments", lit.stbyInd ? "ON" : "off"], ["Map light", lit.map ? "ON (with NAV)" : "off"], ["PFD / MFD / KAP lighting", L.avionics < 0.03 ? "Photocell (auto)" : `Manual ${Math.round(L.avionics * 100)}%`]]} />
        <Small>AVIONICS fully counter-clockwise lets the displays set their own brightness by photocell — recommended by day; clockwise sets the PFD, MFD, audio panel and KAP 140 lighting yourself at night (POH 7-59). STDBY IND also lights the magnetic compass and works on the standby battery (ESSENTIAL BUS).</Small>
      </Ctl>
      <H3>Lights — tap to locate</H3>
      <PartsList parts={CAT.pinned("lighting")} />
      <H3>Breakers (Figure 7-7)</H3>
      <Facts rows={[["BEACON · LAND", "BCN LT, LAND LT — ELECTRICAL BUS 1"], ["TAXI · NAV · STROBE", "TAXI LT, NAV LTS, STROBE LTS — ELECTRICAL BUS 2"], ["Panel and pedestal", "PANEL LTS — ELECTRICAL BUS 2"], ["Overhead lights, 12 V outlet", "CABIN LTS/PWR — ELECTRICAL BUS 1 (the overhead console's breaker is an inference)"], ["Standby instrument lights", "STDBY IND LTS — ESSENTIAL BUS"], ["Map light", "On NAV LTS: turn NAV on first, then the knurled rheostat"]]} />
      <Notes items={["Don't use the strobes or beacon when flying through cloud or overcast — reflected light can cause vertigo (POH 7-57). In cold weather the beacon can stay off until the engine is started to save the battery (POH 4-50).", "Use only the taxi light in the pattern or en route to extend the landing light's life (POH 7-57).", "Light failure: usually a bulb. Check PANEL LTS (inside) or the light's breaker; with no sign of a short, lights OFF, reset once, lights ON; if it opens again, leave it for maintenance (POH 7-60).", "Wing fire: LAND, TAXI, NAV, STROBE and PITOT HEAT OFF (POH 3-11).", "KOEL: strobes for every kind of operation; nav lights for VFR night and all IFR (day and night); the landing light at night for hire (POH 2-12)."]} />
    </>
  );
}
