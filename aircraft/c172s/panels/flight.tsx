"use client";
import type { Vec3 } from "@/lib/math";
import type { Chan } from "@/lib/systems";
import { useView } from "@/lib/view";
import { BtnRow, Caution, Check, Ctl, Facts, H3, Notes, PartsList, Readouts, Seg, Slider, Small, useTicker } from "@/components/ui/controls";
import { live, stallKias, type FlapCmd } from "../model";
import { CAT } from "../parts";
import { RIG } from "../rig";
import { useC172 } from "../store";
import { SYS } from "../systems";
import { FLAP_RATE } from "../tick";

const dir = (v: number, pos: string, neg: string, mid: string, dz = 0.02) => (v > dz ? pos : v < -dz ? neg : mid);
const R2D = 180 / Math.PI;

const CHAN_CAM: Record<Chan, [Vec3, Vec3]> = {
  elevator: [[-1.8, 2.6, -10.8], [-0.9, 0.0, 0]],
  aileron: [[-4.0, 10.8, 0.5], [0.6, 0.4, 0]],
  rudder: [[-1.8, 2.6, 10.8], [-0.9, 0.0, 0]],
};

const RUNS: Record<Chan, { fig: string; steps: string[] }> = {
  elevator: { fig: "POH Figure 7-1, Sheet 2", steps: [
    "Pushing or pulling either control wheel slides both columns; the columns are joined behind the panel.",
    "A link from the column interconnect rocks the forward elevator bellcrank under the cabin floor.",
    "Two cables — one for up, one for down — run aft under the floor and through the tailcone over pulley pairs.",
    "They pull the upper or lower arm of the elevator bellcrank on the elevator torque tube, which moves both halves together.",
    "The GFC 700 pitch servo in the tailcone (FS 180.7) acts on the same cables through a bridle and slip clutch.",
  ] },
  aileron: { fig: "POH Figure 7-1, Sheet 1", steps: [
    "Turning either control wheel turns its column; the two columns are interconnected.",
    "The direct cables run down to pulleys in the lower forward cabin, then up the forward door posts to the wing roots.",
    "In each wing the cable runs out to the aileron bellcrank, which drives the aileron through a push-pull rod.",
    "A balance cable joins the two bellcranks across the cabin top — one aileron goes up as the other goes down (Frise-type, up 20° / down 15°).",
    "The GFC 700 roll servo (FS 59.5) drives the aileron system through a bridle cable.",
  ] },
  rudder: { fig: "POH Figure 7-1, Sheet 1", steps: [
    "The interconnected rudder/brake pedals turn the rudder bars.",
    "Two cables run aft along the lower fuselage through fairleads and pulleys to the rudder horn at the bottom of the rudder.",
    "Spring-loaded steering bungees from the rudder bars to the nose gear steer the nosewheel about 10° each side.",
    "There is no rudder trim in the cockpit: only a ground-adjustable tab at the base of the rudder trailing edge.",
    "No yaw servo: the GFC 700 in the 172S is two-axis with pitch trim (no yaw damper in Fig. 7-10).",
  ] },
};

export function Controls() {
  useTicker(150);
  const s = useC172((x) => x.s), up = useC172((x) => x.update);
  const ctrlFocus = useView((x) => x.ctrlFocus), flyTo = useView((x) => x.flyTo);
  const focus = (v: Chan | "all") => {
    useView.getState().set({ ctrlFocus: v });
    const [p, t] = v === "all" ? SYS.find((d) => d.id === "controls")!.cam : CHAN_CAM[v];
    flyTo(p, t);
  };
  const a = RIG.surfaceAngles({ ...live.ctl, trim: live.afcs.trim }, live.flapAng);
  const servo = live.afcs.ap && !live.afcs.cws;
  const setTrim = (v: number) => { live.afcs = { ...live.afcs, trim: v }; };
  return (
    <>
      <p className="lead">Conventional ailerons, elevator and rudder are moved through cables and mechanical linkage: control wheels for the ailerons and elevator, rudder/brake pedals for the rudder. Elevator trim is a tab on the right elevator, set by a vertical wheel on the pedestal — or by the GFC 700 trim servo on the same cable (POH 7-7).</p>
      <H3>Try it</H3>
      <Ctl>
        <Seg id="chan" label="Show cable run" options={[["all", "All"], ["elevator", "Elevator"], ["aileron", "Aileron"], ["rudder", "Rudder"]]} value={ctrlFocus} onChange={focus} />
        <Slider id="ctlPitch" label="Control wheel (push ↔ pull)" min={-1} max={1} step={0.01} value={s.ctrl.pitch} onChange={(v) => up((d) => { d.ctrl.pitch = v; })} fmt={(v) => dir(v, "Pull · nose up", "Push · nose down", "Neutral")} />
        <Slider id="ctlRoll" label="Control wheel (turn)" min={-1} max={1} step={0.01} value={s.ctrl.roll} onChange={(v) => up((d) => { d.ctrl.roll = v; })} fmt={(v) => dir(v, "Right", "Left", "Neutral")} />
        <Slider id="ctlYaw" label="Rudder pedals" min={-1} max={1} step={0.01} value={s.ctrl.yaw} onChange={(v) => up((d) => { d.ctrl.yaw = v; })} fmt={(v) => dir(v, "Right", "Left", "Neutral")} />
        <Slider id="trim" label="Elevator trim wheel (fwd = nose down)" min={-1} max={1} step={0.01} value={live.afcs.trim} onChange={setTrim} fmt={(v) => (Math.abs(v) < 0.03 ? "Takeoff mark" : v > 0 ? `Nose up ${Math.round(v * 100)}%` : `Nose down ${Math.round(-v * 100)}%`)} />
        <BtnRow>
          <button type="button" className="btn" onClick={() => up((d) => { d.ctrl = { pitch: 0, roll: 0, yaw: 0 }; })}>Center controls</button>
          <button type="button" className="btn" onClick={() => setTrim(0)}>Trim to takeoff</button>
        </BtnRow>
        <Readouts items={[
          ["Elevator", `${(-a.elevR * R2D).toFixed(0)}° ${a.elevR < 0 ? "up" : a.elevR > 0 ? "down" : ""}`],
          ["Ailerons R / L", `${(-a.ailR * R2D).toFixed(0)}° / ${(a.ailL * R2D).toFixed(0)}°`],
          ["Rudder", `${(a.rudder * R2D).toFixed(0)}°`],
          ["Trim tab", `${(a.tab * R2D).toFixed(0)}° ${a.tab > 0 ? "TE down" : a.tab < 0 ? "TE up" : ""}`],
          ["Driving", servo ? ["GFC 700 servos", "warnc"] : "Pilot"],
          ["Control lock", s.cabin.lock ? ["INSTALLED", "bad"] : "Removed"],
        ]} />
      </Ctl>
      <Small>In flight the wheel flies the airplane (watch the PFD); with the autopilot engaged the servos move the cables, wheels and surfaces instead, and autotrim turns the trim wheel. Aileron readout: + = trailing edge up.</Small>
      {ctrlFocus !== "all" && (
        <>
          <H3>{ctrlFocus[0].toUpperCase() + ctrlFocus.slice(1)} run · {RUNS[ctrlFocus].fig}</H3>
          <ol className="notes">{RUNS[ctrlFocus].steps.map((t) => <li key={t}>{t}</li>)}</ol>
        </>
      )}
      <H3>Mechanisms — tap to locate</H3>
      <PartsList parts={CAT.pinned("controls")} />
      <H3>Travel (TCDS 3A12 — not in the POH)</H3>
      <Facts rows={[["Ailerons", "Up 20° ±1° · down 15° ±1°"], ["Elevator", "Up 28° +1/−0 · down 23° +1/−0"], ["Rudder", "16°10′ ±1° each way (parallel to WL)"], ["Elevator trim tab", "Up 22° · down 19°"], ["Flaps", "0–30° (landing), 0–10° takeoff"]]} />
      <H3>Trim</H3>
      <Notes items={["Forward rotation of the trim wheel trims nose down; aft rotation nose up. Takeoff: pointer on the index mark (POH 7-7, 4-31).", "GFC 700 manual electric trim (MET, split switch on the pilot's wheel) and autotrim run the trim servo; electric trim max 163 KIAS (POH 2-21).", "Rudder trim: ground-adjustable tab only. No cockpit aileron trim."]} />
      <H3>Pilot notes</H3>
      <Notes items={["Control lock: rod and flag through the pilot's column; locks ailerons and elevator; the flag covers the ignition switch. In gusty winds also fit a lock over the fin and rudder (POH 7-28).", "Before takeoff: engage the AP and verify it can be overpowered in pitch and roll, then press A/P TRIM DISC and confirm the disconnect tone (POH 4-16).", "Landing without elevator control: trim for ~65 KIAS with 20° flaps and fly the approach with power and trim (POH 3-28)."]} />
    </>
  );
}

export function Flaps() {
  useTicker(150);
  const s = useC172((x) => x.s), E = useC172((x) => x.E), up = useC172((x) => x.update);
  const opts: [FlapCmd, string][] = [[0, "UP"], [10, "10°"], [20, "20°"], [30, "FULL"]];
  return (
    <>
      <p className="lead">Single-slot flaps run on tracks and rollers, aft and down, driven by an electric motor. The flap lever on the lower right of the center panel has mechanical stops at 10° and 20° — move it right to pass them — and a scale and pointer to its left show the actual flap position (POH 7-23).</p>
      <H3>Wing flap control lever</H3>
      <Ctl>
        <Seg id="flapSel" label="Lever" options={opts} value={s.flaps.cmd} onChange={(v) => up((d) => { d.flaps.cmd = v; })} />
        <Readouts items={[["Position", live.flapAng.toFixed(1) + "°"], ["Motor", s.flaps.moving ? ["RUNNING", "warnc"] : "Stopped"], ["FLAPS 10 A", E.flapsPwr ? "BUS 1 OK" : ["NO POWER", "bad"]], ["Stall (idle, 0° bank)", `${stallKias(live.flapAng)} KIAS`]]} />
      </Ctl>
      <Small>Transit at {FLAP_RATE}°/s is an assumption — the POH gives no time. While the motor runs it draws a large current from ELECTRICAL BUS 1 (see Electrical). Fig. 5-3 gives stall speeds for UP, 10° and FULL only; 20° is interpolated.</Small>
      {!E.flapsPwr && <Caution title="No power">The FLAPS breaker or ELECTRICAL BUS 1 is out — the flaps stay where they are.</Caution>}
      <H3>Limits</H3>
      <Facts rows={[["VFE 10°", "110 KIAS (placard: blue band UP–10°)"], ["VFE 10° – FULL", "85 KIAS (white band); white arc 40–85"], ["Takeoff", "UP – 10° only (10° shortens the ground roll ~10%)"], ["Balked landing", "Retract to 20°, climb at 60 KIAS, then 10° and UP"], ["Load factor", "+3.0 g flaps FULL"], ["Breaker", "10 A FLAPS (text: “FLAP”), ELECTRICAL BUS 1, non-pullable"]]} />
      <H3>Mechanism — tap to locate</H3>
      <PartsList parts={CAT.pinned("flaps")} />
      <Caution title="Icing">Leave the flaps retracted with ice on the tail: the changed wing downwash can cost elevator effectiveness (POH 3-14).</Caution>
      <Notes items={["Steep slips with more than 20° of flap can make the elevator oscillate slightly (POH 4-43).", "Intentional spins with flaps extended are prohibited (POH 4-42).", "With LOW or HIGH VOLTS, make sure a landing is possible before extending the flaps — the motor is a large load (POH 3-18)."]} />
    </>
  );
}

export function Gear() {
  useTicker(200);
  const s = useC172((x) => x.s), up = useC172((x) => x.update);
  const steer = Math.max(-30, Math.min(30, live.ctl.yaw * 10 + s.gear.diff * 20));
  return (
    <>
      <p className="lead">Fixed tricycle gear: tubular spring-steel main legs with speed fairings, and an air/oil nose strut that steers through spring-loaded bungees from the rudder bars. Single-disc hydraulic brakes on the mains are worked by toe pressure on the pedals (POH 7-22, 7-23, 7-46).</p>
      <H3>Try it</H3>
      <Ctl>
        <Slider id="yawG" label="Rudder pedals (steering)" min={-1} max={1} step={0.01} value={s.ctrl.yaw} onChange={(v) => up((d) => { d.ctrl.yaw = v; })} fmt={(v) => dir(v, "Right", "Left", "Neutral")} />
        <Slider id="diff" label="Differential toe brake" min={-1} max={1} step={0.01} value={s.gear.diff} onChange={(v) => up((d) => { d.gear.diff = v; })} fmt={(v) => dir(v, "Right brake", "Left brake", "Even", 0.05)} />
        <Check id="park" label="Parking brake set" checked={s.gear.park} onChange={(v) => up((d) => { d.gear.park = v; })} />
        <Readouts items={[["Nosewheel", `${steer.toFixed(0)}°`], ["Steering", Math.abs(steer) > 10 ? "Bungee + brake" : "Bungee"], ["Turning", dir(steer, "Right", "Left", "Straight", 0.5)]]} />
      </Ctl>
      <Small>Pedals alone turn the nosewheel about 10° each side; adding brake takes it up to 30°. Minimum turning radius about 27 ft (POH 7-22).</Small>
      <H3>Gear — tap to locate</H3>
      <PartsList parts={CAT.pinned("gear")} />
      <H3>Servicing</H3>
      <Facts rows={[["Main tires", "6.00 × 6, 6-ply · 42 PSI"], ["Nose tire", "5.00 × 5, 6-ply · 45 PSI"], ["Nose strut", "MIL-H-5606, 45 PSI with no load"], ["Brake fluid", "MIL-H-5606"], ["Fairings", "Standard, removable (KOEL); ~2 kt"], ["Wheelbase", "65.0 in"]]} />
      <Caution title="Towing">Never turn the nosewheel more than 30° either side when towing, and remove any rudder lock first (POH 7-22, 8-9).</Caution>
      <Notes items={["Parking brake: set the brakes with the pedals, pull the handle aft and rotate it 90° down. Don't set it in freezing moisture or with hot brakes (POH 7-46, 8-9).", "Brake failure signs: fading, noise or drag, soft/spongy pedals, excess travel. Release and reapply hard; pump to rebuild pressure; with one brake gone use the other sparingly with opposite rudder (POH 7-46).", "Flat main tire: land on the good tire first and hold the flat one off with aileron (POH 3-16)."]} />
    </>
  );
}
