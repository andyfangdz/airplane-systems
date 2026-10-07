"use client";
import type { Vec3 } from "@/lib/math";
import type { Chan } from "@/lib/systems";
import { useView } from "@/lib/view";
import {
  BtnRow,
  Caution,
  Check,
  Ctl,
  Facts,
  H3,
  HoldButton,
  Notes,
  PartsList,
  Readouts,
  Seg,
  Slider,
  Small,
  useTicker,
} from "@/components/ui/controls";
import {
  FLAP_MAX,
  FLAP_TO,
  TO_TRIM,
  gearDown,
  gearHorn,
  gearLights,
  gearUp,
  live,
  mph,
  pcEngaged,
  stallMph,
  type FlapValve,
  type GearLever,
} from "../model";
import { CAT } from "../parts";
import { deflections } from "../rig";
import { pumpFlaps, useM20C } from "../store";
import { SYS } from "../systems";

const dir = (v: number, pos: string, neg: string, mid: string, dz = 0.02) => (v > dz ? pos : v < -dz ? neg : mid);

const CHAN_CAM: Record<Chan, [Vec3, Vec3]> = {
  elevator: [
    [-1.2, 2.0, -8.8],
    [-0.8, -0.3, 0],
  ],
  aileron: [
    [-2.0, 9.6, 0.5],
    [0.4, -0.45, 0],
  ],
  rudder: [
    [-1.4, 2.2, 8.8],
    [-0.8, -0.35, 0],
  ],
};

const RUNS: Record<Chan, { src: string; steps: string[] }> = {
  elevator: {
    src: "OM p. 8–9; routing inferred from the service-manual arrangement",
    steps: [
      "Push or pull either control wheel: the shafts slide through the panel and turn a torque tube under it.",
      "A lever on the torque tube drives a push-pull tube aft under the floor and through the tail cone (the long tubes in the tail are larger in diameter so they cannot buckle).",
      "At the tail-cone bulkhead, ahead of the empennage pivot, a bellcrank turns the run into a short rod to the elevator horn.",
      "Elevator up 24°, down 10½° (TCDS). Trim bungees on the elevator horns are re-set by the stabilizer trim, so trim assist comes from the elevator too (OM p. 9).",
    ],
  },
  aileron: {
    src: "OM p. 8; bellcrank positions inferred",
    steps: [
      "Turning the wheel drives a link to a bellcrank under the floor, then a fore-aft tube to the centre bellcrank at the main-spar carry-through.",
      "Spanwise push-pull tubes run outboard behind the main spar through lubricated guide blocks to a bellcrank in each wing.",
      "A short rod with self-aligning rod-end bearings drives the aileron horn (OM p. 8). The PC roll servos act on this run.",
      "Differential: up 12½–17°, down 8° (TCDS) — less adverse yaw. Bevelled trailing edges lighten the force. A spring-loaded interconnect ties the aileron and rudder runs where they cross under the floor.",
    ],
  },
  rudder: {
    src: "OM p. 8, 15; Ranger 2-12",
    steps: [
      "The pedals turn a torque tube whose lever drives a push-pull tube aft down the right side of the floor and through the tail cone.",
      "A bellcrank at the tail-cone bulkhead drives the rudder horn; the PC rudder servos act on this run.",
      "Steering rods from the same pedal lever turn the nose wheel; retraction disconnects the steering and centres the wheel.",
      "Rudder 23–24° each way (TCDS). On the ground the travel is limited by the steering linkage (OM p. 15).",
    ],
  },
};

export function Controls() {
  useTicker(150);
  const s = useM20C((x) => x.s),
    up = useM20C((x) => x.update);
  const ctrlFocus = useView((x) => x.ctrlFocus),
    flyTo = useView((x) => x.flyTo);
  const focus = (v: Chan | "all") => {
    useView.getState().set({ ctrlFocus: v });
    const [p, t] = v === "all" ? SYS.find((d) => d.id === "controls")!.cam : CHAN_CAM[v];
    flyTo(p, t);
  };
  const e = live.eff,
    d = deflections(e.pitch, e.roll, e.yaw),
    trim = s.ctrl.trim;
  const pc = pcEngaged(s);
  return (
    <>
      <p className="lead">
        Dual control wheels on shafts through the panel. Ailerons, elevator and rudder are all moved by push-pull tubes
        with self-aligning rod-end bearings — no cables — which is why the controls feel direct and a little heavy.
        Pitch trim moves the whole tail: the trim wheel on the floor between the seats turns a torque tube to a jack
        screw at the tail-cone bulkhead, and the stabilizer, fin and all pivot together.
      </p>
      <H3>Try it</H3>
      <Ctl>
        <Seg
          id="chan"
          label="Show control run"
          options={[
            ["all", "All"],
            ["elevator", "Elevator"],
            ["aileron", "Aileron"],
            ["rudder", "Rudder"],
          ]}
          value={ctrlFocus}
          onChange={focus}
        />
        <Slider
          id="ctlPitch"
          label="Control wheel (push ↔ pull)"
          min={-1}
          max={1}
          step={0.01}
          value={s.ctrl.pitch}
          onChange={(v) =>
            up((x) => {
              x.ctrl.pitch = v;
            })
          }
          fmt={(v) => dir(v, "Nose up", "Nose down", "Neutral")}
        />
        <Slider
          id="ctlRoll"
          label="Control wheel (turn)"
          min={-1}
          max={1}
          step={0.01}
          value={s.ctrl.roll}
          onChange={(v) =>
            up((x) => {
              x.ctrl.roll = v;
            })
          }
          fmt={(v) => dir(v, "Right", "Left", "Neutral")}
        />
        <Slider
          id="ctlYaw"
          label="Rudder pedals"
          min={-1}
          max={1}
          step={0.01}
          value={s.ctrl.yaw}
          onChange={(v) =>
            up((x) => {
              x.ctrl.yaw = v;
            })
          }
          fmt={(v) => dir(v, "Right", "Left", "Neutral")}
        />
        <Slider
          id="trimW"
          label="Trim wheel (forward = nose down)"
          min={-1}
          max={1}
          step={0.01}
          value={trim}
          onChange={(v) =>
            up((x) => {
              x.ctrl.trim = v;
            })
          }
          fmt={(v) =>
            Math.abs(v - TO_TRIM) < 0.015
              ? "Take-off mark"
              : dir(v, `Nose up ${Math.round(v * 100)}%`, `Nose down ${Math.round(-v * 100)}%`, "Neutral")
          }
        />
        <BtnRow>
          <button
            type="button"
            className="btn"
            onClick={() =>
              up((x) => {
                x.ctrl = { ...x.ctrl, pitch: 0, roll: 0, yaw: 0 };
              })
            }
          >
            Center controls
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              up((x) => {
                x.ctrl.trim = TO_TRIM;
              })
            }
          >
            Trim to take-off
          </button>
        </BtnRow>
        <Readouts
          items={[
            [
              "Elevator",
              d.elev > 0.3 ? `${d.elev.toFixed(0)}° up` : d.elev < -0.3 ? `${(-d.elev).toFixed(0)}° down` : "0°",
            ],
            ["L / R aileron", `${fmtAil(d.ailL)} / ${fmtAil(d.ailR)}`],
            ["Rudder", d.rud > 0.3 ? `${d.rud.toFixed(0)}° R` : d.rud < -0.3 ? `${(-d.rud).toFixed(0)}° L` : "0°"],
            [
              "Stabilizer",
              trim > 0.02
                ? `LE down ${(trim * 4.5).toFixed(1)}° (nose up)`
                : trim < -0.02
                  ? `LE up ${(-trim * 2).toFixed(1)}° (nose down)`
                  : "neutral",
            ],
            ["PC", pc ? ["LEVELING WINGS", "warnc"] : s.pc.cutoff ? "Cut off (button held)" : "Off — no vacuum"],
          ]}
        />
      </Ctl>
      {pc && (
        <Caution title="Positive Control is on">
          The PC servos are adding aileron and rudder to level the wings, so the surfaces do not quite follow your
          input. Hold the cut-off button in the left grip (Positive Control panel) to manoeuvre freely, or just
          overpower it.
        </Caution>
      )}
      {ctrlFocus !== "all" && (
        <>
          <H3>
            {ctrlFocus[0].toUpperCase() + ctrlFocus.slice(1)} run · {RUNS[ctrlFocus].src}
          </H3>
          <ol className="notes">
            {RUNS[ctrlFocus].steps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        </>
      )}
      <H3>Mechanisms &amp; details — tap to locate</H3>
      <PartsList parts={CAT.pinned("controls")} />
      <H3>Details (TCDS 2A3, s/n before 690001)</H3>
      <Facts
        rows={[
          ["Ailerons", "Up 12½–17° · down 8° · 0–2° droop; bevelled trailing edges, gap strips"],
          ["Elevator", "Up 24° · down 10½°; trim-assist bungees set 19° up at 3½° negative stabilizer"],
          ["Rudder", "23–24° each way; spring interconnect to the ailerons"],
          ["Stabilizer (trim)", "Leading edge up 1–2½° (nose down) · down ≈ 4½° (nose up)"],
          [
            "Trim wheel",
            "Floor, between the front seats; friction screw on the pilot's side; forward = nose down (OM p. 9; Ranger 2-10)",
          ],
          [
            "Trim indicator",
            "Pointer on the aft side of the nose-wheel well, shared with the flap pointer; middle mark = take-off (OM p. 9)",
          ],
          ["VA", "132 mph — full abrupt control travel without exceeding the load factor (OM p. 38)"],
          ["Gust lock", "None fitted: lock the controls with the co-pilot's seat belt through the wheel (Ranger 7-4)"],
        ]}
      />
      <H3>Pilot notes</H3>
      <Notes
        items={[
          "Flaps make the airplane nose heavy: roll the trim well back for the landing so it glides hands-off at about 80 mph (OM p. 23–24).",
          "Trim is heavier than a tab system because the whole tail moves; a stiff wheel points to the jack screw, chain or gearbox.",
          "After take-off the nose wants to rock up as the nose wheel leaves — relax the back pressure (OM p. 19).",
          "Control-wheel shafts have a recurring dye-penetrant inspection (AD 77-17-04); aileron guide blocks are an SB item (M20-264).",
        ]}
      />
    </>
  );
}
const fmtAil = (up: number) => (up > 0.3 ? `${up.toFixed(0)}° up` : up < -0.3 ? `${(-up).toFixed(0)}° dn` : "0°");

export function Flaps() {
  useTicker(150);
  const s = useM20C((x) => x.s),
    up = useM20C((x) => x.update);
  const a = live.flapAng,
    vfe = 125,
    ias = s.air ? mph(live.fs.ias) : 0;
  return (
    <>
      <p className="lead">
        Wide-span flaps lowered by a hydraulic hand-pump lever that lies aft between the seats just right of the gear
        bar, pivoted under the panel and pumped up and down. Set the flap-shaped control to DOWN and pump: two strokes
        for take-off, four and a half for full flap. To raise them, move the control to UP and a relief valve lets the
        springs and the air load bleed them up at a controlled rate; put it back to DOWN to stop part way. The fluid
        comes from the brake reservoir on the firewall.
      </p>
      <H3>Flap pump lever (beside the Johnson bar)</H3>
      <Ctl>
        <Seg<FlapValve>
          id="flapValve"
          label="Flap control"
          options={[
            ["DOWN", "DOWN — pump & hold"],
            ["UP", "UP — release"],
          ]}
          value={s.flaps.valve}
          onChange={(v) =>
            up((d) => {
              d.flaps.valve = v;
            })
          }
        />
        <BtnRow>
          <HoldButton className="btn primary" onDown={pumpFlaps} disabled={s.flaps.valve !== "DOWN"}>
            Pump one stroke
          </HoldButton>
          <button
            type="button"
            className="btn"
            onClick={() => {
              up((d) => {
                d.flaps.valve = "DOWN";
              });
              pumpFlaps();
              pumpFlaps();
            }}
          >
            Two strokes (take-off)
          </button>
        </BtnRow>
        <Readouts
          items={[
            ["Flap angle", a.toFixed(1) + "°"],
            [
              "Setting",
              a < 1
                ? "UP"
                : Math.abs(a - FLAP_TO) < 4
                  ? "TAKE-OFF (15°)"
                  : a > FLAP_MAX - 1
                    ? "FULL (33°)"
                    : "Intermediate",
            ],
            ["Moving", s.flaps.valve === "UP" && a > 0 ? "Bleeding up" : live.pumpAnim > 0 ? "Pumping" : "Holding"],
            ["Airspeed", [`${ias.toFixed(0)} mph`, s.air && a > 1 && ias > vfe ? "bad" : ""]],
          ]}
        />
      </Ctl>
      <Small>
        Each stroke is a quarter of take-off flap plus a bit (33° ÷ 4½ strokes, OM p. 9). The pointer on the aft side of
        the nose-wheel well shows the position; the middle mark is take-off.
      </Small>
      {s.air && a > 1 && ias > vfe && (
        <Caution title="Above VFE">
          Flap operating range 63–125 mph for the 1968 airplane (TCDS 2A3; 100 mph on 1967 and earlier). Overspeeding
          the hydraulic flaps overloads the system and starts leaks.
        </Caution>
      )}
      <H3>Details</H3>
      <Facts
        rows={[
          ["Positions", "Take-off 15° ± 1° · landing 33° +0/−2° (TCDS)"],
          ["Strokes", "2 for take-off · 4½ for full (OM p. 9)"],
          ["VFE / white arc", "125 mph · 63–125 (1968); 100 mph · 63–100 (1967)"],
          [
            "Stall speeds (2,575 lb)",
            `Flaps up ${stallMph(0)} · 15° ${stallMph(15)} · 33° ${stallMph(33)} mph IAS (OM Fig. 4)`,
          ],
          ["Load factor", "+2.0 g with flaps down"],
          ["Fluid", "MIL-H-5606 (red), shared with the brakes; reservoir on the top aft side of the firewall"],
          ["Retract rate", "Set by a needle valve bleeding fluid back to the reservoir"],
          ["Electric flaps", "Introduced with the 1969 model year"],
        ]}
      />
      <H3>Pilot notes</H3>
      <Notes
        items={[
          "Use full flaps for every landing for the visibility over the nose — and trim well back, the airplane goes nose heavy as they come down (OM p. 24).",
          "Retract the flaps after landing (TCDS placard). Don't park with the flaps down: sun-heated fluid expands and can damage the system.",
          "Flaps that pump down but creep up: a leaking flap valve or a release cable that doesn't seat the valve.",
          "Go-around: full power, then lift the release and let the flaps bleed up while you trim forward — expect a pitch-up.",
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("flaps")} />
    </>
  );
}

export function Gear() {
  useTicker(150);
  const s = useM20C((x) => x.s),
    E = useM20C((x) => x.E),
    up = useM20C((x) => x.update);
  const g = s.gear,
    lights = gearLights(s, E),
    horn = gearHorn(s, E),
    ias = s.air ? mph(live.fs.ias) : 0;
  const moving = !gearDown() && !gearUp();
  const setLever = (v: GearLever) =>
    up((d) => {
      d.gear.lever = v;
      d.gear.latch = false;
    });
  return (
    <>
      <p className="lead">
        The Mooney's famous manual gear: a steel bar between the seats, linked directly to the three legs by a torque
        tube and push-pull rods, balanced by bungees in the fuselage and springs in the wings. Gear down, the handle
        locks in a socket under the panel; press the thumb latch, swing it rapidly down to the floor and it latches in
        the up socket. Rubber discs — not oleos — take the shocks. There is no emergency extension system, because the
        whole thing already is one.
      </p>
      <H3>Johnson bar</H3>
      <Ctl>
        <BtnRow>
          <HoldButton
            className={"btn" + (g.latch ? " primary" : "")}
            onDown={() =>
              up((d) => {
                d.gear.latch = true;
              })
            }
            onUp={() =>
              up((d) => {
                d.gear.latch = false;
              })
            }
            pressed={g.latch}
          >
            Hold the thumb latch
          </HoldButton>
          <button type="button" className="btn" disabled={g.lever === "UP" || !g.latch} onClick={() => setLever("UP")}>
            Swing to the floor — GEAR UP
          </button>
          <button type="button" className="btn" disabled={g.lever === "DOWN"} onClick={() => setLever("DOWN")}>
            Swing to the panel — GEAR DOWN
          </button>
        </BtnRow>
        <Slider
          id="thr"
          label="Throttle"
          min={0}
          max={1}
          step={0.01}
          value={s.eng.throttle}
          onChange={(v) =>
            up((d) => {
              d.eng.throttle = v;
            })
          }
          fmt={(v) => (v < 0.02 ? "CLOSED" : Math.round(v * 100) + "%")}
        />
        <div className="lights3">
          <span>
            <i className={lights.green ? "g" : ""} />
            GEAR DOWN
          </span>
          <span>
            <i style={lights.red ? { background: "#FF2A2A", boxShadow: "0 0 6px #FF2A2A" } : undefined} />
            UNSAFE
          </span>
        </div>
        <Readouts
          items={[
            ["Handle", g.lever === "DOWN" ? "Down-lock socket" : "Up-lock socket (floor)"],
            ["Gear", moving ? ["IN TRANSIT", "warnc"] : gearDown() ? "DOWN & LOCKED" : ["UP", "warnc"]],
            ["Horn", horn ? ["SOUNDING", "bad"] : "Quiet"],
            ["Man press", live.map.toFixed(1) + " in"],
            ["Airspeed", [`${ias.toFixed(0)} mph`, s.air && ias > 120 && (moving || g.lever === "DOWN") ? "bad" : ""]],
          ]}
        />
      </Ctl>
      <Small>
        Retraction needs the latch pressed first (OM p. 6). The handle swings in about a second; the real bar is easiest
        at low airspeed and in one quick motion — never slow down or pitch up to make it easier. The horn sounds
        whenever the throttle is retarded to about 10 in Hg with the gear not down and locked (OM p. 27).
      </Small>
      {s.air && ias > 120 && (moving || g.lever === "DOWN") && (
        <Caution title="Above 120 mph">
          Maximum gear operating and gear extended speed is 120 mph (OM p. 38; TCDS placard).
        </Caution>
      )}
      <H3>Brakes &amp; steering</H3>
      <Ctl>
        <Slider
          id="diff"
          label="Toe brakes (differential)"
          min={-1}
          max={1}
          step={0.01}
          value={g.diff}
          onChange={(v) =>
            up((d) => {
              d.gear.diff = v;
            })
          }
          fmt={(v) => dir(v, "Right brake", "Left brake", "Released", 0.05)}
        />
        <Check
          id="park"
          label="Parking brake lock valve pulled (set)"
          checked={g.park}
          onChange={(v) =>
            up((d) => {
              d.gear.park = v;
            })
          }
        />
        <Readouts
          items={[
            ["Nose wheel", gearDown() ? "Steered by the pedals" : "Centred, disconnected"],
            ["Parking brake", g.park ? ["SET", "warnc"] : "Released"],
          ]}
        />
      </Ctl>
      <Small>
        To park: press the toe pedals and pull the lock valve on the panel right of the control column (OM p. 10). Don't
        leave it set with hot brakes or in the sun — trapped fluid expands (Ranger 2-12). Co-pilot brakes were optional.
      </Small>
      <H3>Checks before landing (OM p. 6, 23)</H3>
      <ol className="notes">
        {[
          "Thumb-lock check: pull down on the handle without pressing the latch — it must not move.",
          "Green GEAR DOWN light on (swap the bulbs in flight if the green one fails).",
          "Retard the throttle: no horn means down and locked.",
          "Lower at 120 mph or less; base leg 90 mph, final about 80.",
        ].map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <H3>Details</H3>
      <Facts
        rows={[
          ["Main wheels", "Cleveland 6.00 × 6, 6-ply, 30 psi"],
          ["Nose wheel", "5.00 × 5, 4-ply, 30 psi; steered by the pedals"],
          [
            "Shock absorption",
            "Stacked rubber discs (Lord); they sag with age — about 12 years — and lower the prop clearance",
          ],
          [
            "Retraction",
            "Direct mechanical linkage; mains inboard into the wing, nose aft; 588 in-lb retraction moment (TCDS)",
          ],
          ["Assist", "Bungee springs in the fuselage, assist springs in the wings (OM p. 6)"],
          [
            "Lights",
            "Green: handle properly engaged down. Red: handle not sufficiently engaged — unsafe to land (OM p. 6)",
          ],
          ["Horn", "Mallory SC 628 P (TCDS), throttle microswitch at about 10 in Hg"],
          ["Down-lock block", "Wears oval; a 50-hour engagement check is an airworthiness item in some states"],
          ["Brakes", "Cleveland discs, pilot's toe pedals; parking lock valve"],
          [
            "Electric gear",
            "Optional from the mid-1960s, standard 1969; its floor window and hand crank are not on this airplane",
          ],
        ]}
      />
      <H3>Gotchas</H3>
      <Notes
        items={[
          "Gear-up landings and unlatched bars are the type's classic accidents. One pilot who found retraction hard slowed and pitched up to help; the airplane stalled at 150 ft (NTSB ERA19FA022, M20C s/n 670003).",
          "A bar left unlatched in the up socket can fly down with great force at speed.",
          "An unusual force while retracting: return the lever to down and locked and have the gear checked after landing (OM p. 27).",
          "Keep the gear free of mud and ice; lubricate the rod ends and swing the gear every 100 h (OM p. 27).",
          "Nose-wheel shimmy comes from worn torque-link bushings and bearing preload; a dent in the steering-stop tube from over-towing grounds the truss.",
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("gear")} />
    </>
  );
}
