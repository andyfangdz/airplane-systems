"use client";
import {
  Caution,
  Check,
  Ctl,
  Facts,
  H3,
  HoldButton,
  Notes,
  PartsList,
  Readouts,
  Slider,
  Small,
  useTicker,
} from "@/components/ui/controls";
import { live, pcAvailable, pcEngaged } from "../model";
import { CAT } from "../parts";
import { useM20C } from "../store";

const dir = (v: number, pos: string, neg: string, mid: string, dz = 0.02) => (v > dz ? pos : v < -dz ? neg : mid);

export function PositiveControl() {
  useTicker(150);
  const s = useM20C((x) => x.s),
    up = useM20C((x) => x.update);
  const avail = pcAvailable(s),
    on = pcEngaged(s),
    fs = live.fs;
  return (
    <>
      <p className="lead">
        Mooney Positive Control, built by Brittain Industries and standard on every M20C from 1965: a two-axis pneumatic
        wing leveler that is on whenever the engine (or a windmilling propeller above about 1,000 RPM) makes vacuum. The
        electro-vacuum turn coordinator senses the roll and sends suction to rubber-diaphragm servo cans on the aileron
        and rudder linkages, which pull the airplane back to wings level. Hold the cut-off button in the left grip to
        manoeuvre; let go and it levels the wings again. It needs no electricity and can be overpowered by hand at any
        time.
      </p>
      <H3>Try it</H3>
      <Ctl>
        <HoldButton
          className={"btn" + (s.pc.cutoff ? " primary" : "")}
          onDown={() =>
            up((d) => {
              d.pc.cutoff = true;
            })
          }
          onUp={() =>
            up((d) => {
              d.pc.cutoff = false;
            })
          }
          pressed={s.pc.cutoff}
        >
          Hold the PC cut-off button (left grip)
        </HoldButton>
        <Slider
          id="rollTrim"
          label="Roll trim knob (on the turn coordinator)"
          min={-1}
          max={1}
          step={0.01}
          value={s.pc.rollTrim}
          onChange={(v) =>
            up((d) => {
              d.pc.rollTrim = v;
            })
          }
          fmt={(v) => dir(v, "Right", "Left", "Centred")}
        />
        <Slider
          id="pcRoll"
          label="Your aileron input"
          min={-1}
          max={1}
          step={0.01}
          value={s.ctrl.roll}
          onChange={(v) =>
            up((d) => {
              d.ctrl.roll = v;
            })
          }
          fmt={(v) => dir(v, "Right", "Left", "Neutral")}
        />
        <Check
          id="vacFail"
          label="Vacuum pump fails"
          checked={s.eng.fail.vacPump}
          onChange={(v) =>
            up((d) => {
              d.eng.fail.vacPump = v;
            })
          }
        />
        <Readouts
          items={[
            ["PC", on ? "LEVELING" : s.pc.cutoff ? ["CUT OFF", "warnc"] : ["INOPERATIVE", "bad"]],
            ["Vacuum", [live.vac.toFixed(1) + " in Hg", avail ? "" : "bad"]],
            [
              "Bank",
              s.air
                ? `${Math.abs(fs.roll).toFixed(0)}° ${fs.roll > 0.5 ? "R" : fs.roll < -0.5 ? "L" : ""}`
                : "On the ground",
            ],
            ["Servo (roll)", on ? dir(live.pcRoll, "Pulling right", "Pulling left", "Idle", 0.02) : "—"],
            ["Servo (yaw)", on ? dir(live.pcYaw, "Right rudder", "Left rudder", "Idle", 0.02) : "—"],
          ]}
        />
      </Ctl>
      <Small>
        Set some aileron and watch the servos fight it — then hold the button and the wings go where you put them. Roll
        the trim knob clockwise and the airplane holds a shallow right bank, the way you would trim out an asymmetric
        load (OM p. 8; Ranger 4-9). Illustrative servo authority.
      </Small>
      {!avail && s.air && (
        <Caution title="PC inoperative">
          With the vacuum gone (red light on the artificial horizon) the PC system is automatically inoperative — and so
          are the artificial horizon and the directional gyro (OM p. 8, 10). The turn coordinator still works on
          electric power.
        </Caution>
      )}
      <H3>How it works (OM p. 8; Ranger 2-9; Brittain service notes)</H3>
      <ol className="notes">
        {[
          "The engine-driven vacuum pump supplies the suction, so PC runs from engine start to shutdown — and keeps working after an engine failure as long as the propeller windmills above about 1,000 RPM.",
          "The turn coordinator (electric gyro, vacuum pick-off) senses roll and yaw and meters suction to the servos through a pilot valve behind the panel.",
          "Four Brittain BI-706 servo cans — 4½ in rubber-cupped diaphragms — one in the outer third of each wing on the aileron linkage and two in the tail cone on the rudder linkage, pull the controls toward wings level.",
          "The cut-off valve in the pilot's left wheel grip vents the servos while it is held; released, the airplane returns to straight and level from any attitude.",
          "The roll-trim knob on the turn coordinator biases the system: clockwise trims right, counter-clockwise left.",
          "Optional add-ons tracked a VOR/LOC course (B-11 Accu-Trak) or a heading (B-5 / Accu-Flite); without one, PC holds a reasonable heading but not a preselected one (Ranger 2-9).",
        ].map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <H3>Details</H3>
      <Facts
        rows={[
          [
            "Maker",
            "Brittain Industries, Tulsa (closed 2019; seal kits and overhauls still available through former staff)",
          ],
          ["Power", "Vacuum only — no electrical requirement (OM p. 8)"],
          ["Axes", "Roll and yaw; no pitch"],
          ["Cut-off", "Pneumatic button in the left grip (electric switch and solenoid valve from 1977)"],
          ["Override", "Can be overpowered from either seat without damage (OM p. 8–9; Ranger 2-10)"],
          [
            "Spins",
            "Not approved; cut PC off with the button if recovering from an inadvertent spin entry (OM p. 8–9)",
          ],
          ["Failures", "A split diaphragm or cracked tubing: low suction, a wing that wants to drop, sluggish gyros"],
        ]}
      />
      <H3>Notes</H3>
      <Notes
        items={[
          "Thumb on the button for every turn becomes a habit; pulling the button up about ¼ in latches PC off, though the seal can suffer — many owners add a panel dump valve.",
          "Rig the airplane with the ball centred before blaming PC for a wing-low tendency.",
          "The 1962–64 airplanes had no PC unless retrofitted (1962–64 supplement).",
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("autopilot")} />
    </>
  );
}
