"use client";
/**
 * Flight-control panel parts shared by the SR20 and SR22T: the yoke and pedal inputs with the cable-run selector, the
 * Figure 7-1 / 7-2 / 7-3 cable-run steps, and the FLAPS switch with its position lights. Stateless: the airplane passes its
 * state and update callback and keeps its own facts and notes, which cite its own POH and AMM.
 */
import { BtnRow, H3, Seg, Slider } from "@/components/ui/controls";
import type { Vec3 } from "@/lib/math";
import type { Chan } from "@/lib/systems";
import { useView } from "@/lib/view";

type Ctrl = { pitch: number; roll: number; yaw: number };

/** Words for a control position: `pos` above +dz, `neg` below −dz, else `mid`. */
export const dir = (v: number, pos: string, neg: string, mid: string, dz = 0.02) =>
  v > dz ? pos : v < -dz ? neg : mid;

/** Camera framing for each control channel. */
export const CHAN_CAM: Record<Chan, [Vec3, Vec3]> = {
  elevator: [
    [-1.6, 2.4, -10.2],
    [-0.6, -0.35, 0],
  ],
  aileron: [
    [-4.2, 10.5, 0.4],
    [0.4, -0.4, 0],
  ],
  rudder: [
    [-1.6, 2.4, 10.2],
    [-0.6, -0.35, 0],
  ],
};

export const RUNS: Record<Chan, { fig: string; steps: string[] }> = {
  elevator: {
    fig: "POH Figure 7-1",
    steps: [
      "Pulling a yoke slides its tube aft in a bearing carriage.",
      "A drop link from each yoke tube rotates a lever on the lateral elevator torque tube under the panel.",
      "The forward sector on that torque tube drives a crossed cable pair down to the forward double pulley under the floor.",
      "A single cable loop runs aft under the cabin floor, over the intermediate double pulley and past the turnbuckles, to the aft sector pulley in the tailcone.",
      "A push-pull tube from the aft sector pulley moves the elevator bellcrank between the two elevator halves.",
    ],
  },
  aileron: {
    fig: "POH Figure 7-2",
    steps: [
      "Turning a yoke rotates it in its pivoting bearing carriage.",
      "Push rods link both carriages to the centrally located pulley sector.",
      "Two cables drop to the floor double pulley and run aft under the floor, aft of the rear spar, to the turning pulleys.",
      "From there one cable runs out each wing to a vertical sector / crank arm, which turns the aileron through a right-angle conical drive arm.",
      "A balance cable joins the two wing sectors through cable guides, closing the loop — one aileron goes up as the other goes down.",
    ],
  },
  rudder: {
    fig: "POH Figure 7-3",
    steps: [
      "Pushing a pedal swings the pedal links and the rudder cable horn on the pedal torque tube.",
      "A single cable system runs aft under the floor over the forward and intermediate double pulleys.",
      "It ends at the aft rudder sector, next to the elevator sector pulley in the aft fuselage.",
      "A push-pull tube from that sector drives the rudder bellcrank at the bottom of the rudder.",
      "Springs and a ground-adjustable spring cartridge on the pedal assembly centre the rudder (yaw trim).",
    ],
  },
};

/**
 * The cable-run selector (flies the camera to the run, or to `controlsCam` for all of them), the yoke and pedal sliders and
 * a button to center them.
 */
export function ControlInputs({
  ctrl,
  up,
  controlsCam,
}: {
  ctrl: Ctrl;
  up: (fn: (d: { ctrl: Ctrl }) => void) => void;
  controlsCam: [Vec3, Vec3];
}) {
  const ctrlFocus = useView((x) => x.ctrlFocus),
    flyTo = useView((x) => x.flyTo);
  const focus = (v: Chan | "all") => {
    useView.getState().set({ ctrlFocus: v });
    const [p, t] = v === "all" ? controlsCam : CHAN_CAM[v];
    flyTo(p, t);
  };
  return (
    <>
      <Seg
        id="chan"
        label="Show cable run"
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
        label="Yoke pitch (push ↔ pull)"
        min={-1}
        max={1}
        step={0.01}
        value={ctrl.pitch}
        onChange={(v) =>
          up((d) => {
            d.ctrl.pitch = v;
          })
        }
        fmt={(v) => dir(v, "Nose up", "Nose down", "Neutral")}
      />
      <Slider
        id="ctlRoll"
        label="Yoke roll"
        min={-1}
        max={1}
        step={0.01}
        value={ctrl.roll}
        onChange={(v) =>
          up((d) => {
            d.ctrl.roll = v;
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
        value={ctrl.yaw}
        onChange={(v) =>
          up((d) => {
            d.ctrl.yaw = v;
          })
        }
        fmt={(v) => dir(v, "Right", "Left", "Neutral")}
      />
      <BtnRow>
        <button
          type="button"
          className="btn"
          onClick={() =>
            up((d) => {
              d.ctrl = { pitch: 0, roll: 0, yaw: 0 };
            })
          }
        >
          Center controls
        </button>
      </BtnRow>
    </>
  );
}

/** The steps of the cable run picked with "Show cable run", or nothing while all are shown. */
export function CableRunSteps() {
  const ctrlFocus = useView((x) => x.ctrlFocus);
  if (ctrlFocus === "all") return null;
  return (
    <>
      <H3>
        {ctrlFocus[0].toUpperCase() + ctrlFocus.slice(1)} run · {RUNS[ctrlFocus].fig}
      </H3>
      <ol className="notes">
        {RUNS[ctrlFocus].steps.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    </>
  );
}

/** FLAPS switch (UP, 50%, 100%) and its position lights; `at` lights the selected position's lamp. */
export function FlapSwitch({
  cmd,
  at,
  up,
}: {
  cmd: 0 | 50 | 100;
  at: boolean;
  up: (fn: (d: { flaps: { cmd: 0 | 50 | 100 } }) => void) => void;
}) {
  return (
    <>
      <Seg
        id="flapSel"
        label="Select"
        options={[
          [0, "UP 0%"],
          [50, "50% · VFE 150"],
          [100, "100% · VFE 110"],
        ]}
        value={cmd}
        onChange={(v) =>
          up((d) => {
            d.flaps.cmd = v as 0 | 50 | 100;
          })
        }
      />
      <div className="lights3">
        {(
          [
            [0, "UP", "g"],
            [50, "50%", "y"],
            [100, "100%", "y"],
          ] as const
        ).map(([v, t, k]) => (
          <span key={v}>
            <i className={at && cmd === v ? k : ""} />
            {t}
          </span>
        ))}
      </div>
    </>
  );
}
