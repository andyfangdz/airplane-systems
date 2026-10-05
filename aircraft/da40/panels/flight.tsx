"use client";
import type { Vec3 } from "@/lib/math";
import type { Chan } from "@/lib/systems";
import { useView } from "@/lib/view";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Seg, Slider, Small, useTicker } from "@/components/ui/controls";
import { gfc700Engaged } from "@/lib/avionics/gfc700";
import { live, type FlapSel } from "../model";
import { CAT } from "../parts";
import { deflections } from "../rig";
import { useDA40 } from "../store";
import { SYS } from "../systems";

const dir = (v: number, pos: string, neg: string, mid: string, dz = 0.02) => (v > dz ? pos : v < -dz ? neg : mid);

const CHAN_CAM: Record<Chan, [Vec3, Vec3]> = {
  elevator: [[-1.8, 2.2, -9.6], [-1.6, -0.25, 0]],
  aileron: [[-3.6, 10.2, 0.5], [0.0, -0.45, 0]],
  rudder: [[-1.8, 2.2, 9.6], [-1.6, -0.3, 0]],
};

const RUNS: Record<Chan, { src: string; steps: string[] }> = {
  elevator: { src: "AFM 7.3 (text only — the AFM has no routing figure)", steps: [
    "Both sticks are tied together; pulling either one turns a lever under the cabin floor.",
    "A steel push rod runs aft under the seats (they lift out for inspection) and through the tail boom (intermediate supports inferred).",
    "At the base of the fin a bellcrank — two of its bearings are visible next to the lower rudder hinge — turns the run upward.",
    "A push rod climbs inside the fin to the elevator horn at the top of the rudder (T-tail).",
    "Elevator up 18°, down 16° (TCDS, 1,200 kg rigging). The GFC 700 pitch servo acts on this run; its trim servo drives the trim tab's Bowden cable.",
  ] },
  aileron: { src: "AFM 7.3 (bellcrank positions inferred)", steps: [
    "Rolling a stick moves the interconnect between the stick bases.",
    "Bellcranks turn that into a fore-aft push rod under the front seats, then into spanwise push rods behind the rear spar.",
    "In each wing a bellcrank drives a short steel push rod whose rod-end bearing bolts to the aluminium aileron horn (3 screws).",
    "Differential travel: up 20°, down 13° (TCDS). The GFC 700 roll servo acts on the cabin push rod.",
  ] },
  rudder: { src: "AFM 7.3, 7-7", steps: [
    "The pedals (adjustable on the ground, electrically on the XLS) pull steel cables.",
    "The cables run aft under the floor and through the tail boom.",
    "Their eyes connect to bolts on the rudder's lower bracket; the bearing bracket below holds the rudder stops.",
    "Rudder left 24°, right 26° with long-range tanks (TCDS). There is no cockpit rudder trim — only a fixed tab.",
  ] },
};

export function Controls() {
  useTicker(150);
  const s = useDA40((x) => x.s), up = useDA40((x) => x.update);
  const ctrlFocus = useView((x) => x.ctrlFocus), flyTo = useView((x) => x.flyTo);
  const focus = (v: Chan | "all") => {
    useView.getState().set({ ctrlFocus: v });
    const [p, t] = v === "all" ? SYS.find((d) => d.id === "controls")!.cam : CHAN_CAM[v];
    flyTo(p, t);
  };
  const e = live.eff, d = deflections(e.pitch, e.roll, e.yaw), trim = live.afcs.trim;
  const apOn = gfc700Engaged(live.afcs);
  return (
    <>
      <p className="lead">A centre stick at each front seat. Ailerons, elevator and flaps are moved by push rods, the rudder by cables. Elevator forces are trimmed by a tab on the elevator, worked through a Bowden cable from the black trim wheel in the centre console — and by the GFC 700 trim servo.</p>
      <H3>Try it</H3>
      <Ctl>
        <Seg id="chan" label="Show control run" options={[["all", "All"], ["elevator", "Elevator"], ["aileron", "Aileron"], ["rudder", "Rudder"]]} value={ctrlFocus} onChange={focus} />
        <Slider id="ctlPitch" label="Stick pitch (push ↔ pull)" min={-1} max={1} step={0.01} value={s.ctrl.pitch} onChange={(v) => up((x) => { x.ctrl.pitch = v; })} fmt={(v) => dir(v, "Nose up", "Nose down", "Neutral")} />
        <Slider id="ctlRoll" label="Stick roll" min={-1} max={1} step={0.01} value={s.ctrl.roll} onChange={(v) => up((x) => { x.ctrl.roll = v; })} fmt={(v) => dir(v, "Right", "Left", "Neutral")} />
        <Slider id="ctlYaw" label="Rudder pedals" min={-1} max={1} step={0.01} value={s.ctrl.yaw} onChange={(v) => up((x) => { x.ctrl.yaw = v; })} fmt={(v) => dir(v, "Right", "Left", "Neutral")} />
        <Slider id="trimW" label="Trim wheel (forward = nose down)" min={-1} max={1} step={0.01} value={trim} onChange={(v) => { live.afcs = { ...live.afcs, trim: v }; }} fmt={(v) => dir(v, `Nose up ${Math.round(v * 100)}%`, `Nose down ${Math.round(-v * 100)}%`, "Neutral")} />
        <BtnRow><button type="button" className="btn" onClick={() => up((x) => { x.ctrl = { pitch: 0, roll: 0, yaw: 0 }; })}>Centre controls</button></BtnRow>
        <Readouts items={[
          ["Elevator", d.elev > 0.3 ? `${d.elev.toFixed(0)}° up` : d.elev < -0.3 ? `${(-d.elev).toFixed(0)}° down` : "0°"],
          ["L / R aileron", `${fmtAil(d.ailL)} / ${fmtAil(d.ailR)}`],
          ["Rudder", d.rud > 0.3 ? `${d.rud.toFixed(0)}° R` : d.rud < -0.3 ? `${(-d.rud).toFixed(0)}° L` : "0°"],
          ["Trim tab", trim > 0 ? `${(trim * 12).toFixed(0)}° (nose up)` : `${(-trim * 39).toFixed(0)}° (nose down)`],
          ["Driven by", apOn ? ["AUTOPILOT SERVOS", "warnc"] : "Pilot"],
        ]} />
      </Ctl>
      {apOn && <Caution title="Autopilot engaged">The GFC 700 servos are flying the airplane — the stick follows them. Do not try to fly manually with the AP engaged: the servos oppose you and pitch trim runs the other way (AFMS p. 48). Disconnect in the Autopilot panel.</Caution>}
      {ctrlFocus !== "all" && (
        <>
          <H3>{ctrlFocus[0].toUpperCase() + ctrlFocus.slice(1)} run · {RUNS[ctrlFocus].src}</H3>
          <ol className="notes">{RUNS[ctrlFocus].steps.map((t) => <li key={t}>{t}</li>)}</ol>
        </>
      )}
      <H3>Mechanisms &amp; details — tap to locate</H3>
      <PartsList parts={CAT.pinned("controls")} />
      <H3>Details</H3>
      <Facts rows={[
        ["Ailerons", "4 hinges, roll-pinned · up 20° / down 13°"],
        ["Elevator", "5 hinges · up 18° / down 16° (1,200 kg rigging; LR tank 23°/16°)"],
        ["Rudder", "Cable-driven · L 24° / R 26° (long-range tank)"],
        ["Trim tab", "Bowden cable · nose up +12°, nose down −39° (TCDS)"],
        ["Trim wheel", "Centre console, friction device, T/O mark"],
        ["Electric trim", "GFC 700 servo, split switch on the pilot's stick; max 178 KIAS"],
        ["Pedals", "Ground-adjustable; electric on the XLS (rocker on leg-room wall)"],
        ["VA", "111 KIAS above 1,036 kg · 94 KIAS 780–1,036 kg (MÄM 40-227)"],
      ]} />
      <H3>Pilot notes</H3>
      <Notes items={[
        "Seats are removable so the control runs underneath can be inspected (AFM 7-15).",
        "Rod-end nuts carry locking varnish — a cracked varnish shows the adjustment was disturbed (AFM 7-4).",
        "The optional gust lock wraps around the stick and bears on the pedals (pedals fully aft). It must be removed before flight (AFM 8-5).",
        "A trim-wheel movement you didn't command is a cue for an autopilot or trim malfunction: AP DISC — hold, fly, retrim with the wheel, pull the AFCS breaker (AFMS p. 24).",
      ]} />
    </>
  );
}
const fmtAil = (up: number) => (up > 0.3 ? `${up.toFixed(0)}° up` : up < -0.3 ? `${(-up).toFixed(0)}° dn` : "0°");

export function Flaps() {
  useTicker(150);
  const s = useDA40((x) => x.s), E = useDA40((x) => x.E), up = useDA40((x) => x.update);
  const a = live.flapAng;
  const lit = (pos: 0 | 1 | 2) => E.flapsPwr && ([0, 20, 42].some((t, i) => i === pos && Math.abs(a - t) < 1) || (pos === 0 && a > 1 && a < 19) || (pos === 1 && ((a > 1 && a < 19) || (a > 21 && a < 41))) || (pos === 2 && a > 21 && a < 41));
  const lamp = (on: boolean, white: boolean) => (on ? (white ? { background: "#F4F6F8", boxShadow: "0 0 6px #fff" } : undefined) : undefined);
  return (
    <>
      <p className="lead">Electric flaps with three positions — Cruise (UP), Take-off (T/O) and Landing (LDG). One actuator turns a torsion tube in the fuselage that is connected to both flaps, so they always move together. Once selected, the flaps keep running until they reach that position; UP and LDG also have limit switches.</p>
      <H3>Flap selector (below the MFD)</H3>
      <Ctl>
        <Seg id="flapSel" label="Selector" options={[[0, "UP"], [1, "T/O · 108 KIAS"], [2, "LDG · 91 KIAS"]]} value={s.flaps.cmd} onChange={(v) => up((d) => { d.flaps.cmd = v as FlapSel; })} />
        <div className="lights3">
          <span><i className={lit(0) ? "g" : ""} />UP</span>
          <span><i style={lamp(lit(1), true)} />T/O</span>
          <span><i style={lamp(lit(2), true)} />LDG</span>
        </div>
        <Readouts items={[["Flap angle", a.toFixed(1) + "°"], ["FLAPS 5 A", E.flapsPwr ? "ESSENTIAL · OK" : ["NO POWER", "bad"]], ["Moving", Math.abs(a - [0, 20, 42][s.flaps.cmd]) > 0.3 && E.flapsPwr ? "Yes" : "No"]]} />
      </Ctl>
      <Small>Two lights at once means the flaps are travelling between those two positions (AFM 7-6). Flap angles are from the TCDS; travel time is not documented (≈7°/s here).</Small>
      {!E.flapsPwr && <Caution title="No flap power">The FLAPS breaker is out or the ESSENTIAL bus is dead — the flaps stop where they are and the lights go out. The flap drive's breaker is automatic but can also be pulled by hand (AFM 7-6).</Caution>}
      <H3>Details</H3>
      <Facts rows={[
        ["Positions", "UP 0° · T/O 20° ± 2° · LDG 42° ± 1° (TCDS)"],
        ["VFE", "T/O 108 KIAS · LDG 91 KIAS (AFM 2-3)"],
        ["White arc (G1000)", "58–91 KIAS"],
        ["Load factor", "+2.0 g with T/O or LDG flaps"],
        ["Construction", "GFRP/CFRP sandwich, 6 hinges, roll-pinned"],
        ["Lights", "UP green · T/O white · LDG white"],
        ["Power", "FLAPS 5 A, ESSENTIAL — still works on ESS BUS"],
        ["Area", "1.56 m² (both)"],
      ]} />
      <H3>Flap failure (AFM 4B-9)</H3>
      <Notes items={["Check the flap position visually, keep the airspeed in the white sector, recheck all switch positions.", "Only UP or T/O available: approach at 76 KIAS (1,200 kg), land at a flat angle using the throttle for speed and descent.", "Only LDG available: normal landing."]} />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("flaps")} />
    </>
  );
}

export function Gear() {
  const s = useDA40((x) => x.s), up = useDA40((x) => x.update);
  return (
    <>
      <p className="lead">Fixed tricycle gear: sprung-steel main legs and a free-castering nose wheel sprung by an elastomer package. Hydraulic disc brakes on the main wheels are worked by toe pedals at both seats; a parking-brake valve under the panel traps the pressure.</p>
      <H3>Try it</H3>
      <Ctl>
        <Slider id="diff" label="Toe brakes (differential)" min={-1} max={1} step={0.01} value={s.gear.diff} onChange={(v) => up((d) => { d.gear.diff = v; })} fmt={(v) => dir(v, "Right brake", "Left brake", "Released", 0.05)} />
        <Check id="park" label="PARKING BRAKE lever down (set)" checked={s.gear.park} onChange={(v) => up((d) => { d.gear.park = v; })} />
        <Readouts items={[["Nose wheel", "Free-castering"], ["Turning", dir(s.gear.diff, "Right", "Left", "Straight", 0.05)], ["Parking brake", s.gear.park ? ["SET", "warnc"] : "Released"]]} />
      </Ctl>
      <Small>To set the parking brake: lever down until it catches, then pump the toe brakes to build pressure. Push the lever up to release (AFM 7-13).</Small>
      <H3>Hydraulic schematic (AFM 7-14)</H3>
      <Notes items={[
        "Four master cylinders (Cleveland 10-54), one per pedal. Each co-pilot cylinder (with its small reservoir) is plumbed in series with the pilot cylinder on the same side.",
        "The two pilot cylinders feed the parking-brake valve (Cleveland 60-59), which feeds the left and right wheel brake cylinders (Cleveland 30-239).",
      ]} />
      <H3>Details</H3>
      <Facts rows={[
        ["Main tyres", "15 × 6.0-6 (thin/tall strut) or 6.00-6 · 2.5 bar / 36 psi"],
        ["Nose tyre", "5.00-5 · 2.0 bar / 29 psi"],
        ["Track / wheelbase", "2.97 m / 1.68 m"],
        ["Main gear", "Sprung steel struts (no oleo)"],
        ["Nose gear", "Free-castering, elastomer spring; no steering linkage"],
        ["Wheel fairings", "Removable; −5 % cruise speed without (AFM 5-17)"],
        ["Max landing mass", "1,150 kg with the modified MLG strut (1,092 kg original)"],
      ]} />
      <H3>Ground handling</H3>
      <Notes items={[
        "Steer with rudder and differential braking; in strong crosswind braking helps but lengthens the take-off roll (AFM 4A-25).",
        "Without a tow bar, push down on the tail at the fin junction to lift the nose wheel and pivot on the mains (AFM 8-3).",
        "The tow bar clips into holes in the nose-wheel fairing — remove it before starting the engine (AFM 8-3).",
        "Test the brakes as you move off; park into wind with the parking brake set and flaps up (AFM 4A-20, 8-5).",
        "Defective brakes: land on grass if possible (AFM 3-32). A flat main tyre: land on the side of the runway of the good tyre, that wing low (AFM 3-31).",
      ]} />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("gear")} />
    </>
  );
}
