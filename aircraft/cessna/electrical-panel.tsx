"use client";
/**
 * Electrical and Lighting panel parts shared by the C172S and C182T (NAV III): ground power and the 12 V outlet, the
 * battery readouts, the failures and scenarios, the breaker trip buttons, the LIGHTS switches and a dimmer. Stateless like
 * `panels.tsx`: the airplane passes its state, solution and update callbacks, and keeps its own lead text, notes and POH
 * page citations, which differ between the two POHs.
 */
import { BtnRow, Check, Readouts, Rocker, Seg, Slider } from "@/components/ui/controls";
import { FEEDER, nav3Init, stbyAhOf, type Nav3Cfg, type Nav3Elec, type Nav3Solution } from "./electrical";

type UpdE = (fn: (d: Nav3Elec) => void) => void;

/** Back to the electrical defaults, keeping both batteries' charge. */
export const resetNav3 = (d: { elec: Nav3Elec }) => {
  const k = { socMain: d.elec.socMain, socStby: d.elec.socStby };
  d.elec = { ...nav3Init(), ...k };
};

/** Minutes a battery lasts at this discharge, or a dash while it isn't discharging. */
const mins = (Ah: number, soc: number, amps: number) =>
  amps < -0.2 ? `${Math.round(((Ah * soc) / -amps) * 60)} min` : "—";

/** Ground power plug and the switch panel's CABIN PWR 12V rocker with the outlet's state. */
export function Nav3GroundAndOutlet({
  e,
  outlet12,
  cabinPwr,
  upE,
  up,
}: {
  e: Nav3Elec;
  outlet12: boolean;
  cabinPwr: boolean;
  upE: UpdE;
  up: (fn: (d: { lights: { cabinPwr: boolean } }) => void) => void;
}) {
  return (
    <>
      <Check
        id="ext"
        label="External power connected (28 V regulated)"
        checked={e.ext}
        onChange={(v) =>
          upE((d) => {
            d.ext = v;
          })
        }
      />
      <div className="row">
        <div className="lbl">
          <span>Switch panel</span>
          <span>12 V outlet {outlet12 ? "live" : cabinPwr ? "— no power" : "off"}</span>
        </div>
        <div className="switches">
          <Rocker
            label="CABIN PWR 12V"
            on={cabinPwr}
            onToggle={() =>
              up((d) => {
                d.lights.cabinPwr = !d.lights.cabinPwr;
              })
            }
          />
        </div>
      </div>
    </>
  );
}

/** Alternator, bus load, and each battery's charge and the minutes it has left while it is supplying. */
export function Nav3BatteryReadouts({ e, E, cfg }: { e: Nav3Elec; E: Nav3Solution; cfg: Nav3Cfg }) {
  return (
    <Readouts
      items={[
        ["Alternator", E.altOn ? `${E.altAmps.toFixed(1)} A` : ["OFF", "bad"]],
        ["Bus load", `${E.load.toFixed(1)} A`],
        [
          "Main battery",
          e.fail.bat ? ["FAILED", "bad"] : `${Math.round(e.socMain * 100)}% · ${mins(cfg.mainAh, e.socMain, E.mBatt)}`,
        ],
        [
          "Standby battery",
          e.stby !== "ARM" || e.cb["ESS:STDBY BATT"]
            ? [e.stby !== "ARM" ? "OFF" : "C/B OUT (STDBY BATT)", "warnc"]
            : E.stbyOnline
              ? [`Supplying · ${mins(stbyAhOf(e, cfg), e.socStby, E.sBatt)}`, "warnc"]
              : `${Math.round(e.socStby * 100)}% · ${E.sBatt > 0 ? "charging" : "standing by"}`,
        ],
      ]}
    />
  );
}

/**
 * Failures, scenarios (each resets the electrical system first; `pre` runs as its own update before it, e.g. putting the
 * airplane on the ramp), the battery clock and both batteries' charge. `run` gets the engine running the airplane's way;
 * `onScenario` clears the airplane's per-frame timers.
 */
export function Nav3Scenarios<S extends { elec: Nav3Elec; warp: number }>({
  s,
  up,
  run,
  coldDark,
  onScenario,
}: {
  s: S;
  up: (fn: (d: S) => void) => void;
  run: (d: S) => void;
  coldDark: () => void;
  onScenario: () => void;
}) {
  const e = s.elec;
  const upE = (fn: (d: Nav3Elec) => void) => up((d) => fn(d.elec));
  const scen = (label: string, fn: (d: S) => void, pre?: () => void) => (
    <button
      key={label}
      type="button"
      className="btn"
      onClick={() => {
        pre?.();
        onScenario();
        up((d) => {
          resetNav3(d);
          fn(d);
        });
      }}
    >
      {label}
    </button>
  );
  return (
    <>
      <BtnRow>
        <Check
          id="fAlt"
          label="Alternator fails (belt)"
          checked={e.fail.alt}
          onChange={(v) =>
            upE((d) => {
              d.fail.alt = v;
            })
          }
        />
        <Check
          id="fOv"
          label="Regulator runaway (over-voltage)"
          checked={e.fail.ov}
          onChange={(v) =>
            upE((d) => {
              d.fail.ov = v;
            })
          }
        />
        <Check
          id="fOvS"
          label="ACU over-voltage sensor dead"
          checked={e.fail.ovSense}
          onChange={(v) =>
            upE((d) => {
              d.fail.ovSense = v;
            })
          }
        />
        <Check
          id="fBat"
          label="Main battery failed"
          checked={e.fail.bat}
          onChange={(v) =>
            upE((d) => {
              d.fail.bat = v;
            })
          }
        />
        <Check
          id="fSb"
          label="Standby battery weak / cold"
          checked={e.fail.stby}
          onChange={(v) =>
            upE((d) => {
              d.fail.stby = v;
            })
          }
        />
      </BtnRow>
      <div className="row">
        <div className="lbl">
          <span>Scenarios</span>
        </div>
        <BtnRow>
          {scen("Normal", (d) => {
            run(d);
          })}
          {scen("Alternator failure", (d) => {
            run(d);
            d.elec.fail.alt = true;
          })}
          {scen("ACU over-voltage trip", (d) => {
            run(d);
            d.elec.fail.ov = true;
          })}
          {scen("HIGH VOLTS (ACU failed)", (d) => {
            run(d);
            d.elec.fail.ov = true;
            d.elec.fail.ovSense = true;
          })}
          {scen("Feeder A trips (BUS 2)", (d) => {
            run(d);
            d.elec.cb[FEEDER.E2] = true;
          })}
          {scen("Standby battery only", (d) => {
            run(d);
            d.elec.bat = false;
            d.elec.alt = false;
          })}
          {scen(
            "Pre-start STBY BATT check",
            (d) => {
              d.elec.bat = d.elec.alt = d.elec.avn1 = d.elec.avn2 = false;
              d.elec.stby = "ARM";
            },
            coldDark,
          )}
        </BtnRow>
      </div>
      <Seg
        id="warp"
        label="Battery clock"
        options={[
          [1, "×1"],
          [10, "×10"],
          [60, "×60"],
        ]}
        value={s.warp}
        onChange={(v) =>
          up((d) => {
            d.warp = v;
          })
        }
      />
      <Slider
        id="socM"
        label="Main battery charge"
        min={0}
        max={1}
        step={0.01}
        value={e.socMain}
        onChange={(v) =>
          upE((d) => {
            d.socMain = v;
          })
        }
        fmt={(v) => Math.round(v * 100) + "%"}
      />
      <Slider
        id="socS"
        label="Standby battery charge"
        min={0}
        max={1}
        step={0.01}
        value={e.socStby}
        onChange={(v) =>
          upE((d) => {
            d.socStby = v;
          })
        }
        fmt={(v) => Math.round(v * 100) + "%"}
      />
    </>
  );
}

/** Breaker trip buttons: LAND LT, ALT FIELD, optionally WARN, and the two J-box feeders. */
export function Nav3TripButtons({ cb, up, warn = false }: { cb: Record<string, boolean>; up: UpdE; warn?: boolean }) {
  return (
    <BtnRow>
      <button
        type="button"
        className="btn"
        onClick={() =>
          up((d) => {
            d.cb["E1:LAND LT"] = true;
          })
        }
      >
        Trip LAND LT
      </button>
      <button
        type="button"
        className="btn"
        onClick={() =>
          up((d) => {
            d.cb["XF:ALT FIELD"] = true;
          })
        }
      >
        Trip ALT FIELD
      </button>
      {warn && (
        <button
          type="button"
          className="btn"
          onClick={() =>
            up((d) => {
              d.cb["XF:WARN"] = !d.cb["XF:WARN"];
            })
          }
        >
          {cb["XF:WARN"] ? "Reset" : "Trip"} WARN
        </button>
      )}
      <button
        type="button"
        className="btn"
        onClick={() =>
          up((d) => {
            d.cb[FEEDER.E1] = !d.cb[FEEDER.E1];
          })
        }
      >
        {cb[FEEDER.E1] ? "Reset" : "Trip"} feeder B (BUS 1)
      </button>
      <button
        type="button"
        className="btn"
        onClick={() =>
          up((d) => {
            d.cb[FEEDER.E2] = !d.cb[FEEDER.E2];
          })
        }
      >
        {cb[FEEDER.E2] ? "Reset" : "Trip"} feeder A (BUS 2)
      </button>
    </BtnRow>
  );
}

/** The LIGHTS switches, DOME button and dimmers (0 = off) these panel parts read. */
export interface Nav3Lights {
  beacon: boolean;
  land: boolean;
  taxi: boolean;
  nav: boolean;
  strobe: boolean;
  dome: boolean;
  flood: number;
  swcb: number;
  pedestal: number;
  avionics: number;
  stbyInd: number;
}
type UpdL = (fn: (d: { lights: Nav3Lights }) => void) => void;

/** LIGHTS rockers (BEACON, LAND, TAXI, NAV, STROBE) and the overhead DOME button, with whether each light is lit. */
export function Nav3LightSwitches({
  L,
  lit,
  up,
}: {
  L: Nav3Lights;
  lit: { beacon: boolean; land: boolean; taxi: boolean; nav: boolean; strobe: boolean; dome: boolean };
  up: UpdL;
}) {
  type Sw = "beacon" | "land" | "taxi" | "nav" | "strobe";
  const flip = (k: Sw) =>
    up((d) => {
      d.lights[k] = !d.lights[k];
    });
  const st = (sw: boolean, on: boolean): [string, "" | "bad"] | string => (on ? "ON" : sw ? ["NO PWR", "bad"] : "off");
  return (
    <>
      <div className="switches">
        {(["beacon", "land", "taxi", "nav", "strobe"] as Sw[]).map((k) => (
          <Rocker key={k} label={k.toUpperCase()} on={L[k]} onToggle={() => flip(k)} />
        ))}
        <Rocker
          label="DOME"
          on={L.dome}
          onToggle={() =>
            up((d) => {
              d.lights.dome = !d.lights.dome;
            })
          }
        />
      </div>
      <Readouts
        items={[
          ["Beacon", st(L.beacon, lit.beacon)],
          ["Landing", st(L.land, lit.land)],
          ["Taxi", st(L.taxi, lit.taxi)],
          ["Nav + tail", st(L.nav, lit.nav)],
          ["Strobes", st(L.strobe, lit.strobe)],
          ["Dome + courtesy", st(L.dome, lit.dome)],
        ]}
      />
    </>
  );
}

/** One DIMMING knob or flood light dimmer, 0 = OFF. */
export function Nav3Dimmer({
  k,
  label,
  L,
  up,
}: {
  k: "flood" | "swcb" | "pedestal" | "avionics" | "stbyInd";
  label: string;
  L: Nav3Lights;
  up: UpdL;
}) {
  return (
    <Slider
      id={"dim" + k}
      label={label}
      min={0}
      max={1}
      step={0.05}
      value={L[k]}
      onChange={(v) =>
        up((d) => {
          d.lights[k] = v;
        })
      }
      fmt={(v) => (v < 0.03 ? "OFF" : Math.round(v * 100) + "%")}
    />
  );
}
