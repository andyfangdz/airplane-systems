"use client";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Rocker, Slider, Small, useTicker, type Reading } from "@/components/ui/controls";
import { BUSES, SPARE_CB, fuelAvail, initialSim, type BusId, type Sim } from "../model";
import { CAT } from "../parts";
import { useDA40 } from "../store";
import { PowerDiagram } from "./distribution";

function Bus({ id, name, src, loads }: { id: BusId; name: string; src: string; loads: [string, number?][] }) {
  const E = useDA40((x) => x.E), cb = useDA40((x) => x.s.cb), up = useDA40((x) => x.update);
  const v = E[id], on = v > 0;
  return (
    <div className={"bus" + (on ? " on" : "")}>
      <div className="top"><span className="lamp" /><span className="nm">{name}</span><span className="v">{on ? v.toFixed(1) + " V" : "0 V"}</span></div>
      <div className="src">{src}</div>
      <div className="loads">
        {loads.map(([n, a]) => (
          <button key={n} type="button" className={"chip" + (cb[n] ? " pulled" : "")} aria-pressed={!!cb[n]}
            title={SPARE_CB.includes(n) ? `${n}: KAP 140 / Stormscope position on the panel drawing — no load on a GFC 700 airplane (inference)` : `Pull / reset the ${n} breaker`}
            onClick={() => up((d) => { if (d.cb[n]) delete d.cb[n]; else d.cb[n] = true; })}>
            {n}{a ? ` ${a}` : ""}{SPARE_CB.includes(n) ? "*" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

const resetElec = (d: Sim) => { d.elec = structuredClone(initialSim.elec); d.cb = {}; };

export function Electrical() {
  useTicker(250);
  const s = useDA40((x) => x.s), E = useDA40((x) => x.E), up = useDA40((x) => x.update);
  const e = s.elec;
  // every scenario starts from normal operation (alternator online), then applies its switch / breaker changes
  const scen = (label: string, fn: (d: Sim) => void) => (
    <button key={label} type="button" className="btn" onClick={() => {
      up((d) => { resetElec(d); d.eng.running = true; d.eng.key = "BOTH"; if (d.eng.mix < 0.1) d.eng.mix = 0.8; if (!fuelAvail(d)) d.fuel.sel = d.fuel.qL > 0 ? "L" : "R"; });
      up(fn);
    }}>{label}</button>
  );
  const tie: Reading = !E.tieCb ? ["Open — ESS TIE / MAIN TIE pulled", "warnc"]
    : !E.mstr ? "Closed — no control power" : E.tieClosed ? "Closed (buses tied)" : E.essAlt ? "Open — alternator feeds ESS through the diode" : "Open — ESSENTIAL isolated";
  const batt: Reading = E.batDead ? ["DEPLETED", "bad"] : !E.batOk ? ["OFF / FAILED", "bad"]
    : s.cb["BATT"] ? ["Isolated (BATT out)", "warnc"] : E.batCharging ? "Charging"
    : E.batLoad > 0 ? [`Discharging · ${Math.round((1 - E.batFrac) * 100)}%`, "warnc"] : "Idle";
  return (
    <>
      <p className="lead">A 28 V system with one 70 A alternator and an 11 Ah battery, distributed to three buses: ESSENTIAL (fed straight from the battery), MAIN (fed by the alternator) and MAIN AVIONICS. A tie relay joins ESSENTIAL and MAIN; the ESS. BUS switch opens it so that, after an alternator failure, the battery carries only the essential equipment — a bypass diode still lets a working alternator charge the battery (if the essential tie relay bypass, OAM 40-126, is fitted — assumed here). A separate emergency battery keeps the standby attitude indicator and the flood light alive for 1 h 30 min.</p>
      <H3>Switches</H3>
      <Ctl>
        <div className="switches">
          <Rocker label="ALT" on={e.alt} onToggle={() => up((d) => { d.elec.alt = !d.elec.alt; })} />
          <Rocker label="BAT" on={e.bat} onToggle={() => up((d) => { d.elec.bat = !d.elec.bat; })} />
          <Rocker label="AVIONIC MASTER" on={e.avMaster} onToggle={() => up((d) => { d.elec.avMaster = !d.elec.avMaster; })} />
          <Rocker label="ESS. BUS" on={e.essBus} onToggle={() => up((d) => { d.elec.essBus = !d.elec.essBus; })} />
          <Rocker label="HORIZON EMERG" on={e.emerg} onToggle={() => up((d) => { d.elec.emerg = !d.elec.emerg; })} />
        </div>
        <div className="row">
          <div className="lbl"><span>Failures &amp; ground power</span></div>
          <BtnRow>
            <Check id="fAlt" label="Alternator fails" checked={e.fail.alt} onChange={(v) => up((d) => { d.elec.fail.alt = v; })} />
            <Check id="fBat" label="Battery dead" checked={e.fail.bat} onChange={(v) => up((d) => { d.elec.fail.bat = v; })} />
            <Check id="ext" label="External power connected" checked={e.ext} onChange={(v) => up((d) => { d.elec.ext = v; })} />
          </BtnRow>
        </div>
        <div className="row">
          <div className="lbl"><span>Scenarios (engine running)</span></div>
          <BtnRow>
            {scen("Normal", () => {})}
            {scen("Alternator fails", (d) => { d.elec.fail.alt = true; })}
            {scen("…then ESS BUS ON (AFMS 3.7.2b)", (d) => { d.elec.fail.alt = true; d.elec.essBus = true; d.elec.tBat = 10; })}
            {scen("…battery exhausted → HORIZON EMERGENCY", (d) => { d.elec.fail.alt = true; d.elec.essBus = true; d.elec.emerg = true; d.elec.tBat = 45; })}
            {scen("Smoke: master OFF, emergency ON", (d) => { d.elec.bat = false; d.elec.alt = false; d.elec.emerg = true; })}
            {scen("Smoke: ALT ON, then BATT + ESS TIE pulled", (d) => { d.cb["BATT"] = true; d.cb["ESS TIE"] = true; d.elec.emerg = true; })}
          </BtnRow>
        </div>
        <Slider id="tBat" label="Time on battery power" min={0} max={100} step={1} value={e.tBat} onChange={(v) => up((d) => { d.elec.tBat = v; })} fmt={(v) => v + " min"} />
        <Readouts items={[
          ["Engine", s.eng.running ? "RUNNING" : ["STOPPED", "bad"]],
          ["ESSENTIAL", [E.ess.toFixed(1) + " V", E.ess < 24 ? "bad" : E.ess < 25.1 ? "warnc" : ""]],
          ["MAIN", [E.main.toFixed(1) + " V", E.main ? "" : "bad"]],
          ["MAIN AVIONICS", [E.av.toFixed(1) + " V", E.av ? "" : "warnc"]],
          ["AMPS (alternator)", [String(E.amps), E.altFeed ? "" : "bad"]],
          ["Load", E.load.toFixed(1) + " A"],
          ["Battery", batt],
          ["Battery endurance", E.batLoad > 0 ? `≈ ${E.endurance} min at ${E.batLoad.toFixed(1)} A` : "—"],
          ["Tie relay", tie],
          ["Standby attitude", E.stbyAtt ? (e.emerg ? "EMERG BATTERY" : "HORIZON (ESS)") : ["OFF flag", "bad"]],
        ]} />
      </Ctl>
      <Small>Battery endurance uses the Garmin load analysis: 11 Ah × 0.7 available = 7.7 Ah, so ≈ 37 min at the 12.4 A essential-bus load, ≈ 18 min with everything on. The AFMS promises at least 30 min on ESS BUS and 1 h 30 min from the emergency battery (which the slider assumes was ON throughout). Currents are illustrative.</Small>
      {E.altFeed === false && s.eng.running && (
        <Caution title="ALTERNATOR (AFMS 3.7.2b)">1. Circuit breakers — check in. 2. ALT switch OFF, then ON. If it does not come back: 3. ESS BUS switch ON. 4. Switch off non-essential loads. 5. Land within 30 minutes. 6. If PFD attitude is lost: HORIZON EMERGENCY switch ON.</Caution>
      )}
      <H3>Power distribution (GFC 700 airplane, AMM-E 190-00545-01 Fig. 2-3)</H3>
      <PowerDiagram s={s} E={E} />
      <Notes items={[
        "Battery → battery relay (BAT switch) → BATT 70 A → ESSENTIAL. External power and the starter share the relay-box bus bar.",
        "Alternator → current sensor → ALT 70 A → MAIN. Field: MAIN → ALT CONT 5 A → ALT switch → regulator; over-voltage: ALT PROT 5 A.",
        "ESSENTIAL → ESS TIE 25 A → tie relay ‖ diode (MAIN → ESS only) → MAIN TIE 25 A → MAIN. ESS. BUS ON opens the relay.",
        "MAIN → AV BUSS 25 A → avionics-master relay → MAIN AVIONICS. Both relay coils get power through MSTR CNTRL 2 A on ESSENTIAL.",
        "Sources disagree: the AFMS (p. 30) says pulling BATT and ESS TIE “restores power to the main and avionics busses”, but the AMM-E schematic feeds the avionics relay coil from ESSENTIAL, which is then dead. The model follows the AFMS.",
        "Alternator field: MAIN feeds it, so a stopped or switched-off alternator can only come online while MAIN is live — not with ESS BUS ON on battery alone (AFMS p. 29). Once online it keeps itself excited.",
        "HORIZON 3 A (ESSENTIAL) or the emergency battery → standby attitude indicator + flood light, chosen by the sealed HORIZON EMERGENCY switch.",
      ]} />
      <H3>Circuit-breaker panel (right of the MFD)</H3>
      <Small>Tap a breaker to pull it (white collar) or reset it. Pulled breakers remove that load everywhere: try PFD (MFD goes reversionary), ENG INST (EIS red X), AFCS (autopilot gone), ALT (ALTERNATOR warning), CDU FAN (fan advisories) or MSTR CNTRL (no avionics bus, ESS BUS switch dead). * = KAP 140 / Stormscope positions on the panel drawing, no load here.</Small>
      <div className="buses">{BUSES.map(([id, name, src, loads]) => <Bus key={id} id={id} name={name} src={src} loads={loads} />)}</div>
      <H3>What each bus keeps</H3>
      <Facts rows={[
        ["ESSENTIAL", "PFD (composite), AHRS, ADC, GIA 1 (COM 1, GPS/NAV 1), XPDR, audio panel, engine instruments, pitot heat, flaps, landing light, flood light, starter, standby attitude"],
        ["MAIN", "MFD, electric fuel pump, strobe, position, taxi/map and instrument lights, cooling fans, alternator field"],
        ["MAIN AVIONICS", "GIA 2 (COM 2, GPS/NAV 2), GFC 700 servos, GDL 69A, ADF / DME if installed"],
      ]} />
      <H3>Indications &amp; annunciations</H3>
      <Facts rows={[
        ["AMPS", "Alternator output only · green 2–75 A, scale 0–80"],
        ["VOLTS", "red < 24.1 · yellow 24.1–25 · green 25.1–30 · yellow 30.1–32 · red > 32"],
        ["ALTERNATOR (red)", "Alternator failed — battery is the only source"],
        ["LOW VOLTS (yellow)", "On-board voltage below 24 V"],
        ["STARTER ENGD (red)", "Starter engaged"],
        ["PFD / MFD / GIA FAN FAIL (white)", "Cooling fan inoperative (CDU FAN / AV FAN)"],
      ]} />
      <H3>Other procedures</H3>
      <Notes items={[
        "LOW VOLTS on the ground: 1,200 RPM, electrical equipment off, check meters; if the ammeter flashes zero, discontinue the flight (AFMS p. 54).",
        "Over-voltage (> 32 V): ESS BUS ON, ALT OFF — leave BAT ON — shed loads, land (AFM 3-38).",
        "Electrical smoke: emergency switch ON, master OFF, cabin heat OFF, windows open; then BAT ON + ESS BUS ON; if smoke persists ALT ON, ESS BUS OFF and pull BATT and ESS TIE (AFMS p. 29–30).",
        "Total failure: check and reset all breakers, emergency switch ON, use the flood light, land at the nearest suitable field (AFM 3-35).",
        "Before start: avionics master OFF and ESS BUS OFF. 'Ess. Bus NOT for normal operation' — and the battery is not charged with it ON unless the bypass (OAM 40-126) is fitted (AFMS p. 38).",
        "No external-power start with a flat battery if the flight will be IFR; IFR is not allowed with the emergency switch seal broken (AFM 2-32).",
      ]} />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("electrical")} />
    </>
  );
}
