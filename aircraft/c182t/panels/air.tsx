"use client";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Seg, Slider, Small, useTicker } from "@/components/ui/controls";
import { kap140Key } from "@/lib/avionics/kap140";
import { indicated } from "../displays";
import { live, stallKias, type FlapCmd } from "../model";
import { CAT } from "../parts";
import { useC182 } from "../store";
import { scenarioCruise } from "../tick";

const knob = (v: number) => (v < 0.03 ? "Pushed in (OFF)" : v > 0.97 ? "Pulled full out" : `Pulled ${Math.round(v * 100)}%`);

export function Environment() {
  useTicker(300);
  const s = useC182((x) => x.s), up = useC182((x) => x.update), env = s.env;
  const run = s.eng.running;
  return (
    <>
      <p className="lead">Heat comes from shrouds around the two exhaust mufflers: ram air warms there and the heater valve on the firewall (CABIN HT) lets it into the cabin manifold, where a ventilating air door (CABIN AIR) blends in fresh ram air from a second inlet. The manifold feeds outlet holes forward of the front seats, two defroster outlets on top of the glareshield (DEFROST knob) and ducts to the rear cabin floor. Separate wing-root ram air feeds the forward ventilators and outlets and the rear cabin ventilators — it never passes the heater. There is no cabin fan (POH 7-60 – 7-62, Figure 7-8).</p>
      <H3>Controls (lower right panel)</H3>
      <Ctl>
        <Slider id="heat" label="CABIN HT knob" min={0} max={1} step={0.01} value={env.heat} onChange={(v) => up((d) => { d.env.heat = v; })} fmt={knob} />
        <Slider id="air" label="CABIN AIR knob" min={0} max={1} step={0.01} value={env.air} onChange={(v) => up((d) => { d.env.air = v; })} fmt={knob} />
        <Slider id="defr" label="DEFROST knob (clockwise = ON)" min={0} max={1} step={0.05} value={env.defrost} onChange={(v) => up((d) => { d.env.defrost = v; })} fmt={(v) => (v < 0.05 ? "OFF" : Math.round(v * 100) + "% clockwise")} />
        <Check id="vents" label="Cabin ventilators (wing-root air) open" checked={env.vents} onChange={(v) => up((d) => { d.env.vents = v; })} />
        <Readouts items={[
          ["Heated air", run ? (env.heat > 0.02 ? `${Math.round(env.heat * 100)}%` : "None") : ["Engine off", "warnc"]],
          ["Blend", env.heat + env.air < 0.05 ? "No airflow" : env.heat > env.air ? "Warm" : "Cool"],
          ["Max heat", env.heat > 0.97 && env.air < 0.03 ? "Yes" : "No"],
          ["CO", live.coPpm >= 50 ? [env.coAck ? "CO LVL HIGH · steady" : "CO LVL HIGH · flashing", "bad"] : `${Math.round(live.coPpm)} PPM`],
        ]} />
      </Ctl>
      <H3>Scenario: cracked muffler</H3>
      <Ctl>
        <Check id="co" label="Exhaust leak inside a heater shroud" checked={env.coLeak} onChange={(v) => up((d) => { d.env.coLeak = v; })} />
        <BtnRow>
          <button type="button" className="btn" disabled={live.coPpm < 50 || env.coAck} onClick={() => up((d) => { d.env.coAck = true; })}>WARNING softkey (acknowledge)</button>
          <button type="button" className="btn" onClick={() => up((d) => { d.env.heat = 0; d.env.air = 1; d.env.vents = true; })}>CO LVL HIGH checklist</button>
        </BtnRow>
      </Ctl>
      <Small>Maximum heat is CABIN HT pulled full out with CABIN AIR pushed in. A small amount of heat: CABIN HT ¼ to ½ inch out. With a leak, CO reaches the cabin only with CABIN HT open; fresh air and vents dilute it. CO LVL HIGH flashes with a continuous tone until acknowledged, then stays until CO falls below 50 PPM (POH 7-75). The model is illustrative.</Small>
      <Caution title="CO LVL HIGH (POH 3-21)">CABIN HT knob OFF (push full in) · CABIN AIR knob ON (pull full out) · cabin vents OPEN · cabin windows OPEN (175 KIAS maximum). If it remains on, land as soon as practical.</Caution>
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("environment")} />
      <H3>Outlets (Figure 7-8)</H3>
      <Facts rows={[["Front floor", "Outlet holes across the manifold just forward of the front seats"], ["Rear floor", "One duct down each side to an outlet just aft of the rudder pedals"], ["Defrost", "Two outlets on top of the glareshield; air as warm as the cabin heat"], ["Forward ventilators", "Gooseneck outlet near each upper corner of the windshield, and a lower outlet, from the wing roots"], ["Rear ventilators", "Two, fed by ducts from the wing roots"], ["Heater", "Shrouded muffler type, arm −29.5 (POH 6-20)"]]} />
      <Notes items={["Electrical or cabin fire: vents, cabin air and heat CLOSED to avoid drafts; open once the fire is out (POH 3-10, 3-11). Engine fire: cabin heat and air OFF except the overhead vents (POH 3-10).", "Inadvertent icing: pull cabin heat full out and turn DEFROST clockwise for maximum defroster airflow (POH 3-12).", "Static source blocked: ALT STATIC AIR, CABIN HT and CABIN AIR pulled ON and vents CLOSED — the checklist (POH 3-13); the Section 5 alternate-static tables assume windows and vents closed and heater, cabin air and defroster at maximum (Figs 5-1 Sheet 2, 5-2).", "PFD1 / MFD1 COOLING: reduce cabin heat and feel for the forward avionics fan's air at the glareshield screen (POH 3-20)."]} />
    </>
  );
}

export function Pitot() {
  useTicker(150);
  const s = useC182((x) => x.s), E = useC182((x) => x.E), up = useC182((x) => x.update), p = s.pitot;
  const ind = indicated(s, live.fs), vs = stallKias(live.flapAng);
  const startDemo = () => {
    if (s.ground || !s.eng.running) scenarioCruise();
    if (live.kap.ap) live.kap = kap140Key(live.kap, "DISC", live.fs);
    live.stallDemo = true;
    up((d) => { d.eng.throttle = 0; });
  };
  return (
    <>
      <p className="lead">A heated pitot head under the left wing and external static ports on both sides of the forward fuselage feed the GDC 74A air data computer and the standby airspeed indicator and altimeter. An ALT STATIC AIR valve next to the throttle substitutes cabin pressure. Stall warning is electric: a vane in the left wing leading edge closes a switch to a horn in the headliner above the left door, powered through the WARN breaker; PITOT HEAT also heats the vane (POH 7-62 – 7-65).</p>
      <H3>Pitot-static</H3>
      <Ctl>
        <Check id="pheat" label="PITOT HEAT switch ON" checked={p.heat} onChange={(v) => up((d) => { d.pitot.heat = v; })} />
        <Check id="alts" label="ALT STATIC AIR pulled ON" checked={p.altStatic} onChange={(v) => up((d) => { d.pitot.altStatic = v; })} />
        <BtnRow>
          <Check id="hfail" label="Heater element open" checked={p.heaterFail} onChange={(v) => up((d) => { d.pitot.heaterFail = v; })} />
          <Check id="pblk" label="Pitot blocked (ice)" checked={p.pitotBlocked} onChange={(v) => up((d) => { d.pitot.pitotBlocked = v; })} />
          <Check id="sblk" label="Static ports blocked" checked={p.staticBlocked} onChange={(v) => up((d) => { d.pitot.staticBlocked = v; })} />
        </BtnRow>
        <Slider id="oat" label="Outside air temperature" min={-20} max={35} step={1} value={p.oat} onChange={(v) => up((d) => { d.pitot.oat = v; })} fmt={(v) => `${v} °C / ${Math.round((v * 9) / 5 + 32)} °F`} />
        <Readouts items={[
          ["Pitot heat", E.pitotHeating ? "HEATING (pitot + vane)" : p.heat ? ["NO CURRENT", "bad"] : "Off"], ["Indicated", `${Math.round(ind.ias)} KIAS`], ["Altimeter", `${Math.round(ind.alt)} ft`],
          ["Static source", p.altStatic ? ["CABIN", "warnc"] : p.staticBlocked ? ["BLOCKED", "bad"] : "Ports"],
        ]} />
      </Ctl>
      <Small>There is no pitot-heat annunciation: check that the head is warm within 30 seconds on preflight (POH 4-8). With ALT STATIC ON the variation is at most 5 kt and 80 ft with the windows closed (POH 3-30); the alternate-static airspeed and altimeter corrections of Figures 5-1 Sheet 2 and 5-2 are applied to both the PFD and the standby instruments here.</Small>
      <Caution title="Static source blockage (POH 3-13)">ALT STATIC AIR valve PULL ON · CABIN HT and CABIN AIR knobs PULL ON · vents CLOSED · use the Section 5 alternate-static airspeed and altimeter corrections.</Caution>
      <H3>Stall warning demo</H3>
      <Ctl>
        <Seg id="flapStall" label="Flaps" options={[[0, "UP"], [10, "10°"], [20, "20°"], [38, "FULL"]] as [FlapCmd, string][]} value={s.flaps.cmd} onChange={(v) => up((d) => { d.flaps.cmd = v; })} />
        <Check id="vane" label="Stall vane stuck (iced / jammed)" checked={s.stall.vaneStuck} onChange={(v) => up((d) => { d.stall.vaneStuck = v; })} />
        <BtnRow>
          <button type="button" className="btn primary" onClick={startDemo}>Power idle, hold altitude</button>
          <button type="button" className="btn" onClick={() => { live.stallDemo = false; up((d) => { d.eng.throttle = 0.82; }); }}>Recover</button>
        </BtnRow>
        <Readouts items={[["IAS", `${Math.round(live.fs.ias)} KIAS`], ["Stall speed", `${vs} KIAS`], ["Horn", live.horn ? ["SOUNDING", "bad"] : s.stall.vaneStuck ? ["SILENT (vane)", "warnc"] : !E.warnPwr ? ["NO POWER (WARN)", "bad"] : "Quiet"], ["Demo", live.stallDemo ? "Slowing" : "—"]]} />
      </Ctl>
      <Small>The horn sounds 5 to 10 knots above the stall in all configurations (POH 7-65); here at Vs + 7 kt. Stall speeds: 50 / 43 / 40 KIAS at UP / 20° / FULL, power off, wings level, 3,100 lb, most rearward CG (Figure 5-4); 10° interpolated. The horn needs the WARN breaker — trip it on the Electrical page and the horn stays silent.</Small>
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("pitot")} />
      <Notes items={["Preflight: pitot cover removed and the tube clear; static openings on both sides clear; stall vane free; with the MASTER on, push the vane up and hear the horn (POH 4-8 – 4-11, 7-65).", "Red X on PFD airspeed or altitude: ADC/AHRS breakers CHECK IN (ESS and AVN BUS 1), reset once; use the standby airspeed and altimeter (POH 3-19).", "PITOT HEAT is a 10 A breaker on ELECTRICAL BUS 2 (non-pullable) and is in both load-shed lists (POH 7-62, 3-16).", "OAT probe on the cabin top feeds the air data computer and the PFD OAT box (POH 7-67)."]} />
    </>
  );
}

export function Vacuum() {
  useTicker(200);
  const s = useC182((x) => x.s), up = useC182((x) => x.update);
  const flag = live.vac < 3.5 || live.gyro < 0.7;
  return (
    <>
      <p className="lead">The standby attitude indicator in the centre of the panel is a vacuum gyro. One engine-driven dry vacuum pump pulls cabin air through a filter, the instrument&apos;s rotor and a regulator; a transducer sends the vacuum to the GEA 71 for the VAC gauge on the EIS SYSTEM page, and LOW VACUUM comes on below 3.5 in.Hg. The PFD attitude comes from the AHRS, so a vacuum failure doesn&apos;t affect it or the KAP 140 (POH 7-63, 3-26).</p>
      <H3>Try it</H3>
      <Ctl>
        <Check id="vfail" label="Vacuum pump fails" checked={s.vac.fail} onChange={(v) => up((d) => { d.vac.fail = v; })} />
        <Check id="sys" label="Show the SYSTEM page (VAC gauge) on the EIS" checked={s.avx.eisPage === "SYSTEM"} onChange={(v) => up((d) => { d.avx.eisPage = v ? "SYSTEM" : "ENGINE"; })} />
        <Readouts items={[["VAC", [`${live.vac.toFixed(1)} in.Hg`, live.vac < 3.5 ? "warnc" : ""]], ["LOW VACUUM", live.vac < 3.5 ? ["SHOWN", "warnc"] : "—"], ["Gyro rotor", `${Math.round(live.gyro * 100)}%`], ["GYRO flag", flag ? ["IN VIEW", "bad"] : "Hidden"]]} />
      </Ctl>
      <Small>The 182T ENGINE page has no VAC gauge — it is on the SYSTEM page (POH 7-63). The rotor runs down over a few minutes after the vacuum is lost and the standby horizon starts to drift; LOW VACUUM is also expected with the engine stopped (POH 4-7).</Small>
      <Caution title="LOW VACUUM (POH 3-21)">Check VAC on the EIS SYSTEM page. If the pointer is out of the green arc or the GYRO flag shows on the standby attitude indicator, it must not be used for attitude information.</Caution>
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("vacuum")} />
      <Facts rows={[["VAC green", "4.5–5.5 in.Hg (POH 2-7)"], ["Annunciation", "LOW VACUUM, amber, single tone, below 3.5 in.Hg"], ["Pump", "AA3215CC dry pump, arm −5.0, cooling shroud −5.6"], ["Regulator · transducer · filter", "Arms 2.1 · 8.5 · 11.5"], ["Run-up", "VAC indicator check at 1,800 RPM (POH 4-17)"], ["KOEL", "Pump, VAC indicator and standby attitude required for IFR (POH 2-13)"], ["Pump failure", "Use the PFD (AHRS) attitude; the autopilot isn't affected (POH 3-26)"]]} />
    </>
  );
}
