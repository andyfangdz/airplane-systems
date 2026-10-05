"use client";
import { Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Rocker, Seg, Slider, Small, useTicker } from "@/components/ui/controls";
import { STALL_KIAS, hornLevel, live, type FlapSel } from "../model";
import { CAT } from "../parts";
import { useDA40 } from "../store";

export function Environment() {
  const s = useDA40((x) => x.s), up = useDA40((x) => x.update);
  const env = s.env, ram = s.air || s.eng.running;
  return (
    <>
      <p className="lead">Two levers on the small centre console under the panel: CABIN HEAT (up = ON) and the air-distribution lever (up = canopy, down = floor). Heated air comes from a shroud around the exhaust muffler fed by the right cowling intake; unheated fresh air comes in under the left stub wing and leaves through the nozzles in the panel, the roll bar and above the rear seats. There is no blower — airflow is ram air.</p>
      <H3>Levers</H3>
      <Ctl>
        <Slider id="heat" label="CABIN HEAT lever (OFF ↓ … ↑ ON)" min={0} max={1} step={0.05} value={env.heat} onChange={(v) => up((d) => { d.env.heat = v; })} fmt={(v) => (v < 0.03 ? "OFF" : v > 0.97 ? "ON" : Math.round(v * 100) + "%")} />
        <Slider id="dist" label="Air distribution (▼ floor … ▲ canopy)" min={0} max={1} step={0.05} value={env.dist} onChange={(v) => up((d) => { d.env.dist = v; })} fmt={(v) => (v < 0.03 ? "▼ FLOOR" : v > 0.97 ? "▲ DEFROST" : `${Math.round((1 - v) * 100)}% floor · ${Math.round(v * 100)}% canopy`)} />
        <Check id="win" label="Left canopy (emergency) window open" checked={env.window} onChange={(v) => up((d) => { d.env.window = v; })} />
        <Readouts items={[
          ["Airflow", ram ? (s.air ? "Ram air" : "Prop wash only") : ["None (engine off)", "warnc"]],
          ["Heat valve", env.heat < 0.03 ? "Overboard (OFF)" : "To cabin " + Math.round(env.heat * 100) + "%"],
          ["Defrost / floor", `${Math.round(env.dist * 100)}% / ${Math.round((1 - env.dist) * 100)}%`],
          ["Canopy", s.doors.canopy === "GAP" ? "Cooling gap" : s.doors.canopy === "OPEN" ? "Open" : "Closed"],
        ]} />
      </Ctl>
      <Small>The heat source, valves and duct routing come from an unofficial DA40 technical description — the AFM only describes the two levers and the nozzles. The canopy cooling-gap position (Cabin panel) is for the ground only.</Small>
      <H3>Procedures that use heat and air</H3>
      <Notes items={[
        "Engine fire (start, take-off or in flight): CABIN HEAT OFF (AFM 3-22 … 3-26).",
        "Suspected carbon monoxide: cabin heat OFF, ventilation open, emergency windows open, forward canopy open — the canopy may be unlatched in flight and stays partly open (AFM 3-39).",
        "Unintentional icing: pitot heat ON, cabin heat ON, air distribution ▲ UP, RPM increase, alternate air OPEN (AFMS p. 31).",
        "Electrical smoke: cabin heat OFF, emergency window(s) OPEN (AFMS p. 29).",
        "With the alternate static valve open, the emergency window and cockpit vent must be closed (placard, AFM 2-29).",
      ]} />
      <H3>Details</H3>
      <Facts rows={[
        ["Panel nozzles", "Movable, at both ends of the instrument panel (AFM 7-12)"],
        ["Roll-bar nozzles", "Spherical, beside the front seats; one above the rear seats"],
        ["Nozzle control", "Open and close by twisting"],
        ["Fresh-air inlet", "Under the left stub wing (walk-around: 'air intake on lower surface')"],
        ["Winter baffle", "Optional plate over the inlet; remove above 15 °C / 59 °F (Suppl. E7)"],
        ["Emergency window", "Left canopy window opens for air or escape (AFM 7-17)"],
        ["Fan", "None — no cabin blower in the documents"],
        ["CO detector", "Remote light on the panel; stays on until CO < 50 ppm (AFM 7-55)"],
      ]} />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("environment")} />
    </>
  );
}

export function Pitot() {
  useTicker(200);
  const s = useDA40((x) => x.s), E = useDA40((x) => x.E), up = useDA40((x) => x.update);
  const horn = hornLevel(s), vs = STALL_KIAS[s.flaps.cmd];
  const heatState = !s.pitot.heat ? ["PITOT OFF", "warnc"] as [string, "warnc"] : !E.pitotPwr || s.pitot.heaterFail ? ["PITOT FAIL", "warnc"] as [string, "warnc"] : "Heating";
  return (
    <>
      <p className="lead">One heated pitot-static probe under the left wing measures total pressure at its tip and static pressure at two orifices on its lower and rear edges; filters at the wing root keep out dirt and water. An optional alternate static valve under the panel uses cabin pressure. The stall warning is purely pneumatic: suction at a red-ringed orifice in the left wing leading edge blows a horn in the panel.</p>
      <H3>Pitot heat</H3>
      <Ctl>
        <div className="switches"><Rocker label="PITOT" on={s.pitot.heat} onToggle={() => up((d) => { d.pitot.heat = !d.pitot.heat; })} /></div>
        <Slider id="oat" label="Outside air temperature" min={-25} max={35} step={1} value={s.pitot.oat} onChange={(v) => up((d) => { d.pitot.oat = v; })} fmt={(v) => `${v} °C / ${Math.round((v * 9) / 5 + 32)} °F`} />
        <Check id="hfail" label="Heater failed (thermal fuse blown)" checked={s.pitot.heaterFail} onChange={(v) => up((d) => { d.pitot.heaterFail = v; })} />
        <Check id="alts" label="Alternate static valve OPEN" checked={s.pitot.altStatic} onChange={(v) => up((d) => { d.pitot.altStatic = v; })} />
        <Readouts items={[["Pitot heat", heatState], ["PITOT 10 A", E.pitotPwr ? "ESSENTIAL · OK" : ["NO POWER", "bad"]], ["Static source", s.pitot.altStatic ? ["CABIN", "warnc"] : "Probe"]]} />
      </Ctl>
      <H3>Stall warning</H3>
      <Ctl>
        <Slider id="sias" label="Airspeed (demo)" min={0} max={110} step={1} value={s.stall.ias} onChange={(v) => up((d) => { d.stall.ias = v; })} fmt={(v) => `${v} KIAS`} />
        <Seg id="sflap" label="Flaps" options={[[0, "UP"], [1, "T/O"], [2, "LDG"]]} value={s.flaps.cmd} onChange={(v) => up((d) => { d.flaps.cmd = v as FlapSel; })} />
        <Check id="sblk" label="Orifice blocked (e.g. ice, insects)" checked={s.stall.blocked} onChange={(v) => up((d) => { d.stall.blocked = v; })} />
        <Readouts items={[
          ["Stall speed", `${vs} KIAS (1,200 kg)`],
          ["Horn", horn > 0 ? [horn > 0.9 ? "LOUD" : "SOUNDING", "bad"] : "Quiet"],
          ["Margin", `${Math.round(Math.min(s.stall.ias, s.air ? live.fs.ias : 999) - vs)} kt`],
        ]} />
      </Ctl>
      <Small>The horn sounds from about 10 kt down to at least 5 kt above the stall and gets louder as you slow (AFM 7-54). It needs no electrical power — and with no airflow on the ground it is silent. Stall speeds 0° bank (AFM 5-8): 1,200 kg UP 53 · T/O 52 · LDG 52; 1,150 kg 52 · 51 · 49 KIAS.</Small>
      {s.pitot.altStatic && <Caution title="Alternate static">Close the emergency window and cockpit vent (placard). The AFM gives no alternate-static correction table; expect the airspeed and altitude to read a little high from the lower cabin pressure (illustrative in the model).</Caution>}
      <H3>Annunciations</H3>
      <Facts rows={[["PITOT OFF (yellow)", "Pitot heat not switched on"], ["PITOT FAIL (yellow)", "Fault in the pitot heating system — also after long ground use (thermal switch)"], ["AIRSPEED / ALTITUDE / VERT SPEED FAIL", "Red X on the PFD tapes when air data is lost — use the standby instruments"]]} />
      <H3>Details</H3>
      <Facts rows={[
        ["Probe", "DAI-9034-57-00 heated pitot/static, left wing"],
        ["Heat control", "PITOT switch; thermal switch + thermal fuse in the probe"],
        ["Heat check", "Before taxi: ON — no PITOT FAIL; OFF if not needed (AFMS p. 45)"],
        ["Air data", "GDC 74A behind the panel; OAT probe under the right fuselage"],
        ["Standby", "Pneumatic airspeed and altimeter"],
        ["Required", "Pitot heat and alternate static for night VFR (AFM 2-20)"],
        ["Stall horn check", "Walk-around: suck on the orifice (AFM 4A-6)"],
        ["Autopilot", "Below 70 KIAS in PIT/VS/ALT a stall is possible — disconnect if the horn sounds (AFMS p. 48)"],
      ]} />
      <H3>Notes</H3>
      <Notes items={["Icing with PITOT FAIL: alternate static OPEN and emergency windows closed (AFMS p. 31).", "Economical use of pitot heat stretches battery time after an alternator failure (AFMS p. 32).", "The probe's span station and the stall orifice position are not in the documents; the model places them approximately."]} />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("pitot")} />
    </>
  );
}
