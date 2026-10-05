"use client";
import { HoldKey } from "@/components/avionics/parts";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Seg, Slider, Small, useTicker } from "@/components/ui/controls";
import { densityFactor, enginePower, fuelInd, lambda, live, type FuelSel, type Mags } from "../model";
import { CAT } from "../parts";
import { useC172 } from "../store";
import { Scenarios } from "./general";

const pct = (v: number) => Math.round(v * 100) + "%";
const thr = (v: number) => (v < 0.02 ? "IDLE (full out)" : v > 0.98 ? "FULL (full in)" : `${pct(v)} in`);
const mixFmt = (v: number) => (v <= 0.05 ? "IDLE CUTOFF" : v > 0.97 ? "FULL RICH" : `Leaned · ${pct(v)}`);
const rpm10 = () => String(Math.round(live.rpm / 10) * 10);
const tick = (b: boolean) => (b ? "✓ " : "· ");

/** MAGNETOS rotary with the spring-loaded START position held by a button. */
function MagSwitch() {
  const s = useC172((x) => x.s), E = useC172((x) => x.E), up = useC172((x) => x.update);
  const set = (m: Mags) => up((d) => { d.eng.mags = m; });
  return (
    <div className="row">
      <div className="lbl"><span>MAGNETOS switch</span><span>{s.eng.mags}{live.crankT > 0 ? ` · cranking ${live.crankTotal.toFixed(0)} s` : ""}</span></div>
      <div className="btnrow" style={{ alignItems: "center" }}>
        <div className="seg" role="group" aria-label="MAGNETOS">
          {(["OFF", "R", "L", "BOTH"] as const).map((m) => <button key={m} type="button" aria-pressed={s.eng.mags === m} onClick={() => set(m)}>{m}</button>)}
        </div>
        <HoldKey className="wide" label="START" sub="hold" title="Turn the key through BOTH to START and hold to crank; it springs back to BOTH"
          onDown={() => { live.crankT = 0; set("START"); }} onUp={() => set("BOTH")} />
        {!E.starterPwr && <span className="small" style={{ margin: 0 }}>No starter power (MASTER BAT / WARN breaker)</span>}
      </div>
    </div>
  );
}

export function Engine() {
  useTicker(150);
  const s = useC172((x) => x.s), E = useC172((x) => x.E), up = useC172((x) => x.update);
  const g = s.eng, alt = live.fs.alt;
  const lam = lambda(g.mix, alt), P = g.running ? enginePower(s, alt) : 0;
  const state = g.running ? (live.primeRun > 0 ? [g.mix < 0.06 ? "RUNNING ON PRIME — ADVANCE MIXTURE" : "TOO LEAN — DYING", "warnc"] : "RUNNING") : g.mags === "START" ? ["CRANKING", "warnc"] : g.flooded ? ["FLOODED", "bad"] : ["STOPPED", "bad"];
  const steps: [boolean, string][] = [
    [s.fuel.sel === "BOTH" && s.fuel.shutoff, "FUEL SELECTOR BOTH · FUEL SHUTOFF ON (push full in)"],
    [!s.elec.avn1 && !s.elec.avn2, "AVIONICS (BUS 1 and BUS 2) OFF"],
    [g.throttle > 0.04 && g.throttle < 0.2, "Throttle OPEN ¼ INCH"],
    [g.mix <= 0.05 || g.running, "Mixture IDLE CUTOFF"],
    [s.elec.stby === "ARM" && E.eBus != null && E.eBus >= 24, "STBY BATT: TEST (10 s, lamp stays on), then ARM — BUS E ≥ 24 V"],
    [s.elec.bat && s.elec.alt, "MASTER (ALT and BAT) ON"],
    [s.lights.beacon, "BEACON ON"],
    [live.wet > 0.3 || g.running || live.hot > 0.6, "Prime: FUEL PUMP ON, mixture FULL RICH until stable fuel flow (3–5 s), then IDLE CUTOFF and FUEL PUMP OFF (omit if warm)"],
    [g.running, "MAGNETOS START — release when the engine starts"],
    [g.running && g.mix > 0.9, "Mixture ADVANCE SMOOTHLY TO RICH"],
    [g.running && live.oilP >= 50, "Oil pressure in the green within 30–60 s"],
    [g.running && E.mBatt > 0 && !E.lowVolts, "AMPS positive (charge), LOW VOLTS not shown"],
  ];
  return (
    <>
      <p className="lead">Lycoming IO-360-L2A: four-cylinder, horizontally opposed, fuel injected, 180 BHP at 2,700 RPM, driving a fixed-pitch McCauley propeller. Throttle and mixture are push-pull knobs below the standby instruments; two magnetos fire two plugs per cylinder. There is no carburetor heat — the injection system is considered non-icing — and the alternate air door opens by itself (POH 7-29 – 7-37, 4-35).</p>
      <H3>Scenarios</H3>
      <Ctl><Scenarios /></Ctl>
      <H3>Engine controls</H3>
      <Ctl>
        <MagSwitch />
        <Slider id="thr" label="Throttle (black knob)" min={0} max={1} step={0.005} value={g.throttle} onChange={(v) => up((d) => { d.eng.throttle = v; })} fmt={thr} />
        <Slider id="mix" label="Mixture (red knob)" min={0} max={1} step={0.005} value={g.mix} onChange={(v) => up((d) => { d.eng.mix = v; })} fmt={mixFmt} />
        <Check id="fpump" label="FUEL PUMP switch ON (aux pump)" checked={s.fuel.pump} onChange={(v) => up((d) => { d.fuel.pump = v; })} />
        <Readouts items={[
          ["Engine", state as [string, "bad" | "warnc"] | string], ["RPM", rpm10()], ["FFLOW GPH", live.ff.toFixed(1)], ["Power", g.running ? pct(P) : "—"],
          ["OIL PRES", [`${Math.round(live.oilP)} psi`, live.oilP <= 20 ? "bad" : ""]], ["OIL TEMP", `${Math.round(live.oilT)} °F`], ["EGT", `${Math.round(live.egt)} °F`], ["CHT", `${Math.round(live.cht)} °F`],
          ["Fuel/air", g.running ? (lam > 1.08 ? "Rich of peak" : lam > 0.95 ? "Near peak EGT" : ["Lean of peak", "warnc"]) : "—"],
          ["Cylinders", g.running ? (live.hot > 0.6 ? "Warm" : "Warming up") : live.wet > 1.9 ? ["FLOODED", "bad"] : live.wet > 0.3 ? "Primed" : live.hot > 0.6 ? "Warm" : "Dry"],
        ]} />
      </Ctl>
      <Small>Static RPM at full throttle is 2,300–2,400 and idle about 675 (POH 2-6, 4-30). Too much priming floods the engine: mixture IDLE CUTOFF, throttle ½ to full, crank, then RICH and throttle back when it fires (POH 4-12). Temperatures and fuel flow are a teaching model.</Small>
      <H3>Starting with battery (POH 4-11 – 4-13)</H3>
      <ol className="notes">{steps.map(([ok, t]) => <li key={t} style={{ color: ok ? "var(--ink)" : "var(--muted)" }}>{tick(ok)}{t}</li>)}</ol>
      {live.crankTotal > 10 && <Caution title="Starter limit">Crank no more than 10 seconds, then let the starter cool 20 seconds; after three cycles cool it 10 minutes (POH 4-26).</Caution>}
      <H3>Failures</H3>
      <Ctl>
        <BtnRow>
          <Check id="magL" label="Left magneto dead" checked={g.fail.magL} onChange={(v) => up((d) => { d.eng.fail.magL = v; })} />
          <Check id="magR" label="Right magneto dead" checked={g.fail.magR} onChange={(v) => up((d) => { d.eng.fail.magR = v; })} />
          <Check id="edp" label="Engine-driven fuel pump fails" checked={g.fail.edp} onChange={(v) => up((d) => { d.eng.fail.edp = v; })} />
          <Check id="filt" label="Induction filter blocked (ice)" checked={g.filter} onChange={(v) => up((d) => { d.eng.filter = v; })} />
          <Check id="oil" label="Loss of oil" checked={g.fail.oil} onChange={(v) => up((d) => { d.eng.fail.oil = v; })} />
        </BtnRow>
      </Ctl>
      <Small>Engine-driven pump failure: FFLOW drops to about zero, then the engine quits a couple of seconds later — FUEL PUMP ON restores enough fuel for maximum continuous power (POH 3-34, 3-7). A hot engine restarts without priming, mixture at IDLE CUTOFF: advance the mixture within a few seconds of it firing. Blocked filter: the alternate air door opens; up to 10% power loss at full throttle (POH 7-36).</Small>
      <H3>Ignition</H3>
      <Facts rows={[["Left magneto", "Upper left + lower right plugs"], ["Right magneto", "Lower left + upper right plugs"], ["MAGNETOS", "OFF – R – L – BOTH – START (springs back to BOTH)"], ["Starter", "Contactor in the J-box; coil fed through WARN (CROSSFEED BUS)"], ["Mag check", "1,800 RPM: ≤ 175 RPM drop each, ≤ 50 RPM between (POH 4-16)"], ["No drop", "Faulty ground (hot mag) or timing set in advance"]]} />
      <H3>Engine data (POH 1-5, 2-6, 7-35)</H3>
      <Facts rows={[["Rating", "180 BHP @ 2,700 RPM"], ["Oil", "8 qt sump (9 with filter) · minimum 5 qt"], ["Oil pressure", "Red 0–20 · green 50–90 · red 115–120 PSI"], ["Oil temperature", "Green 100–245 °F · red 245"], ["CHT", "Red line 500 °F (LEAN page)"], ["Tachometer", "Green 2,100–2,500 (SL) / 2,600 (5,000 ft) / 2,700 (10,000 ft) · red 2,700–3,000; flashes red at 2,780"], ["Cooling", "Two front inlets, baffles, exit at the cowl's bottom aft edge; no cowl flaps"], ["Induction", "Lower-front intake → filter → air box (alternate air door) → fuel/air control unit"], ["Exhaust", "Risers → one muffler below the engine → single tailpipe; heater shroud around the muffler"]]} />
      <H3>Leaning</H3>
      <Notes items={["Above 75% power use FULL RICH. At or below 75%, lean to 50 °F rich of peak EGT (recommended) or to peak (best economy, ~3 kt slower) on the LEAN page (POH 4-36).", "Ground: lean for maximum RPM at 1,200, then 800–1,000 RPM for taxi (POH 4-26).", "Takeoff and climb full rich up to 3,000 ft pressure altitude, leaned for maximum RPM above (POH 4-33)."]} />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("engine")} />
    </>
  );
}

export function Propeller() {
  useTicker(150);
  const s = useC172((x) => x.s), up = useC172((x) => x.update);
  const ias = s.ground ? 0 : live.fs.ias, P = s.eng.running ? enginePower(s, live.fs.alt) : 0;
  return (
    <>
      <p className="lead">A one-piece forged aluminum McCauley 1A170E/JHA7660: two blades, 76 inches, fixed pitch. With no governor, RPM is whatever the engine's torque and the propeller's load settle at — so it follows the throttle, but also rises with airspeed in a descent and falls in a climb. The throttle is the only control (POH 7-37).</p>
      <H3>Try it</H3>
      <Ctl>
        <Slider id="thr2" label="Throttle" min={0} max={1} step={0.005} value={s.eng.throttle} onChange={(v) => up((d) => { d.eng.throttle = v; })} fmt={thr} />
        <Slider id="pitch2" label="Control wheel (pitch → airspeed)" min={-1} max={1} step={0.01} value={s.ctrl.pitch} onChange={(v) => up((d) => { d.ctrl.pitch = v; })} fmt={(v) => (v > 0.02 ? "Pull · climb" : v < -0.02 ? "Push · descend" : "Neutral")} />
        <Readouts items={[["RPM", [rpm10(), live.rpm >= 2780 ? "bad" : live.rpm > 2700 ? "warnc" : ""]], ["IAS", `${Math.round(ias)} KT`], ["Power", s.eng.running ? pct(P) : "—"], ["Density", pct(densityFactor(live.fs.alt))]]} />
      </Ctl>
      <Small>RPM model: static RPM ∝ ∛power (2,350 at full power, sea level) plus about 3.8 RPM per knot of airspeed — a teaching approximation matched to the POH static and cruise figures. Push the wheel with full throttle in level flight to see the tach go past the red line.</Small>
      <H3>Reading the tach without a governor</H3>
      <Notes items={["Full-throttle static run-up should show about 2,300–2,400 RPM with the mixture leaned for maximum RPM (POH 4-31).", "Power settings come from the cruise tables by RPM and altitude: e.g. 2,000 ft, 2,550 RPM ≈ 77% (118 KTAS, 10.5 GPH); 6,000 ft, 2,500 RPM ≈ 65% (114 KTAS, 9.0 GPH) (POH Fig. 5-8).", "Don't exceed 2,700 RPM: in a descent the windmilling propeller can overspeed the engine — reduce throttle as speed builds.", "A windmilling propeller keeps the engine turning after a fuel interruption: restore fuel and it restarts within a few seconds (POH 3-7)."]} />
      <Facts rows={[["Model", "McCauley 1A170E/JHA7660"], ["Diameter", "76 in max, 75 in min"], ["Blades", "2, fixed pitch, anodized forged aluminum"], ["Ground clearance", "11.25 in"], ["Spinner", "Dome FS −42.6"], ["Care", "Dress nicks; never alkaline cleaners (POH 8-24)"]]} />
      <PartsList parts={CAT.pinned("propeller")} />
    </>
  );
}

export function Fuel() {
  useTicker(400);
  const s = useC172((x) => x.s), E = useC172((x) => x.E), up = useC172((x) => x.update);
  const f = s.fuel, iL = fuelInd(f.qL), iR = fuelInd(f.qR);
  const feeding = !f.shutoff ? ["SHUTOFF", "bad"] : !E.fuelOk ? ["DRY TANK", "bad"] : f.sel;
  return (
    <>
      <p className="lead">Two vented integral wing tanks gravity-feed through a three-position selector (BOTH, RIGHT, LEFT — no OFF) to a reservoir tank, then the electric auxiliary pump, the fuel shutoff valve and the strainer to the engine-driven pump, the fuel/air control unit and the flow divider on top of the engine. A return line sends a little fuel and vapor back to the reservoir (POH 7-38, Figure 7-6).</p>
      <H3>Try it</H3>
      <Ctl>
        <Seg id="fsel" label="FUEL SELECTOR" options={[["LEFT", "LEFT"], ["BOTH", "BOTH"], ["RIGHT", "RIGHT"]] as [FuelSel, string][]} value={f.sel} onChange={(v) => up((d) => { d.fuel.sel = v; })} />
        <Check id="shut" label="FUEL SHUTOFF valve ON (pushed in)" checked={f.shutoff} onChange={(v) => up((d) => { d.fuel.shutoff = v; })} />
        <Check id="pump" label="FUEL PUMP ON" checked={f.pump} onChange={(v) => up((d) => { d.fuel.pump = v; })} />
        <Slider id="qL" label="Left tank (usable)" min={0} max={26.5} step={0.1} value={f.qL} onChange={(v) => up((d) => { d.fuel.qL = v; })} fmt={(v) => v.toFixed(1) + " gal"} />
        <Slider id="qR" label="Right tank (usable)" min={0} max={26.5} step={0.1} value={f.qR} onChange={(v) => up((d) => { d.fuel.qR = v; })} fmt={(v) => v.toFixed(1) + " gal"} />
        <BtnRow>
          {([["Full · 53", 26.5, 26.5], ["Tabs · 35", 17.5, 17.5], ["Low · 4 / 4.5", 4, 4.5], ["Imbalance", 22, 8]] as const).map(([t, l, r]) => (
            <button key={t} type="button" className="btn" onClick={() => { live.timers.lowL = live.timers.lowR = 0; up((d) => { d.fuel.qL = l; d.fuel.qR = r; }); }}>{t}</button>
          ))}
        </BtnRow>
        <Readouts items={[
          ["Gauge L / R", [`${iL.toFixed(0)} / ${iR.toFixed(0)}`, iL < 5 || iR < 5 ? "warnc" : ""]], ["Usable total", (f.qL + f.qR).toFixed(1)], ["Feeding", feeding as [string, "bad"] | string], ["FFLOW", `${live.ff.toFixed(1)} GPH`],
          ["Aux pump", f.pump ? (E.fuelPumpOn ? "Running" : ["NO PWR", "bad"]) : "Off"], ["LOW FUEL", s.ann.lowFuelL || s.ann.lowFuelR ? ["SHOWN", "warnc"] : iL < 5 || iR < 5 ? `in ${Math.max(0, 60 - Math.max(live.timers.lowL, live.timers.lowR)).toFixed(0)} s` : "—"],
        ]} />
      </Ctl>
      <Small>The gauges read 0 with 1.5 gal unusable left and stop at about 24 gal — check the tanks visually before every flight (POH 7-39). LOW FUEL L / R come on below 5 gal indicated after 60 seconds. With the engine running, an empty selected tank or the shutoff OFF stops it after a few seconds.</Small>
      <H3>Annunciations &amp; gauge</H3>
      <Facts rows={[["LOW FUEL L / R", "Amber, single tone: < 5 gal for > 60 s; pointer and label turn amber"], ["Empty", "Pointer and label flash red; annunciation stays amber"], ["Gauge markings", "Red line 0 · yellow 0–5 · green 5–24 gal (POH 2-7)"], ["Sensor failure", "Red X through the top (left) or bottom (right) of the gauge"], ["Totalizer", "GAL USED / GAL REM from fuel flow only — not the tank sensors (POH 7-41)"]]} />
      <Caution title="Limitations">Takeoff and land on BOTH. LEFT or RIGHT for level flight only. With ¼ tank or less, no prolonged uncoordinated flight on one tank; maximum 30 s slip or skid with one tank dry (POH 2-18, 7-45).</Caution>
      <H3>Capacities</H3>
      <Facts rows={[["Total", "56.0 gal · 28.0 per tank"], ["Usable", "53.0 gal · 26.5 per tank"], ["To the filler tabs", "35.0 gal usable · 17.5 per tank"], ["Grades", "100LL (blue) or 100 (green)"], ["Fuel CG", "FS 48.0"], ["AP imbalance limit", "90 lb (15 gal) with the autopilot engaged"]]} />
      <H3>Using the aux pump</H3>
      <Notes items={["Priming before start, through the injection system. Left on with the master on, mixture rich and the engine stopped it will flood the engine (POH 7-43).", "Not needed for normal takeoff and landing. Turn it on if fuel flow fluctuates more than 1 GPH, for vapor on hot days, or after an engine-driven pump failure (POH 7-43, 3-15).", "Drain every tank sump, the reservoir, the selector drain and the strainer before each flight and after refueling (POH 7-46). Figure 7-6 labels “Fuel Tank Drain Valve (5 Total)” under each tank."]} />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("fuel")} />
    </>
  );
}
