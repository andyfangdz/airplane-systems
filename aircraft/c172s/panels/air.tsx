"use client";
import {
  BtnRow,
  Caution,
  Check,
  Ctl,
  Facts,
  H3,
  Notes,
  PartsList,
  Readouts,
  Seg,
  Slider,
  Small,
  useTicker,
} from "@/components/ui/controls";
import { gfc700Key } from "@/lib/avionics/gfc700";
import { indicated } from "../displays";
import { AFCS_CFG, live, stallKias, type FlapCmd } from "../model";
import { CAT } from "../parts";
import { useC172 } from "../store";
import { scenarioCruise } from "../store";

const knob = (v: number) =>
  v < 0.03 ? "Pushed in (OFF)" : v > 0.97 ? "Pulled full out" : `Pulled ${Math.round(v * 100)}%`;

export function Environment() {
  useTicker(300);
  const s = useC172((x) => x.s),
    up = useC172((x) => x.update),
    env = s.env;
  const run = s.eng.running;
  return (
    <>
      <p className="lead">
        Heat comes from a shroud around the exhaust muffler: ram air warms there and the heater control valve (CABIN HT)
        lets it into the cabin manifold, where a ventilating air door (CABIN AIR) blends in fresh ram air. The manifold
        feeds the floor outlets, two defroster outlets and ducts to the rear cabin floor. Separate wing-root ram air
        feeds the adjustable ventilators — it never passes the heater (POH 7-62, Figure 7-8).
      </p>
      <H3>Controls</H3>
      <Ctl>
        <Slider
          id="heat"
          label="CABIN HT knob"
          min={0}
          max={1}
          step={0.01}
          value={env.heat}
          onChange={(v) =>
            up((d) => {
              d.env.heat = v;
            })
          }
          fmt={knob}
        />
        <Slider
          id="air"
          label="CABIN AIR knob"
          min={0}
          max={1}
          step={0.01}
          value={env.air}
          onChange={(v) =>
            up((d) => {
              d.env.air = v;
            })
          }
          fmt={knob}
        />
        <Slider
          id="defr"
          label="Defroster slide valves"
          min={0}
          max={1}
          step={0.05}
          value={env.defrost}
          onChange={(v) =>
            up((d) => {
              d.env.defrost = v;
            })
          }
          fmt={(v) => (v < 0.05 ? "Closed" : Math.round(v * 100) + "% open")}
        />
        <Check
          id="vents"
          label="Cabin vents (wing-root ventilators) open"
          checked={env.vents}
          onChange={(v) =>
            up((d) => {
              d.env.vents = v;
            })
          }
        />
        <Readouts
          items={[
            [
              "Heated air",
              run ? (env.heat > 0.02 ? `${Math.round(env.heat * 100)}%` : "None") : ["Engine off", "warnc"],
            ],
            ["Blend", env.heat + env.air < 0.05 ? "No airflow" : env.heat > env.air ? "Warm" : "Cool"],
            ["Max heat", env.heat > 0.97 && env.air < 0.03 ? "Yes" : "No"],
            [
              "CO",
              live.coPpm >= 50
                ? [env.coAck ? "CO LVL HIGH · steady" : "CO LVL HIGH · flashing", "bad"]
                : `${Math.round(live.coPpm)} PPM`,
            ],
          ]}
        />
      </Ctl>
      <H3>Scenario: cracked muffler</H3>
      <Ctl>
        <Check
          id="co"
          label="Exhaust leak under the heater shroud"
          checked={env.coLeak}
          onChange={(v) =>
            up((d) => {
              d.env.coLeak = v;
            })
          }
        />
        <BtnRow>
          <button
            type="button"
            className="btn"
            disabled={live.coPpm < 50 || env.coAck}
            onClick={() =>
              up((d) => {
                d.env.coAck = true;
              })
            }
          >
            WARNING softkey (acknowledge)
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              up((d) => {
                d.env.heat = 0;
                d.env.air = 1;
                d.env.vents = true;
              })
            }
          >
            CO LVL HIGH checklist
          </button>
        </BtnRow>
      </Ctl>
      <Small>
        Maximum heat is CABIN HT pulled full out with CABIN AIR pushed in. With a leak, CO only reaches the cabin when
        CABIN HT is open; fresh air and vents dilute it. CO LVL HIGH flashes until acknowledged with the WARNING
        softkey, then stays steady until CO falls below 50 PPM (POH 7-80). The model is illustrative.
      </Small>
      <Caution title="CO LVL HIGH (POH 3-24)">
        CABIN HT OFF (push in) · CABIN AIR ON (pull out) · cabin vents OPEN · cabin windows OPEN (163 KIAS max). If it
        stays on, land as soon as possible.
      </Caution>
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("environment")} />
      <H3>Outlets</H3>
      <Facts
        rows={[
          ["Front floor", "Holes across the manifold just forward of the front seats"],
          ["Rear floor", "One duct down each side to an outlet just aft of the rudder pedals"],
          ["Defrost", "Two outlets at the base of the windshield, each with a slide valve"],
          ["Ventilators", "One near each upper windshield corner, two for the rear cabin (wing-root ram air)"],
          ["Fan", "None — ram air only"],
        ]}
      />
      <Notes
        items={[
          "Electrical or cabin fire: vents CLOSED and both knobs OFF to avoid drafts; ventilate once the fire is out (POH 3-11, 3-12).",
          "Inadvertent icing: CABIN HT ON, defrosters OPEN, CABIN AIR adjusted for maximum defrost heat (POH 3-14).",
          "Engine fire in flight: vents open as needed, CABIN HT and CABIN AIR off (POH 3-11).",
        ]}
      />
    </>
  );
}

export function Pitot() {
  useTicker(150);
  const s = useC172((x) => x.s),
    E = useC172((x) => x.E),
    up = useC172((x) => x.update),
    p = s.pitot;
  const ind = indicated(s, live.fs),
    vs = stallKias(live.flapAng);
  const startDemo = () => {
    if (s.ground || !s.eng.running) scenarioCruise();
    if (live.afcs.ap) live.afcs = gfc700Key(live.afcs, "AP_DISC", live.fs, AFCS_CFG); // normal disconnect: yellow AP + tone
    live.stallDemo = true;
    up((d) => {
      d.eng.throttle = 0;
    });
  };
  return (
    <>
      <p className="lead">
        A heated pitot head under the left wing and an external static port on the left side of the forward fuselage
        feed the GDC 74A air data computer and the standby airspeed indicator and altimeter. An ALT STATIC AIR valve by
        the throttle substitutes cabin pressure. Stall warning is pneumatic: an inlet in the left wing leading edge and
        an air-operated horn at the upper left corner of the windshield (POH 7-64, 7-67) — although Figure 7-7 lists
        “stall warning” among the WARN breaker loads.
      </p>
      <H3>Pitot-static</H3>
      <Ctl>
        <Check
          id="pheat"
          label="PITOT HEAT switch ON"
          checked={p.heat}
          onChange={(v) =>
            up((d) => {
              d.pitot.heat = v;
            })
          }
        />
        <Check
          id="alts"
          label="ALT STATIC AIR pulled ON"
          checked={p.altStatic}
          onChange={(v) =>
            up((d) => {
              d.pitot.altStatic = v;
            })
          }
        />
        <BtnRow>
          <Check
            id="hfail"
            label="Heater element open"
            checked={p.heaterFail}
            onChange={(v) =>
              up((d) => {
                d.pitot.heaterFail = v;
              })
            }
          />
          <Check
            id="pblk"
            label="Pitot blocked (ice)"
            checked={p.pitotBlocked}
            onChange={(v) =>
              up((d) => {
                d.pitot.pitotBlocked = v;
              })
            }
          />
          <Check
            id="sblk"
            label="Static port blocked"
            checked={p.staticBlocked}
            onChange={(v) =>
              up((d) => {
                d.pitot.staticBlocked = v;
              })
            }
          />
        </BtnRow>
        <Slider
          id="oat"
          label="Outside air temperature"
          min={-20}
          max={35}
          step={1}
          value={p.oat}
          onChange={(v) =>
            up((d) => {
              d.pitot.oat = v;
            })
          }
          fmt={(v) => `${v} °C / ${Math.round((v * 9) / 5 + 32)} °F`}
        />
        <Readouts
          items={[
            ["Pitot heat", E.pitotHeating ? "HEATING" : p.heat ? ["NO CURRENT", "bad"] : "Off"],
            ["Indicated", `${Math.round(ind.ias)} KIAS`],
            ["Altimeter", `${Math.round(ind.alt)} ft`],
            ["Static source", p.altStatic ? ["CABIN", "warnc"] : p.staticBlocked ? ["BLOCKED", "bad"] : "Port"],
          ]}
        />
      </Ctl>
      <Small>
        There is no pitot-heat annunciation in the 172S: check that the head is warm within 30 seconds on preflight (POH
        4-6). With ALT STATIC ON the Section 5 table shows airspeed 0 to 4 kt high (Figure 5-1 Sheet 2); POH 3-32 states
        a maximum airspeed variation of 11 kt and altimeter variation of 50 ft (windows closed), and the POH does not
        explain the difference. Modelled here as +2 kt and +30 ft.
      </Small>
      <Caution title="Static source blocked (POH 3-15)">
        ALT STATIC AIR ON (pull full out) · cabin vents CLOSED · CABIN HT and CABIN AIR ON (pull full out) · use the
        Section 5 alternate-static airspeed table.
      </Caution>
      <H3>Stall warning demo</H3>
      <Ctl>
        <Seg
          id="flapStall"
          label="Flaps"
          options={
            [
              [0, "UP"],
              [10, "10°"],
              [20, "20°"],
              [30, "FULL"],
            ] as [FlapCmd, string][]
          }
          value={s.flaps.cmd}
          onChange={(v) =>
            up((d) => {
              d.flaps.cmd = v;
            })
          }
        />
        <Check
          id="sinlet"
          label="Stall warning inlet blocked"
          checked={s.stall.inletBlocked}
          onChange={(v) =>
            up((d) => {
              d.stall.inletBlocked = v;
            })
          }
        />
        <BtnRow>
          <button type="button" className="btn primary" onClick={startDemo}>
            Power idle, hold altitude
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              live.stallDemo = false;
              up((d) => {
                d.eng.throttle = 0.86;
              });
            }}
          >
            Recover
          </button>
        </BtnRow>
        <Readouts
          items={[
            ["IAS", `${Math.round(live.fs.ias)} KIAS`],
            ["Stall speed", `${vs} KIAS`],
            ["Horn", live.horn ? ["SOUNDING", "bad"] : s.stall.inletBlocked ? ["SILENT (blocked)", "warnc"] : "Quiet"],
            ["Demo", live.stallDemo ? "Slowing" : "—"],
          ]}
        />
      </Ctl>
      <Small>
        The horn sounds 5 to 10 knots above the stall in all configurations (POH 7-67); here at Vs + 7 kt. Stall speeds:
        48 / 42 / 40 KIAS at UP / 10° / FULL, idle, wings level, 2,550 lb (Figure 5-3); 20° interpolated. The horn is
        modelled as needing no electrical power: the text (7-67) describes a purely pneumatic horn, although Figure 7-7
        lists “stall warning” among the WARN breaker loads.
      </Small>
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("pitot")} />
      <Notes
        items={[
          "Preflight: pitot cover off, static opening clear, stall-warning opening clear; test the horn by sucking gently through a handkerchief over the inlet (POH 4-5, 4-9, 4-10).",
          "Red X on PFD airspeed or altitude: check both ADC/AHRS breakers (ESS and AVN BUS 1); use the standby airspeed and altimeter (POH 3-21).",
          "PITOT HEAT breaker is on ELECTRICAL BUS 2 (non-pullable); it's in both load-shed lists (POH 3-17).",
        ]}
      />
    </>
  );
}

export function Vacuum() {
  useTicker(200);
  const s = useC172((x) => x.s),
    up = useC172((x) => x.update);
  const flag = live.vac < 3.5 || live.gyro < 0.7;
  return (
    <>
      <p className="lead">
        On N6189Q&apos;s panel (Figure 7-2 Sheet 1) the standby attitude indicator is a vacuum gyro. One engine-driven
        vacuum pump pulls cabin air through a filter, the instrument&apos;s rotor and a regulator; a transducer sends
        the vacuum to the EIS VAC gauge, and LOW VACUUM comes on below 3.5 in.Hg. The PFD attitude comes from the AHRS,
        so a vacuum failure doesn&apos;t affect it or the autopilot (POH 7-65, 3-29).
      </p>
      <H3>Try it</H3>
      <Ctl>
        <Check
          id="vfail"
          label="Vacuum pump fails"
          checked={s.vac.fail}
          onChange={(v) =>
            up((d) => {
              d.vac.fail = v;
            })
          }
        />
        <Readouts
          items={[
            ["VAC", [`${live.vac.toFixed(1)} in.Hg`, live.vac < 3.5 ? "warnc" : ""]],
            ["LOW VACUUM", live.vac < 3.5 ? ["SHOWN", "warnc"] : "—"],
            ["Gyro rotor", `${Math.round(live.gyro * 100)}%`],
            ["GYRO flag", flag ? ["IN VIEW", "bad"] : "Hidden"],
          ]}
        />
      </Ctl>
      <Small>
        The rotor runs down over a few minutes after the vacuum is lost and the standby horizon starts to drift; LOW
        VACUUM is also expected with the engine stopped (POH 4-5).
      </Small>
      <Caution title="LOW VACUUM (POH 3-23)">
        Check VAC on the EIS ENGINE page. If it is out of the green or the GYRO flag shows, do not use the standby
        attitude indicator.
      </Caution>
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("vacuum")} />
      <Facts
        rows={[
          ["VAC green", "4.5–5.5 in.Hg (POH 2-7)"],
          ["Annunciation", "LOW VACUUM, amber, single tone, below 3.5 in.Hg"],
          ["Pump", "AA3215CC, arm −5.0, cooling shroud"],
          ["Regulator · filter", "Arm 2.0, behind the panel"],
          ["Run-up", "VAC check at 1,800 RPM (POH 4-16)"],
          ["KOEL", "Pump, VAC indicator and standby attitude required for IFR"],
          ["Later airplanes", "From s/n 172S12701 a GI 275 replaces the cluster and there is no vacuum system"],
        ]}
      />
    </>
  );
}
