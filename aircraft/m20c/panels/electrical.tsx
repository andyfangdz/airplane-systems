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
  Rocker,
  Slider,
  Small,
  useTicker,
  type Reading,
} from "@/components/ui/controls";
import { PUSH_CB, SWITCH_CB, fuelAvail, initialSim, type Sim } from "../model";
import { CAT } from "../parts";
import { useM20C } from "../store";
import { PowerDiagram } from "./distribution";

type Breaker = { label: string; amps?: number; key?: keyof Sim["sw"] };
const PUSH_BREAKERS: Breaker[] = PUSH_CB.map(([label, amps]) => ({ label, amps }));

function Chips({ items, kind }: { items: readonly Breaker[]; kind: "switch" | "push" }) {
  const E = useM20C((x) => x.E),
    cb = useM20C((x) => x.s.cb),
    up = useM20C((x) => x.update);
  const on = E.bus > 0;
  return (
    <div className={"bus" + (on ? " on" : "")}>
      <div className="top">
        <span className="lamp" />
        <span className="nm">{kind === "switch" ? "SWITCH-BREAKERS" : "PUSH-TO-RESET BREAKERS"}</span>
        <span className="v">{on ? E.bus.toFixed(1) + " V" : "0 V"}</span>
      </div>
      <div className="src">
        {kind === "switch"
          ? "Lower left of the pilot's panel: toggle switches that are also breakers (OM p. 4)"
          : "Lower right of the co-pilot's panel, under the breaker cover (OM p. 4); names inferred from the Ranger schematic"}
      </div>
      <div className="loads">
        {items.map(({ label: n, amps: a, key }) => (
          <button
            key={n}
            type="button"
            className={"chip" + (cb[n] ? " pulled" : "")}
            aria-pressed={!!cb[n]}
            title={
              kind === "switch"
                ? `Trip / reset the ${n} switch-breaker (an overload flips it OFF)`
                : `Pull / reset the ${n} breaker`
            }
            onClick={() =>
              up((d) => {
                if (d.cb[n]) delete d.cb[n];
                else {
                  d.cb[n] = true;
                  if (key) d.sw[key] = false;
                }
              })
            }
          >
            {n}
            {a ? ` ${a}` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}

const resetElec = (d: Sim) => {
  d.elec = structuredClone(initialSim.elec);
  d.cb = {};
};

export function Electrical() {
  useTicker(250);
  const s = useM20C((x) => x.s),
    E = useM20C((x) => x.E),
    up = useM20C((x) => x.update);
  const e = s.elec;
  const scen = (label: string, fn: (d: Sim) => void) => (
    <button
      key={label}
      type="button"
      className="btn"
      onClick={() => {
        up((d) => {
          resetElec(d);
          d.eng.running = true;
          d.eng.key = "BOTH";
          if (d.eng.mix < 0.1) d.eng.mix = 0.8;
          if (!fuelAvail(d)) d.fuel.sel = d.fuel.qL > 0 ? "L" : "R";
        });
        up(fn);
      }}
    >
      {label}
    </button>
  );
  const batt: Reading = E.batDead
    ? ["DEPLETED", "bad"]
    : !E.batOk
      ? ["OFF / FAILED", "bad"]
      : E.genOn
        ? "Charging"
        : E.batLoad > 0
          ? [`Discharging · ${Math.round((1 - E.batFrac) * 100)}%`, "warnc"]
          : "Idle";
  return (
    <>
      <p className="lead">
        A simple 12 V system: a 35 Ah battery on the forward left side of the firewall, a master switch that works a
        relay at the battery, and one bus. On the 1968 Ranger a 60 A Prestolite alternator at the front of the engine
        feeds the bus through the ALT breaker, its field through ALT FIELD and the regulator; the ammeter in the engine
        cluster reads charge and discharge. The 1962–67 Mark 21 had a 50 A Delco-Remy generator and a load meter
        instead. Everything except the magnetos goes dark with the master off — the engine keeps running.
      </p>
      <H3>Switches</H3>
      <Ctl>
        <div className="switches">
          <Rocker
            label="MASTER"
            on={e.master}
            onToggle={() =>
              up((d) => {
                d.elec.master = !d.elec.master;
              })
            }
          />
          <Rocker
            label="RADIOS"
            on={e.radios}
            onToggle={() =>
              up((d) => {
                d.elec.radios = !d.elec.radios;
              })
            }
          />
          <Rocker
            label="FUEL PUMP"
            on={s.sw.fuelPump}
            onToggle={() =>
              up((d) => {
                d.sw.fuelPump = !d.sw.fuelPump;
              })
            }
          />
          <Rocker
            label="PITOT HEAT"
            on={s.sw.pitotHeat}
            onToggle={() =>
              up((d) => {
                d.sw.pitotHeat = !d.sw.pitotHeat;
              })
            }
          />
          <Rocker
            label="BEACON"
            on={s.sw.beacon}
            onToggle={() =>
              up((d) => {
                d.sw.beacon = !d.sw.beacon;
              })
            }
          />
          <Rocker
            label="NAV LTS"
            on={s.sw.nav}
            onToggle={() =>
              up((d) => {
                d.sw.nav = !d.sw.nav;
              })
            }
          />
          <Rocker
            label="LDG LT"
            on={s.sw.landing}
            onToggle={() =>
              up((d) => {
                d.sw.landing = !d.sw.landing;
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
              id="fAlt"
              label="Alternator fails"
              checked={e.fail.gen}
              onChange={(v) =>
                up((d) => {
                  d.elec.fail.gen = v;
                })
              }
            />
            <Check
              id="fBat"
              label="Battery dead"
              checked={e.fail.bat}
              onChange={(v) =>
                up((d) => {
                  d.elec.fail.bat = v;
                })
              }
            />
          </BtnRow>
        </div>
        <div className="row">
          <div className="lbl">
            <span>Scenarios (engine running)</span>
          </div>
          <BtnRow>
            {scen("Normal", () => {})}
            {scen("Alternator fails", (d) => {
              d.elec.fail.gen = true;
            })}
            {scen("…then shed loads (Ranger 2-15)", (d) => {
              d.elec.fail.gen = true;
              d.elec.radios = false;
              d.sw.landing = false;
              d.sw.pitotHeat = false;
              d.elec.tBat = 15;
            })}
            {scen("ALT breaker trips", (d) => {
              d.cb["ALT"] = true;
            })}
            {scen("Over-voltage: pull ALT FIELD", (d) => {
              d.cb["ALT FIELD"] = true;
            })}
            {scen("Master off", (d) => {
              d.elec.master = false;
            })}
          </BtnRow>
        </div>
        <Slider
          id="tBat"
          label="Time on battery power"
          min={0}
          max={120}
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
            ["Bus", [E.bus.toFixed(1) + " V", E.bus === 0 ? "bad" : E.bus < 12 ? "warnc" : ""]],
            ["Alternator", E.genOn ? "ON LINE" : s.eng.running ? ["OFF LINE", "bad"] : "—"],
            ["Ammeter", [(E.amps > 0 ? "+" : "") + E.amps + " A", E.amps < 0 ? "bad" : ""]],
            ["Load", E.load.toFixed(1) + " A"],
            ["NAV/COM 1 · 2", `${E.com1 ? "ON" : "OFF"} · ${E.com2 ? "ON" : "OFF"}`],
            ["Transponder", E.xpdr ? "ON" : "OFF"],
            ["Battery", batt],
            ["Battery endurance", E.batLoad > 0 ? `≈ ${E.endurance} min at ${E.batLoad.toFixed(1)} A` : "—"],
            ["Starter / vibrator", E.starterOn ? ["ENGAGED", "warnc"] : E.starterPwr ? "Ready" : ["NO PWR", "bad"]],
          ]}
        />
      </Ctl>
      <Small>
        Endurance uses 70 % of the 35 Ah battery; loads are illustrative — the manual gives none. A tripped
        switch-breaker flips its switch off (OM p. 4); the push-to-reset breakers are under the cover on the co-pilot's
        side. The 1968 book's own breaker labels are not available, so those names follow the 1974 Ranger schematic
        without the electric-gear circuits.
      </Small>
      {!E.genOn && s.eng.running && E.bus > 0 && (
        <Caution title="Alternator off line (Ranger 2-15, 5-4)">
          The ammeter shows a discharge. 1. ALT breaker — push to reset once it has cooled. 2. If it trips again leave
          it out and pull ALT FIELD. 3. Everything not needed for flight OFF; land as soon as practical. A discharged
          battery is all that is left.
        </Caution>
      )}
      <H3>Power distribution</H3>
      <PowerDiagram s={s} E={E} />
      <Notes
        items={[
          "Battery → master relay at the battery (master switch, left of the flight panel) → bus (OM p. 3).",
          "Alternator → ALT 60 A → bus; bus → ALT FIELD → regulator → field. A dead battery and an alternator that has dropped off line cannot restart each other (field needs the bus).",
          "Bus → five switch-breakers (fuel pump, pitot heat, beacon, nav lights, landing light) and the push-to-reset panel (gear warn, stall warn, ignition/vibrator, instruments, turn & bank, vacuum warn, instrument lights, radios).",
          "Starter: battery relay → heavy cable → starter; the vibrator shares the IGN breaker. The magnetos need none of this.",
          "Over-voltage: radios off, master off and on to reset the regulator; if the light or discharge returns, pull ALT FIELD (Ranger 2-15).",
        ]}
      />
      <H3>Breakers — tap to trip or reset</H3>
      <div className="buses">
        <Chips items={SWITCH_CB} kind="switch" />
        <Chips items={PUSH_BREAKERS} kind="push" />
      </div>
      <H3>What the bus feeds (OM p. 3)</H3>
      <Facts
        rows={[
          [
            "Always",
            "Radios, starter and vibrator, nav and interior lights, landing light, beacon, heated pitot (if installed), turn and bank, cigarette lighter, fuel gauges, boost pump, stall horn, gear horn and lights",
          ],
          ["Not electric", "Magnetos, the gyros (vacuum), PC (vacuum), flaps and gear (muscle), brakes"],
          ["Starter", "Delco-Remy or Prestolite 12 V (TCDS); 10–15 s max, then 5 min cooling (Ranger 3-7)"],
          [
            "Battery",
            "Auto-Lite / Prestolite R-35, 27 lb at +2.5 (TCDS); check fluid every 25 h or 30 days (OM p. 26)",
          ],
          ["Polarity", "Negative ground; mind it with chargers and jump batteries (Ranger 7-8)"],
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("electrical")} />
    </>
  );
}
