"use client";
/**
 * Electrical panel parts shared by the SR20 and SR22T: the bolster master switches with their failures, scenarios and
 * readouts, and a circuit-breaker bus card. Stateless: the airplane passes its sim state, electrical solution and update
 * callback, and its own numbers (how many decimals its volts show, its battery-time slider's label).
 */
import { BtnRow, Check, Readouts, Rocker, ScenarioButton, Slider } from "@/components/ui/controls";

/** The bolster switches, their failures and the time on batteries. */
interface CirrusElecState {
  bat1: boolean;
  bat2: boolean;
  alt1: boolean;
  alt2: boolean;
  avionics: boolean;
  fail: { alt1: boolean; alt2: boolean; bat1: boolean };
  tBat: number;
}
/** What the scenarios set: the electrical state, breakers, engine and fuel selector. */
export interface PowerSim {
  elec: CirrusElecState;
  cb: Record<string, boolean>;
  eng: { running: boolean; key: string; mix: number };
  fuel: { sel: string; qL: number; qR: number };
}
/** The readouts' sources: bus volts, source amps and battery states. */
export interface PowerElec {
  ess1: number;
  mdb1: number;
  mdb2: number;
  a1: number;
  a2: number;
  b1: number;
  bat1Dead: boolean;
  bat1ok: boolean;
  bat2Dead: boolean;
  bat2ok: boolean;
  bat2Charging: boolean;
}
/** One circuit-breaker bus: its voltage and source, and a chip per breaker to pull or reset. */
export function BusCard({
  name,
  src,
  loads,
  v,
  digits,
  cb,
  up,
}: {
  name: string;
  src: string;
  loads: [string, number?][];
  v: number;
  digits: number;
  cb: Record<string, boolean>;
  up: (fn: (d: { cb: Record<string, boolean> }) => void) => void;
}) {
  const on = v > 0;
  return (
    <div className={"bus" + (on ? " on" : "")}>
      <div className="top">
        <span className="lamp" />
        <span className="nm">{name}</span>
        <span className="v">{on ? v.toFixed(digits) + " V" : "0 V"}</span>
      </div>
      <div className="src">{src}</div>
      <div className="loads">
        {loads.map(([n, a]) => (
          <button
            key={n}
            type="button"
            className={"chip" + (cb[n] ? " pulled" : "")}
            aria-pressed={!!cb[n]}
            title={`Pull / reset the ${n} breaker`}
            onClick={() =>
              up((d) => {
                if (d.cb[n]) delete d.cb[n];
                else d.cb[n] = true;
              })
            }
          >
            {n}
            {a ? ` ${a}A` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The electrical scenario the overview's "try it" loads. */
export const ALT1_FAILS = "ALT 1 fails";

/** Engine running in flight: key BOTH, mixture out of cutoff, a tank with fuel, breakers in. */
const fly = <S extends PowerSim>(d: S, fuelAvail: (d: S) => boolean) => {
  d.cb = {};
  d.eng.running = true;
  d.eng.key = "BOTH";
  if (d.eng.mix < 0.1) d.eng.mix = 0.85;
  if (!fuelAvail(d)) d.fuel.sel = d.fuel.qL > 0 ? "L" : "R";
};
const resetElec = (d: PowerSim) => {
  d.elec = {
    bat1: true,
    bat2: true,
    alt1: true,
    alt2: true,
    avionics: true,
    fail: { alt1: false, alt2: false, bat1: false },
    tBat: 0,
  };
};

/**
 * Bolster master switches (BAT 2, BAT 1, ALT 1, ALT 2, AVIONICS), the source failures, scenarios that reset the electrical
 * system first, the time-on-batteries slider and the bus and source readouts.
 */
export function PowerControls<S extends PowerSim>({
  s,
  E,
  up,
  fuelAvail,
  digits,
  timeLabel,
}: {
  s: S;
  E: PowerElec;
  up: (fn: (d: S) => void) => void;
  fuelAvail: (d: S) => boolean;
  digits: number;
  timeLabel: string;
}) {
  const e = s.elec;
  const scen = (label: string, fn: (d: S) => void) => (
    <ScenarioButton
      key={label}
      onClick={() =>
        up((d) => {
          resetElec(d);
          fn(d);
        })
      }
    >
      {label}
    </ScenarioButton>
  );
  const amp = (a: number) => (a > 0 ? "+" : "") + a;
  return (
    <>
      <div className="switches">
        <Rocker
          label="BAT 2"
          on={e.bat2}
          onToggle={() =>
            up((d) => {
              d.elec.bat2 = !d.elec.bat2;
            })
          }
        />
        <Rocker
          label="BAT 1"
          on={e.bat1}
          onToggle={() =>
            up((d) => {
              d.elec.bat1 = !d.elec.bat1;
            })
          }
        />
        <Rocker
          label="ALT 1"
          on={e.alt1}
          onToggle={() =>
            up((d) => {
              d.elec.alt1 = !d.elec.alt1;
            })
          }
        />
        <Rocker
          label="ALT 2"
          on={e.alt2}
          onToggle={() =>
            up((d) => {
              d.elec.alt2 = !d.elec.alt2;
            })
          }
        />
        <Rocker
          label="AVIONICS"
          on={e.avionics}
          onToggle={() =>
            up((d) => {
              d.elec.avionics = !d.elec.avionics;
            })
          }
        />
      </div>
      <div className="row">
        <div className="lbl">
          <span>Failures</span>
        </div>
        <BtnRow>
          <Check
            id="fA1"
            label="ALT 1 fails"
            checked={e.fail.alt1}
            onChange={(v) =>
              up((d) => {
                d.elec.fail.alt1 = v;
              })
            }
          />
          <Check
            id="fA2"
            label="ALT 2 fails"
            checked={e.fail.alt2}
            onChange={(v) =>
              up((d) => {
                d.elec.fail.alt2 = v;
              })
            }
          />
          <Check
            id="fB1"
            label="BAT 1 dead"
            checked={e.fail.bat1}
            onChange={(v) =>
              up((d) => {
                d.elec.fail.bat1 = v;
              })
            }
          />
        </BtnRow>
      </div>
      <div className="row">
        <div className="lbl">
          <span>Scenarios</span>
        </div>
        <BtnRow>
          {scen("Normal cruise", (d) => {
            fly(d, fuelAvail);
          })}
          {scen(ALT1_FAILS, (d) => {
            fly(d, fuelAvail);
            d.elec.fail.alt1 = true;
          })}
          {scen("ALT 2 fails", (d) => {
            fly(d, fuelAvail);
            d.elec.fail.alt2 = true;
          })}
          {scen("Both ALTs fail", (d) => {
            fly(d, fuelAvail);
            d.elec.fail.alt1 = d.elec.fail.alt2 = true;
          })}
          {scen("BAT 2-only ground check", (d) => {
            d.eng.running = false;
            d.eng.key = "OFF";
            d.elec.bat1 = d.elec.alt1 = d.elec.alt2 = d.elec.avionics = false;
          })}
          {scen("Everything lost but BAT 2", (d) => {
            fly(d, fuelAvail);
            d.elec.fail.alt1 = d.elec.fail.alt2 = d.elec.fail.bat1 = true;
          })}
        </BtnRow>
      </div>
      <Slider
        id="tBat"
        label={timeLabel}
        min={0}
        max={75}
        step={1}
        value={e.tBat}
        onChange={(v) =>
          up((d) => {
            d.elec.tBat = v;
          })
        }
        fmt={(v) => v + " min"}
      />
      <Readouts
        items={[
          ["Engine", s.eng.running ? "RUNNING" : ["STOPPED", "bad"]],
          ["ESS V", [E.ess1.toFixed(digits), E.ess1 < 24.5 ? "bad" : ""]],
          ["M1 V", [E.mdb1.toFixed(digits), E.mdb1 < 24.5 ? "warnc" : ""]],
          ["M2 V", [E.mdb2.toFixed(digits), E.mdb2 < 24.5 ? "warnc" : ""]],
          ["ALT 1 A", [amp(E.a1), E.a1 ? "" : "warnc"]],
          ["ALT 2 A", [amp(E.a2), E.a2 ? "" : "warnc"]],
          [
            "BAT 1 A",
            E.bat1Dead ? ["DEPLETED", "bad"] : !E.bat1ok ? ["OFF", "bad"] : [amp(E.b1), E.b1 < 0 ? "warnc" : ""],
          ],
          [
            "BAT 2",
            E.bat2Dead
              ? ["DEPLETED", "bad"]
              : !E.bat2ok
                ? ["OFF", "bad"]
                : E.bat2Charging
                  ? "Charging"
                  : ["Supplying", "warnc"],
          ],
        ]}
      />
    </>
  );
}
