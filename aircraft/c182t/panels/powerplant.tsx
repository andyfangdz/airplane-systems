"use client";
import { useEffect } from "react";
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
import { fuelInd, govRpm, lambda, live, powerFrac, type EisPage, type FuelSel, type Mags } from "../model";
import { Nav3MagSwitch } from "../../cessna/panels";
import { CAT } from "../parts";
import { useC182 } from "../store";
import { QUARTER_TANK } from "../tick";
import { Scenarios } from "./general";
import { cancelPropCycle, startPropCycle } from "../propCycle";

const pct = (v: number) => Math.round(v * 100) + "%";
const thr = (v: number) => (v < 0.02 ? "IDLE (full out)" : v > 0.98 ? "FULL (full in)" : `${pct(v)} in`);
const mixFmt = (v: number) => (v <= 0.05 ? "IDLE CUTOFF" : v > 0.97 ? "FULL RICH" : `Leaned · ${pct(v)}`);
const propFmt = (v: number) =>
  `${v > 0.98 ? "HIGH RPM (full in)" : v < 0.02 ? "LOW RPM (full out)" : pct(v) + " in"} · governs ${Math.round(govRpm(v) / 10) * 10}`;
const cowlFmt = (v: number) => (v > 0.97 ? "OPEN" : v < 0.03 ? "CLOSED" : `${pct(v)} open`);
const rpm10 = () => String(Math.round(live.rpm / 10) * 10);
const tick = (b: boolean) => (b ? "✓ " : "· ");

/** MAGNETOS rotary with the spring-loaded START position held by a button. */
function MagSwitch() {
  const s = useC182((x) => x.s),
    E = useC182((x) => x.E),
    up = useC182((x) => x.update);
  const set = (m: Mags) =>
    up((d) => {
      d.eng.mags = m;
    });
  const crankSec = live.crankT > 0 ? live.crankTotal : null;
  return (
    <Nav3MagSwitch
      mags={s.eng.mags}
      starterPwr={E.starterPwr}
      crankSec={crankSec}
      set={set}
      onStart={() => {
        live.crankT = 0;
      }}
    />
  );
}

/** Throttle, PROPELLER and mixture: the three push-pull knobs in the lower centre panel. */
function EngineKnobs({ id = "" }: { id?: string }) {
  const s = useC182((x) => x.s),
    up = useC182((x) => x.update),
    g = s.eng;
  return (
    <>
      <Slider
        id={"thr" + id}
        label="Throttle (black knob)"
        min={0}
        max={1}
        step={0.005}
        value={g.throttle}
        onChange={(v) =>
          up((d) => {
            d.eng.throttle = v;
          })
        }
        fmt={thr}
      />
      <Slider
        id={"prop" + id}
        label="PROPELLER (blue knob) — PUSH INCR RPM"
        min={0}
        max={1}
        step={0.005}
        value={g.prop}
        onChange={(v) => {
          cancelPropCycle();
          up((d) => {
            d.eng.prop = v;
          });
        }}
        fmt={propFmt}
      />
      <Slider
        id={"mix" + id}
        label="Mixture (red knob)"
        min={0}
        max={1}
        step={0.005}
        value={g.mix}
        onChange={(v) =>
          up((d) => {
            d.eng.mix = v;
          })
        }
        fmt={mixFmt}
      />
    </>
  );
}

export function Engine() {
  useTicker(150);
  const s = useC182((x) => x.s),
    E = useC182((x) => x.E),
    up = useC182((x) => x.update);
  const g = s.eng,
    alt = live.fs.alt;
  const lam = lambda(g.mix, alt),
    P = g.running ? powerFrac(s, live.map, live.rpm, alt) : 0;
  const state = g.running
    ? live.primeRun > 0
      ? [g.mix < 0.06 ? "RUNNING ON PRIME — ADVANCE MIXTURE" : "TOO LEAN — DYING", "warnc"]
      : "RUNNING"
    : g.mags === "START"
      ? E.starterPwr
        ? ["CRANKING", "warnc"]
        : ["START — NO STARTER POWER", "bad"]
      : g.flooded
        ? ["FLOODED", "bad"]
        : ["STOPPED", "bad"];
  const warm = live.hot > 0.6;
  const steps: [boolean, string][] = [
    [!s.elec.avn1 && !s.elec.avn2, "AVIONICS (BUS 1 and BUS 2) OFF"],
    [g.cowl > 0.97, "Cowl flaps OPEN"],
    [s.fuel.sel === "BOTH", "FUEL SELECTOR valve BOTH"],
    [g.throttle > 0.04 && g.throttle < 0.2, "Throttle OPEN ¼ INCH"],
    [g.prop > 0.97, "PROPELLER HIGH RPM (push full in)"],
    [g.mix <= 0.05 || g.running, "Mixture IDLE CUTOFF"],
    [
      s.elec.stby === "ARM" && E.pfd,
      "STBY BATT: TEST 20 s (the green lamp must not go off), then ARM — the PFD comes on",
    ],
    [E.gea, "Engine Indicating System: no red X through the ENGINE page indicators"],
    // checked before the MASTER goes on; once it is on (or the engine runs) these stay ticked
    [
      s.elec.stby === "ARM" && E.eBus != null && E.eBus >= 24 && (s.elec.bat || g.running || (E.mBus ?? 0) <= 1.5),
      "BUS E ≥ 24 V and M BUS ≤ 1.5 V shown",
    ],
    [
      s.elec.stby === "ARM" && (s.elec.bat || g.running || E.sBatt < 0),
      "BATT S amps discharge (negative) and the STBY BATT annunciator shown",
    ],
    [s.elec.bat || g.running, "Propeller area CLEAR (people and equipment at a safe distance)"],
    [s.elec.bat && s.elec.alt, "MASTER (ALT and BAT) ON"],
    [s.lights.beacon, "BEACON ON"],
    [
      live.wet > 0.3 || g.running || warm,
      `Prime: FUEL PUMP ON, mixture FULL RICH until stable fuel flow (3–5 s), then IDLE CUTOFF and FUEL PUMP OFF${warm ? " — engine warm: omit" : ""}`,
    ],
    [!s.fuel.pump || g.running, "FUEL PUMP OFF"],
    [g.running, "MAGNETOS START — release when the engine starts"],
    [g.running && g.mix > 0.9, "Mixture ADVANCE SMOOTHLY TO RICH"],
    [g.running && live.oilP >= 50, "Oil pressure in the green within 30–60 s"],
    [g.running && E.mBatt > 0 && !E.lowVolts, "AMPS (M BATT and BATT S) charging, LOW VOLTS not shown"],
  ];
  return (
    <>
      <p className="lead">
        Lycoming IO-540-AB1A5: six cylinders, horizontally opposed, fuel injected, 230 BHP at 2,400 RPM, driving a
        three-blade constant-speed McCauley propeller. Throttle, PROPELLER and mixture are push-pull knobs in the lower
        centre panel; two magnetos fire two plugs per cylinder. There is no primer — prime with the electric FUEL PUMP —
        and no carburetor heat: the alternate air door opens by itself. Cowl flaps at the bottom aft edge of the cowl
        are set from a lever on the pedestal (POH 7-27 – 7-37).
      </p>
      <H3>Scenarios</H3>
      <Ctl>
        <Scenarios />
      </Ctl>
      <H3>Engine controls</H3>
      <Ctl>
        <MagSwitch />
        <EngineKnobs />
        <Slider
          id="cowl"
          label="Cowl flap lever (pedestal)"
          min={0}
          max={1}
          step={0.05}
          value={g.cowl}
          onChange={(v) =>
            up((d) => {
              d.eng.cowl = v;
            })
          }
          fmt={cowlFmt}
        />
        <Check
          id="fpump"
          label="FUEL PUMP switch ON (aux pump)"
          checked={s.fuel.pump}
          onChange={(v) =>
            up((d) => {
              d.fuel.pump = v;
            })
          }
        />
        <Seg
          id="eis"
          label="EIS page (ENGINE softkey)"
          options={
            [
              ["ENGINE", "ENGINE"],
              ["SYSTEM", "SYSTEM"],
            ] as [EisPage, string][]
          }
          value={s.avx.eisPage}
          onChange={(v) =>
            up((d) => {
              d.avx.eisPage = v;
            })
          }
        />
        <Readouts
          items={[
            ["Engine", state as [string, "bad" | "warnc"] | string],
            ["RPM", [rpm10(), live.rpm >= 2472 ? "bad" : ""]],
            ["MAN IN", live.map.toFixed(1)],
            ["FFLOW GPH", live.ff.toFixed(1)],
            ["Power", g.running ? pct(P) : "—"],
            ["OIL PRES", [`${Math.round(live.oilP)} psi`, live.oilP <= 20 ? "bad" : ""]],
            ["OIL TEMP", [`${Math.round(live.oilT)} °F`, live.oilT >= 245 ? "bad" : ""]],
            ["CHT", [`${Math.round(live.cht)} °F · cyl ${live.hotCyl}`, live.cht >= 500 ? "bad" : ""]],
            ["EGT", `${Math.round(live.egt)} °F`],
            [
              "Fuel/air",
              g.running
                ? lam > 1.08
                  ? "Rich of peak"
                  : lam > 0.95
                    ? "Near peak EGT"
                    : ["Lean of peak", "warnc"]
                : "—",
            ],
            [
              "Cylinders",
              g.running
                ? warm
                  ? "Warm"
                  : "Warming up"
                : live.wet > 1.9
                  ? ["FLOODED", "bad"]
                  : live.wet > 0.3
                    ? "Primed"
                    : warm
                      ? "Warm"
                      : "Dry",
            ],
          ]}
        />
      </Ctl>
      <Small>
        Full-throttle static RPM is about 2,350–2,400 and idle about 650 (POH 4-31, 4-32). Too much priming floods the
        engine: FUEL PUMP OFF, mixture IDLE CUTOFF, throttle ½ to full, crank; when it fires, mixture FULL RICH and
        retard the throttle (POH 4-13, 4-27). A warm engine (within 20–30 minutes of shutdown) needs no priming.
        Temperatures and fuel flow are a teaching model; cowl flaps and airspeed change CHT and oil temperature.
      </Small>
      <H3>Starting with battery (POH 4-12 – 4-14)</H3>
      <ol className="notes">
        {steps.map(([ok, t]) => (
          <li key={t} style={{ color: ok ? "var(--ink)" : "var(--muted)" }}>
            {tick(ok)}
            {t}
          </li>
        ))}
      </ol>
      {!g.running && live.crankTotal > 10 && (
        <Caution title="Starter limit">
          Crank no more than 10 seconds, then let the starter cool 20 seconds; after three cycles cool it 10 minutes
          (POH 4-28).
        </Caution>
      )}
      {g.running && s.ground && g.cowl < 0.5 && (
        <Caution title="Cowl flaps">
          The engine is closely cowled: on the ground keep the cowl flaps open and point the airplane into the wind to
          avoid overheating (POH 4-31).
        </Caution>
      )}
      <H3>Failures</H3>
      <Ctl>
        <BtnRow>
          <Check
            id="magL"
            label="Left magneto dead"
            checked={g.fail.magL}
            onChange={(v) =>
              up((d) => {
                d.eng.fail.magL = v;
              })
            }
          />
          <Check
            id="magR"
            label="Right magneto dead"
            checked={g.fail.magR}
            onChange={(v) =>
              up((d) => {
                d.eng.fail.magR = v;
              })
            }
          />
          <Check
            id="edp"
            label="Engine-driven fuel pump fails"
            checked={g.fail.edp}
            onChange={(v) =>
              up((d) => {
                d.eng.fail.edp = v;
              })
            }
          />
          <Check
            id="filt"
            label="Induction filter blocked (ice)"
            checked={g.filter}
            onChange={(v) =>
              up((d) => {
                d.eng.filter = v;
              })
            }
          />
          <Check
            id="oil"
            label="Loss of oil"
            checked={g.fail.oil}
            onChange={(v) =>
              up((d) => {
                d.eng.fail.oil = v;
              })
            }
          />
          <Check
            id="gov"
            label="Governor fails (no oil to the hub)"
            checked={g.fail.gov}
            onChange={(v) =>
              up((d) => {
                d.eng.fail.gov = v;
              })
            }
          />
        </BtnRow>
      </Ctl>
      {g.fail.oil && (
        <Caution title="Low oil pressure (POH 3-32)">
          OIL PRESSURE on: confirm on OIL PRES / OIL PSI. Pressure and temperature normal: suspect the sender or relief
          valve — land at the nearest airport. Total loss of oil pressure with rising oil temperature: the engine may be
          about to fail — reduce power immediately, select a field suitable for a forced landing and use only the
          minimum power needed to reach it.
        </Caution>
      )}
      <Small>
        Engine-driven pump failure: FFLOW drops suddenly just before the power loss — FUEL PUMP ON restores enough fuel
        for maximum continuous power (POH 3-31). Engine failure in flight: 76 KIAS, selector BOTH, FUEL PUMP ON, mixture
        RICH, MAGNETOS BOTH (START if the propeller has stopped) — a windmilling propeller restarts it within a few
        seconds — then FUEL PUMP OFF (back ON if FFLOW drops to zero: engine-driven pump failure) (POH 3-6, 3-7).
        Blocked filter: the alternate air door opens, ≈ 10% power loss at full throttle; hold manifold pressure with the
        throttle (POH 7-35, 3-29).
      </Small>
      <H3>Ignition</H3>
      <Facts
        rows={[
          ["Right magneto", "Lower right + upper left plugs (POH 7-35)"],
          ["Left magneto", "Lower left + upper right plugs"],
          ["MAGNETOS", "OFF – R – L – BOTH – START (springs back to BOTH)"],
          ["Starter", "Front of the engine; relay in the J-box, coil fed through WARN (CROSSFEED BUS)"],
          ["Mag check", "1,800 RPM: ≤ 175 RPM drop each, ≤ 50 RPM between (POH 4-17)"],
          ["No drop", "Faulty ground (hot mag) or timing set in advance"],
        ]}
      />
      <H3>Engine data (POH 1-5, 2-6, 7-27 – 7-37)</H3>
      <Facts
        rows={[
          ["Rating", "230 BHP @ 2,400 RPM (maximum for takeoff and continuous)"],
          [
            "Oil",
            "8 qt sump, 9 qt total (POH 1-7, 8-14; placard OIL 9 QTS) · never less than 4 qt · 8 qt for flights under 3 h, 9 qt for extended flight (POH 7-34). Section 7 (p. 7-34) states the sump as 9 qt plus 1 qt in the filter; Sections 1 and 8 and the placard govern",
          ],
          ["Oil pressure", "Red 0–20 · green 50–90 · red 115–120 PSI"],
          ["Oil temperature", "Green 100–245 °F · red 245"],
          ["MAN IN", "Green 15–23 in.Hg"],
          ["Tachometer", "Green 2,000–2,400 · red 2,400–2,700; turns red and flashes at 2,472 RPM"],
          ["CHT · EGT", "CHT red line 500 °F; CHT 3 is required; the pointers carry the hottest cylinder number"],
          ["Cooling", "Two front inlets, baffles, exit through the cowl flaps at the bottom aft edge"],
          [
            "Induction",
            "Lower-front intake → filter → air box (alternate air door) → fuel/air control unit under the engine",
          ],
          [
            "Exhaust",
            "Risers → collector and muffler each side → single tailpipe; a heater shroud around each muffler",
          ],
        ]}
      />
      <H3>Power and leaning</H3>
      <Notes
        items={[
          "Cruise: 15–23 in.Hg at 2,000–2,400 RPM, no more than 80% power recommended; cowl flaps CLOSED (POH 4-20).",
          "Use FULL RICH above 80% power. At or below, lean on the EGT (LEAN page): Lycoming hasn't approved fuel flows leaner than needed to reach peak EGT in the leanest cylinder (POH 4-37).",
          "Climb: 85–95 KIAS, 23 in.Hg or full throttle, 2,400 RPM, 15 GPH or full rich, cowl flaps as required (POH 4-20). Above 5,000 ft, match the Maximum Power Fuel Flow placard for takeoff.",
          "Fuel flow fluctuating 1 GPH or more, or power surges: FUEL PUMP ON, adjust the mixture, try the opposite tank (POH 3-13).",
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("engine")} />
    </>
  );
}

export function Propeller() {
  useTicker(150);
  useEffect(() => cancelPropCycle, []);
  const s = useC182((x) => x.s),
    up = useC182((x) => x.update);
  const g = s.eng,
    ias = s.ground ? 0 : live.fs.ias,
    gov = govRpm(g.prop);
  const governing = g.running && !g.fail.gov && live.blade > 15.2;
  const P = g.running ? powerFrac(s, live.map, live.rpm, live.fs.alt) : 0;
  const cycle = () => {
    up((d) => {
      d.eng.prop = 0;
    });
    startPropCycle(() =>
      useC182.getState().update((d) => {
        d.eng.prop = 1;
      }),
    );
  };
  return (
    <>
      <p className="lead">
        A McCauley B3D36C431/80VSA-1: three all-metal blades, 79 inches, constant speed and hydraulically actuated. The
        blue PROPELLER knob sets the governor; the governor pumps engine oil into the hub piston to twist the blades
        toward high pitch (lower RPM), and lets it out so centrifugal force and a spring twist them back toward low
        pitch (higher RPM). The throttle then sets manifold pressure while the RPM stays put (POH 7-37).
      </p>
      <H3>Try it</H3>
      <Ctl>
        <EngineKnobs id="2" />
        <Slider
          id="pitch2"
          label="Control wheel (pitch → airspeed)"
          min={-1}
          max={1}
          step={0.01}
          value={s.ctrl.pitch}
          onChange={(v) =>
            up((d) => {
              d.ctrl.pitch = v;
            })
          }
          fmt={(v) => (v > 0.02 ? "Pull · climb" : v < -0.02 ? "Push · descend" : "Neutral")}
        />
        <BtnRow>
          <button type="button" className="btn" disabled={!g.running} onClick={cycle}>
            Run-up: cycle the propeller
          </button>
        </BtnRow>
        <Readouts
          items={[
            ["RPM", [rpm10(), live.rpm >= 2472 ? "bad" : ""]],
            ["Governor set", String(Math.round(gov / 10) * 10)],
            ["MAN IN", live.map.toFixed(1)],
            ["Blade angle", `${live.blade.toFixed(1)}°`],
            [
              "State",
              !g.running
                ? "—"
                : g.fail.gov
                  ? ["NO GOVERNOR — low pitch", "bad"]
                  : governing
                    ? "Governing"
                    : ["On the low-pitch stop", "warnc"],
            ],
            ["IAS", `${Math.round(ias)} KT`],
            ["Power", g.running ? pct(P) : "—"],
          ]}
        />
      </Ctl>
      <Small>
        Blade angle at the 30-inch station: 14.9° (low-pitch stop) to 31.7° (high pitch) (POH 1-5). Below the governed
        RPM — at idle, or with little power — the blades sit on the low-pitch stop and the propeller acts like a
        fixed-pitch one. Governor range here: 2,400 RPM full in down to ≈ 1,500 full out (the low end is an assumption).
        A failed governor lets the blades go to low pitch, so RPM follows throttle and airspeed and can overspeed (an
        inference from POH 7-37).
      </Small>
      <H3>Using it</H3>
      <Notes
        items={[
          "Takeoff and climb: 2,400 RPM, PROPELLER full in (POH 4-19).",
          "Run-up at 1,800 RPM: cycle the propeller from high to low RPM and back to high (full in) — it checks the governor and puts warm oil in the hub (POH 4-17).",
          "Cruise 15–23 in.Hg at 2,000–2,400 RPM, no more than 80% power recommended (POH 4-20).",
          "General constant-speed practice, not stated in the POH: to reduce power, throttle first, then RPM; to increase power, RPM first, then throttle.",
          "Before landing and for a balked landing: PROPELLER HIGH RPM (push full in) (POH 4-22, 4-23).",
          "Ice: if vibration builds, momentarily reduce to 2,200 RPM with the propeller control, then move it rapidly forward to shed ice (POH 3-12).",
        ]}
      />
      <Facts
        rows={[
          ["Model", "McCauley B3D36C431/80VSA-1, oil-filled hub"],
          ["Diameter", "79.0 in (POH 1-5, 2-6); minimum 77.5 in per the 2007 edition (GFC 2-6) and TCDS 3A13"],
          ["Blades", "3, all metal, constant speed"],
          ["Pitch", "14.9° low · 31.7° high at the 30-in station"],
          ["Governor", "C161031-0119, arm −42.5, oil from the left gallery"],
          ["Ground clearance", "10 7/8 in"],
          ["Spinner", "D-7261-2, arm −49.9"],
          ["Care", "Check for nicks and red oil leaks; never alkaline cleaners (POH 4-10, 8-23)"],
        ]}
      />
      <PartsList parts={CAT.pinned("propeller")} />
    </>
  );
}

export function Fuel() {
  useTicker(400);
  const s = useC182((x) => x.s),
    E = useC182((x) => x.E),
    up = useC182((x) => x.update);
  const f = s.fuel,
    iL = fuelInd(f.qL),
    iR = fuelInd(f.qR);
  const feeding = f.sel === "OFF" ? ["OFF", "bad"] : !E.fuelOk ? ["DRY TANK", "bad"] : f.sel;
  const retTo =
    !s.eng.running || f.sel === "OFF"
      ? "—"
      : f.sel === "BOTH"
        ? "Both tanks"
        : f.sel === "LEFT"
          ? "Left tank only"
          : "Right tank only";
  const lowSel = (f.sel === "LEFT" && f.qL <= QUARTER_TANK) || (f.sel === "RIGHT" && f.qR <= QUARTER_TANK);
  return (
    <>
      <p className="lead">
        Two vented integral wing tanks feed through fuel manifolds in the aft door posts to a dual-stack, four-position
        selector (BOTH, RIGHT, LEFT, OFF), then the electric auxiliary pump, the strainer, the engine-driven pump, the
        fuel/air control unit, the flow transducer and the flow divider on top of the engine to six injector nozzles. A
        return line takes about 7 GPH of fuel and vapor from the servo back through the top of the selector — only to
        the tank(s) selected (POH 7-38 – 7-46, Figure 7-6).
      </p>
      <H3>Try it</H3>
      <Ctl>
        <Seg
          id="fsel"
          label="FUEL SELECTOR (push down to rotate to OFF)"
          options={
            [
              ["LEFT", "LEFT"],
              ["BOTH", "BOTH"],
              ["RIGHT", "RIGHT"],
              ["OFF", "OFF"],
            ] as [FuelSel, string][]
          }
          value={f.sel}
          onChange={(v) =>
            up((d) => {
              d.fuel.sel = v;
            })
          }
        />
        <Check
          id="pump"
          label="FUEL PUMP ON"
          checked={f.pump}
          onChange={(v) =>
            up((d) => {
              d.fuel.pump = v;
            })
          }
        />
        <Check
          id="slip"
          label="Prolonged slip or skid (uncoordinated flight)"
          checked={f.slip}
          onChange={(v) =>
            up((d) => {
              d.fuel.slip = v;
            })
          }
        />
        <Slider
          id="qL"
          label="Left tank (usable)"
          min={0}
          max={43.5}
          step={0.1}
          value={f.qL}
          onChange={(v) =>
            up((d) => {
              d.fuel.qL = v;
            })
          }
          fmt={(v) => v.toFixed(1) + " gal"}
        />
        <Slider
          id="qR"
          label="Right tank (usable)"
          min={0}
          max={43.5}
          step={0.1}
          value={f.qR}
          onChange={(v) =>
            up((d) => {
              d.fuel.qR = v;
            })
          }
          fmt={(v) => v.toFixed(1) + " gal"}
        />
        <BtnRow>
          {(
            [
              ["Full · 87", 43.5, 43.5],
              ["Tabs · 64", 32, 32],
              ["Low · 6 / 7", 6, 7],
              ["Imbalance", 30, 15],
            ] as const
          ).map(([t, l, r]) => (
            <button
              key={t}
              type="button"
              className="btn"
              onClick={() => {
                live.timers.lowL = live.timers.lowR = 0;
                up((d) => {
                  d.fuel.qL = l;
                  d.fuel.qR = r;
                });
              }}
            >
              {t}
            </button>
          ))}
          <button
            type="button"
            className="btn"
            onClick={() => {
              live.galUsed = 0;
              live.galStart = Math.round(useC182.getState().s.fuel.qL + useC182.getState().s.fuel.qR);
            }}
          >
            RST FUEL (2005 POH: RST USED)
          </button>
        </BtnRow>
        <Readouts
          items={[
            ["Gauge L / R", [`${iL.toFixed(0)} / ${iR.toFixed(0)}`, iL < 8 || iR < 8 ? "warnc" : ""]],
            ["Usable total", (f.qL + f.qR).toFixed(1)],
            ["Feeding", feeding as [string, "bad"] | string],
            ["Return to", retTo],
            ["FFLOW", `${live.ff.toFixed(1)} GPH`],
            ["GAL USED / REM", `${live.galUsed.toFixed(1)} / ${Math.max(0, live.galStart - live.galUsed).toFixed(0)}`],
            ["Aux pump", f.pump ? (E.fuelPumpOn ? "Running" : ["NO PWR", "bad"]) : "Off"],
            [
              "LOW FUEL",
              s.ann.lowFuelL || s.ann.lowFuelR
                ? ["SHOWN", "warnc"]
                : iL < 8 || iR < 8
                  ? `in ${Math.max(0, 60 - Math.max(live.timers.lowL, live.timers.lowR)).toFixed(0)} s`
                  : "—",
            ],
            [
              "Unporting",
              live.unport > 0 ? [`${live.unport.toFixed(0)} s`, "bad"] : f.slip && lowSel ? ["RISK", "warnc"] : "—",
            ],
          ]}
        />
      </Ctl>
      <Small>
        The gauges read 0 with 2.5 gal unusable left and stop at about 36 gal (top of the green arc) — check the tanks
        visually before every flight (POH 7-40). LOW FUEL L / R come on below 8 gal indicated after 60 seconds. The
        totalizer (SYSTEM page) counts fuel flow only, from the last RST FUEL — not the tank sensors. With ¼ tank or
        less, a prolonged slip on that tank can uncover the outlet and stop the engine; on BOTH a dry tank can do the
        same. Burn is split evenly on BOTH here (the POH notes it may not be, if the wings aren&apos;t level).
      </Small>
      <H3>Annunciations &amp; gauge</H3>
      <Facts
        rows={[
          ["LOW FUEL L / R", "Amber, single tone: < 8 gal indicated for > 60 s; pointer and label turn steady amber"],
          [
            "Empty",
            "At the calibrated usable-empty level the pointer and label flash red; the annunciation stays amber",
          ],
          ["Gauge markings", "Red 0 · yellow 0–8 · green 8–35 gal (POH 2-7)"],
          ["Sensor failure", "Red X through the top (left) or bottom (right) of the gauge"],
          ["Takeoff", "Not recommended with both pointers in the yellow or any LOW FUEL shown (POH 7-41)"],
        ]}
      />
      <Caution title="Limitations">
        Takeoff, climb, landing and slips over 30 s on BOTH; LEFT or RIGHT for cruise only. With ¼ tank (10.9 gal) or
        less, no prolonged uncoordinated flight on that tank; maximum 30 s of slip or skid with one tank dry (POH 2-14,
        7-44).
      </Caution>
      <H3>Capacities</H3>
      <Facts
        rows={[
          ["Total", "92.0 gal · 46.0 per tank"],
          ["Usable", "87.0 gal · 43.5 per tank"],
          ["To the filler tabs", "64.0 gal usable · 32.0 per tank"],
          ["Unusable", "5.0 gal (2.5 per tank), 30 lb at FS 48.0"],
          ["Grades", "100LL (blue) or 100 (green)"],
          ["Fuel CG", "FS 46.50"],
          ["AP imbalance limit", "90 lb (15 gal) with the KAP 140 engaged"],
        ]}
      />
      <H3>Using it</H3>
      <Notes
        items={[
          "Priming: FUEL PUMP ON with the mixture FULL RICH until stable fuel flow (3–5 s), then IDLE CUTOFF and FUEL PUMP OFF. Left on with the MASTER on, mixture rich and the engine stopped, it floods the engine (POH 4-13, 7-43).",
          "Not needed for normal takeoff and landing; ON for vapor (hot days, long taxi), fuel-flow fluctuations, or an engine-driven pump failure (POH 7-43, 3-13).",
          "Wing heaviness on BOTH: select the tank in the heavy wing until it evens out. Park and refuel with the selector on LEFT or RIGHT to stop crossfeeding through the vent line (POH 7-44, 7-45).",
          "Drain every tank sump, the return-line drain, the selector drain and the strainer (lower right cowling) before each flight and after refueling (POH 7-45, 4-10).",
          "Engine fire in flight: mixture IDLE CUTOFF, selector PUSH DOWN and ROTATE to OFF, FUEL PUMP OFF (POH 3-10).",
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("fuel")} />
    </>
  );
}
