"use client";
import { useState } from "react";
import type { Vec3 } from "@/lib/math";
import type { Chan } from "@/lib/systems";
import { useView } from "@/lib/view";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Seg, Slider, Small, useTicker } from "@/components/ui/controls";
import { live, stallKias, type FlapCmd } from "../model";
import { CAT } from "../parts";
import { RIG, RUD_TRIM } from "../rig";
import { useC182 } from "../store";
import { SYS } from "../systems";
import { FLAP_RATE } from "../tick";

const dir = (v: number, pos: string, neg: string, mid: string, dz = 0.02) => (v > dz ? pos : v < -dz ? neg : mid);
const R2D = 180 / Math.PI;

const CHAN_CAM: Record<Chan, [Vec3, Vec3]> = {
  elevator: [[-1.9, 2.7, -11.4], [-1.0, 0.0, 0]],
  aileron: [[-4.2, 11.2, 0.5], [0.6, 0.4, 0]],
  rudder: [[-1.9, 2.7, 11.4], [-1.0, 0.0, 0]],
};

const RUNS: Record<Chan, { fig: string; steps: string[] }> = {
  elevator: { fig: "POH Figure 7-1, Sheet 2", steps: [
    "Pushing or pulling either control wheel slides both shafts; behind the panel a transverse member joins them to an arm at the lower forward cabin.",
    "That arm rocks the forward elevator bellcrank; two cables — up and down — drop to pulleys at the cabin floor.",
    "The cables run aft under the floor and through the tailcone over pulley pairs to a bellcrank in the aft tailcone, just forward of and below the stabilizer.",
    "A push-pull tube from that bellcrank drives the arm on the elevator torque tube, which moves both halves; a downspring beside it gives a nose-down bias for stability (POH 7-6).",
    "The KAP 140 KS-270C pitch servo (FS 158.8) drives the same cables when the autopilot is engaged.",
  ] },
  aileron: { fig: "POH Figure 7-1, Sheet 1", steps: [
    "Turning either control wheel turns its shaft; a cable across the lower forward cabin interconnects the two wheels.",
    "From pulleys at the base of each forward door post the cable runs up inside the post to the wing root.",
    "In each wing the cable runs out to the aileron bellcrank near the chord break, which drives the aileron through a short push-pull rod.",
    "A balance cable joins the two bellcranks across the cabin top — one aileron goes up as the other goes down (up 20° / down 15°).",
    "The KAP 140 KS 271C roll servo (FS 52.0) drives the aileron system.",
  ] },
  rudder: { fig: "POH Figure 7-1, Sheet 1", steps: [
    "The interconnected rudder/brake pedals turn the rudder bars just aft of the firewall.",
    "Two cables run aft along the floor and through the tailcone over pulley pairs to the rudder horn at the bottom of the rudder.",
    "Spring-loaded steering bungees from the rudder bars to the nose gear steer the nosewheel about 11° each side.",
    "Rudder trim: a horizontally mounted wheel on the pedestal turns a vertical shaft down to a bungee on the rudder system — no trim tab on the rudder (POH 7-7).",
    "No yaw servo: the KAP 140 is two-axis (roll and pitch).",
  ] },
};

export function Controls() {
  useTicker(150);
  const s = useC182((x) => x.s), up = useC182((x) => x.update);
  const ctrlFocus = useView((x) => x.ctrlFocus), flyTo = useView((x) => x.flyTo);
  const focus = (v: Chan | "all") => {
    useView.getState().set({ ctrlFocus: v });
    const [p, t] = v === "all" ? SYS.find((d) => d.id === "controls")!.cam : CHAN_CAM[v];
    flyTo(p, t);
  };
  const yaw = Math.max(-1, Math.min(1, live.ctl.yaw + s.ctrl.rudTrim * RUD_TRIM.bias));
  const a = RIG.surfaceAngles({ ...live.ctl, yaw, trim: live.kap.trim }, live.flapAng);
  const servo = live.kap.ap;
  // the trim position lives in the KAP 140 state (outside React): re-render at once so the slider doesn't snap back
  const [, force] = useState(0);
  const setTrim = (v: number) => { live.kap = { ...live.kap, trim: v }; force((n) => n + 1); };
  return (
    <>
      <p className="lead">Conventional ailerons, elevator and rudder are moved through cables and mechanical linkage: control wheels for the ailerons and elevator, rudder/brake pedals for the rudder. The elevator system has downsprings for stability. Elevator trim is a tab in the right elevator set by a vertical wheel on the pedestal; rudder trim is a horizontal wheel acting through a bungee on the rudder system (POH 7-6, 7-7).</p>
      <H3>Try it</H3>
      <Ctl>
        <Seg id="chan" label="Show cable run" options={[["all", "All"], ["elevator", "Elevator"], ["aileron", "Aileron"], ["rudder", "Rudder"]]} value={ctrlFocus} onChange={focus} />
        <Slider id="ctlPitch" label="Control wheel (push ↔ pull)" min={-1} max={1} step={0.01} value={s.ctrl.pitch} onChange={(v) => up((d) => { d.ctrl.pitch = v; })} fmt={(v) => dir(v, "Pull · nose up", "Push · nose down", "Neutral")} />
        <Slider id="ctlRoll" label="Control wheel (turn)" min={-1} max={1} step={0.01} value={s.ctrl.roll} onChange={(v) => up((d) => { d.ctrl.roll = v; })} fmt={(v) => dir(v, "Right", "Left", "Neutral")} />
        <Slider id="ctlYaw" label="Rudder pedals" min={-1} max={1} step={0.01} value={s.ctrl.yaw} onChange={(v) => up((d) => { d.ctrl.yaw = v; })} fmt={(v) => dir(v, "Right", "Left", "Neutral")} />
        <Slider id="trim" label="Elevator trim wheel (fwd = nose down)" min={-1} max={1} step={0.01} value={live.kap.trim} onChange={setTrim} fmt={(v) => (Math.abs(v) < 0.03 ? "Takeoff mark" : v > 0 ? `Nose up ${Math.round(v * 100)}%` : `Nose down ${Math.round(-v * 100)}%`)} />
        <Slider id="rtrim" label="Rudder trim wheel (right = nose right)" min={-1} max={1} step={0.01} value={s.ctrl.rudTrim} onChange={(v) => up((d) => { d.ctrl.rudTrim = v; })} fmt={(v) => (Math.abs(v) < 0.03 ? "Takeoff" : v > 0 ? `Nose right ${Math.round(v * 100)}%` : `Nose left ${Math.round(-v * 100)}%`)} />
        <BtnRow>
          <button type="button" className="btn" onClick={() => up((d) => { d.ctrl = { pitch: 0, roll: 0, yaw: 0, rudTrim: d.ctrl.rudTrim }; })}>Center controls</button>
          <button type="button" className="btn" onClick={() => { setTrim(0); up((d) => { d.ctrl.rudTrim = 0; }); }}>Trims to takeoff</button>
        </BtnRow>
        <Readouts items={[
          ["Elevator", `${(-a.elevR * R2D).toFixed(0)}° ${a.elevR < 0 ? "up" : a.elevR > 0 ? "down" : ""}`],
          ["Ailerons R / L", `${(-a.ailR * R2D).toFixed(0)}° / ${(a.ailL * R2D).toFixed(0)}°`],
          ["Rudder", `${(a.rudder * R2D).toFixed(0)}°`],
          ["Trim tab", `${(a.tab * R2D).toFixed(0)}° ${a.tab > 0 ? "TE down" : a.tab < 0 ? "TE up" : ""}`],
          ["Driving", servo ? ["KAP 140 servos", "warnc"] : "Pilot"],
          ["Control lock", s.cabin.lock ? ["INSTALLED", "bad"] : "Removed"],
        ]} />
      </Ctl>
      <Small>In flight the wheel flies the airplane (watch the PFD); with the KAP 140 engaged its servos move the cables, wheels and surfaces instead, and autotrim turns the trim wheel. The rudder trim bungee biases the rudder bars, so the pedals, rudder and nosewheel move with it (bias scale assumed). Aileron readout: + = trailing edge up.</Small>
      {ctrlFocus !== "all" && (
        <>
          <H3>{ctrlFocus[0].toUpperCase() + ctrlFocus.slice(1)} run · {RUNS[ctrlFocus].fig}</H3>
          <ol className="notes">{RUNS[ctrlFocus].steps.map((t) => <li key={t}>{t}</li>)}</ol>
        </>
      )}
      <H3>Mechanisms — tap to locate</H3>
      <PartsList parts={CAT.pinned("controls")} />
      <H3>Travel (TCDS 3A13 — not in the POH)</H3>
      <Facts rows={[["Ailerons", "Up 20° ±2° · down 15° ±2°"], ["Elevator", "Up 28° ±1° · down 21° ±1° (relative to the stabilizer)"], ["Rudder", "24° each way parallel to WL 0 (27°13′ perpendicular to the hinge)"], ["Elevator trim tab", "Up 24° ±2° · down 15° ±1°"], ["Flaps", "0–38° +0/−1°"]]} />
      <H3>Trim</H3>
      <Notes items={["Elevator: forward rotation of the wheel trims nose down, aft nose up. Takeoff: pointer on the index mark on the pedestal cover (POH 7-7, 4-32). The tab moves UP with nose-down trim (S3-22).", "Rudder: rotate the horizontal wheel right for nose right, left for nose left (POH 7-7). Both trims to TAKEOFF before start and takeoff (POH 4-8, 4-17).", "KAP 140 manual electric trim: split DN–UP switches on the outboard side of the left wheel — both halves must move together; one alone does nothing (S3-10, S3-21).", "KOEL: elevator and rudder trim systems and their indicators are required for every kind of operation (POH 2-11)."]} />
      <H3>Pilot notes</H3>
      <Notes items={["Control lock: rod and flag through the pilot's wheel shaft and the panel collar; ailerons neutral, elevators slightly trailing edge down, flag over the ignition switch. In high or gusty winds also fit a lock over the fin and rudder (POH 7-27).", "Landing without elevator control: trim for about 80 KIAS and fly the approach with power; in the flare trim toward full nose up as power is reduced (POH 3-25).", "Steep slips with more than 20° of flap can make the elevator oscillate slightly (POH 4-47)."]} />
    </>
  );
}

export function Flaps() {
  useTicker(150);
  const s = useC182((x) => x.s), E = useC182((x) => x.E), up = useC182((x) => x.update);
  const opts: [FlapCmd, string][] = [[0, "UP"], [10, "10°"], [20, "20°"], [38, "FULL"]];
  return (
    <>
      <p className="lead">Single-slot flaps, electrically driven: one actuator at the inboard end of the right flap turns a bellcrank and push-pull rod, and cables across the cabin top slave the left flap to it. The switch lever on the lower right of the center panel moves in a slotted panel with stops at 10° and 20° — move it right to pass them — and a scale and pointer to its left show the flap position (POH 7-20, Figure 7-3).</p>
      <H3>Wing flap switch lever</H3>
      <Ctl>
        <Seg id="flapSel" label="Lever" options={opts} value={s.flaps.cmd} onChange={(v) => up((d) => { d.flaps.cmd = v; })} />
        <Readouts items={[["Position", live.flapAng.toFixed(1) + "°"], ["Motor", s.flaps.moving ? ["RUNNING", "warnc"] : "Stopped"], ["FLAPS 10 A", E.flapsPwr ? "BUS 1 OK" : ["NO POWER", "bad"]], ["Stall (idle, 0° bank)", `${stallKias(live.flapAng)} KIAS`], ["VFE now", live.flapAng <= 10.5 ? "140 KIAS" : live.flapAng <= 20.5 ? "120 KIAS" : "100 KIAS"]]} />
      </Ctl>
      <Small>Transit at {FLAP_RATE}°/s (≈ 12 s UP to FULL) is an assumption — the POH gives no time or motor details. FULL is 38° per TCDS 3A13; the POH never states it. Stall speeds (power off, 3,100 lb, most rearward CG, Figure 5-4): 50 / 43 / 40 KIAS at UP / 20° / FULL; 10° interpolated.</Small>
      {!E.flapsPwr && <Caution title="No power">The FLAPS breaker or ELECTRICAL BUS 1 is out — the flaps stay where they are.</Caution>}
      {live.kap.ap && live.flapAng > 10.5 && <Caution title="Autopilot limitation">Maximum flap extension with the KAP 140 engaged is 10° (S3-13).</Caution>}
      <H3>Limits</H3>
      <Facts rows={[["VFE UP – 10°", "140 KIAS (dark blue band, detent at 10°)"], ["VFE 10° – 20°", "120 KIAS (light blue, detent at 20°)"], ["VFE 20° – FULL", "100 KIAS (white); white arc 41–100"], ["Takeoff", "UP – 20° (10° preferred); 20° cuts the ground roll and obstacle distance ≈ 20%; more than 20° not approved (POH 4-33)"], ["Balked landing", "Reduce to 20° at once, climb at 55 KIAS, retract slowly above 70 KIAS (POH 4-23)"], ["Flaps-up landing", "Approach 10 KIAS faster and allow 40% more distance (POH 5-36)"], ["Load factor", "+2.0 g flaps down"], ["Breaker", "10 A FLAPS (text: “FLAP”), ELECTRICAL BUS 1, non-pullable"]]} />
      <H3>Mechanism — tap to locate</H3>
      <PartsList parts={CAT.pinned("flaps")} />
      <Caution title="Electrical failure">With LOW VOLTS or HIGH VOLTS, the flap motor is a large load — make sure a landing is possible before extending the flaps (POH 3-16, 3-18).</Caution>
      <Notes items={["Steep slips with flaps more than 20° can give a slight elevator oscillation (POH 4-47).", "With the autopilot engaged, maximum flap extension is 10° (S3-13)."]} />
    </>
  );
}

export function Gear() {
  useTicker(200);
  const s = useC182((x) => x.s), up = useC182((x) => x.update);
  const yaw = Math.max(-1, Math.min(1, live.ctl.yaw + s.ctrl.rudTrim * RUD_TRIM.bias));
  const steer = Math.max(-29, Math.min(29, yaw * 11 + s.gear.diff * 18));
  return (
    <>
      <p className="lead">Fixed tricycle gear: tubular spring-steel main legs and an air/oil nose shock strut that steers through spring-loaded bungees from the rudder bars. Single-disc hydraulic brakes on the mains are worked by toe pressure on the pedals; speed fairings are optional on the 2005 airplanes (POH 7-19, 7-21, 7-46).</p>
      <H3>Try it</H3>
      <Ctl>
        <Slider id="yawG" label="Rudder pedals (steering)" min={-1} max={1} step={0.01} value={s.ctrl.yaw} onChange={(v) => up((d) => { d.ctrl.yaw = v; })} fmt={(v) => dir(v, "Right", "Left", "Neutral")} />
        <Slider id="diff" label="Differential toe brake" min={-1} max={1} step={0.01} value={s.gear.diff} onChange={(v) => up((d) => { d.gear.diff = v; })} fmt={(v) => dir(v, "Right brake", "Left brake", "Even", 0.05)} />
        <Check id="park" label="Parking brake set" checked={s.gear.park} onChange={(v) => up((d) => { d.gear.park = v; })} />
        <Check id="fair" label="Wheel fairings installed" checked={s.gear.fairings} onChange={(v) => up((d) => { d.gear.fairings = v; })} />
        <Readouts items={[["Nosewheel", `${steer.toFixed(0)}°`], ["Steering", Math.abs(steer) > 11 ? "Bungee + brake" : "Bungee"], ["Turning", dir(steer, "Right", "Left", "Straight", 0.5)]]} />
      </Ctl>
      <Small>Pedals alone turn the nosewheel about 11° each side; adding brake takes it up to 29°. Minimum turning radius about 27 ft (POH 7-19). Whether N8050J and N21200 carry the optional fairings (item 32-03-A, ≈ 3 knots) is not in the POH — toggle them here.</Small>
      <H3>Gear — tap to locate</H3>
      <PartsList parts={CAT.pinned("gear")} />
      <H3>Servicing (POH 8-21)</H3>
      <Facts rows={[["Main tires", "6.00-6, 6-ply rated · 42 PSI"], ["Nose tire", "5.00-5, 6-ply rated · 49 PSI"], ["Nose strut", "MIL-H-5606 · 55–60 PSI with no load on the strut"], ["Brake fluid", "MIL-H-5606"], ["Ground attitude", "About 2 in of nose strut showing (POH 1-4)"], ["Wheelbase · track", "66.5 in · 9'-0\""]]} />
      <Caution title="Towing">Never turn the nosewheel more than 29° either side when towing — structural damage can result. Remove any rudder lock before towing (POH 7-19, 8-9).</Caution>
      <Notes items={["Parking brake: set the brakes with the pedals, pull the handle aft and rotate it 90° down. Not in cold weather with moisture, nor with overheated brakes (POH 7-46, 8-9).", "Brake failure signs: fading, noise or drag, soft or spongy pedals, excess travel. Release and reapply hard; pump to rebuild pressure; with one brake gone use the other sparingly with opposite rudder (POH 7-46).", "Jack one main wheel at a time on the step-bracket jack pad — the strut flexes and the wheel slides inboard (POH 8-10)."]} />
    </>
  );
}
