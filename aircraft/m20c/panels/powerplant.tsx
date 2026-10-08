"use client";
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
  Rocker,
  Seg,
  Slider,
  Small,
  useTicker,
} from "@/components/ui/controls";
import { bladeAngle, fuelAvail, govRpm, govRpmFor, live, type Key, type Sim } from "../model";
import { CAT } from "../parts";
import { primeThrottle, scenarioRamp, useM20C } from "../store";
import { START_HOLD } from "../tick";

const pct = (v: number) => Math.round(v * 100) + "%";
const rpm10 = () => String(Math.round(live.rpm / 10) * 10);
const fails = (s: Sim, up: (fn: (d: Sim) => void) => void) => (
  <div className="row">
    <div className="lbl">
      <span>Failures</span>
    </div>
    <BtnRow>
      <Check
        id="fGov"
        label="Governor fails"
        checked={s.eng.fail.governor}
        onChange={(v) =>
          up((d) => {
            d.eng.fail.governor = v;
          })
        }
      />
      <Check
        id="fOil"
        label="Oil leak (pressure lost)"
        checked={s.eng.fail.oilLeak}
        onChange={(v) =>
          up((d) => {
            d.eng.fail.oilLeak = v;
          })
        }
      />
      <Check
        id="fMech"
        label="Engine-driven fuel pump fails"
        checked={s.eng.fail.mechPump}
        onChange={(v) =>
          up((d) => {
            d.eng.fail.mechPump = v;
          })
        }
      />
      <Check
        id="fIce"
        label="Carburetor icing conditions"
        checked={s.eng.fail.carbIce}
        onChange={(v) =>
          up((d) => {
            d.eng.fail.carbIce = v;
          })
        }
      />
      <Check
        id="fStart"
        label="Starter stays engaged"
        checked={s.eng.fail.starterStuck}
        onChange={(v) =>
          up((d) => {
            d.eng.fail.starterStuck = v;
          })
        }
      />
    </BtnRow>
  </div>
);

export function Engine() {
  useTicker(150);
  const s = useM20C((x) => x.s),
    E = useM20C((x) => x.E),
    up = useM20C((x) => x.update);
  const g = s.eng;
  const flooded = live.prime > 4.5;
  return (
    <>
      <p className="lead">
        A Lycoming O-360-A1D: four cylinders, horizontally opposed, air cooled, 180 hp at 2,700 RPM, with an updraft
        Marvel-Schebler carburetor under the sump. Three push-pull controls on the centre panel — throttle,
        hexagon-knobbed mixture and propeller — plus carburetor heat and the magneto/starter switch. There is no primer:
        with the boost pump on and the mixture rich, pumping the throttle twice primes it through the accelerator pump.
        Starting is by a shower of sparks: the left magneto's retard points and a vibrator on the firewall fire while
        the key is pushed in.
      </p>
      <H3>Engine controls</H3>
      <Ctl>
        <div className="switches">
          <Rocker
            label="MASTER"
            on={s.elec.master}
            onToggle={() =>
              up((d) => {
                d.elec.master = !d.elec.master;
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
            label="BEACON"
            on={s.sw.beacon}
            onToggle={() =>
              up((d) => {
                d.sw.beacon = !d.sw.beacon;
              })
            }
          />
        </div>
        <Seg
          id="key"
          label="Magneto / starter switch"
          options={
            [
              ["OFF", "OFF"],
              ["R", "R"],
              ["L", "L"],
              ["BOTH", "BOTH"],
              ["START", "START (push)"],
            ] as [Key, string][]
          }
          value={g.key}
          onChange={(v) => {
            if (v === "START") live.startTimer = START_HOLD;
            up((d) => {
              d.eng.key = v;
            });
          }}
        />
        <Slider
          id="thr"
          label="Throttle (push-pull)"
          min={0}
          max={1}
          step={0.01}
          value={g.throttle}
          onChange={(v) =>
            up((d) => {
              d.eng.throttle = v;
            })
          }
          fmt={(v) => (v < 0.02 ? "CLOSED" : v > 0.98 ? "FULL" : pct(v))}
        />
        <BtnRow>
          <HoldButton className="btn" onDown={primeThrottle} disabled={g.running}>
            Pump the throttle (prime)
          </HoldButton>
        </BtnRow>
        <Slider
          id="mix"
          label="Mixture — hexagon knob (idle cut-off → rich)"
          min={0}
          max={1}
          step={0.01}
          value={g.mix}
          onChange={(v) =>
            up((d) => {
              d.eng.mix = v;
            })
          }
          fmt={(v) => (v <= 0.05 ? "IDLE CUT-OFF" : v > 0.97 ? "FULL RICH" : "Leaned " + pct(v))}
        />
        <Slider
          id="prop"
          label="Propeller control (low → high RPM)"
          min={0}
          max={1}
          step={0.01}
          value={g.prop}
          onChange={(v) =>
            up((d) => {
              d.eng.prop = v;
            })
          }
          fmt={(v) => (v > 0.98 ? "HIGH RPM (full in)" : govRpmFor(v) + " RPM")}
        />
        <Slider
          id="carb"
          label="Carburetor heat (push = cold)"
          min={0}
          max={1}
          step={0.05}
          value={g.carbHeat}
          onChange={(v) =>
            up((d) => {
              d.eng.carbHeat = v;
            })
          }
          fmt={(v) => (v < 0.03 ? "COLD" : v > 0.97 ? "FULL HOT" : "Partial " + pct(v))}
        />
        {fails(s, up)}
        <Readouts
          items={[
            [
              "Engine",
              g.running
                ? live.fireT >= 0
                  ? ["FIRING", "warnc"]
                  : "RUNNING"
                : E.starterOn
                  ? ["CRANKING", "warnc"]
                  : ["STOPPED", "bad"],
            ],
            ["RPM", [rpm10(), live.rpm > 2700 ? "bad" : live.rpm > 1990 && live.rpm < 2260 ? "warnc" : ""]],
            ["Man press", live.map.toFixed(1) + " in"],
            ["Fuel flow", live.ff.toFixed(1) + " gph"],
            ["Oil press", [live.oilP.toFixed(0) + " psi", live.oilP < 25 ? "bad" : live.oilP < 60 ? "warnc" : ""]],
            ["Oil temp", [live.oilT.toFixed(0) + " °F", live.oilT > 245 ? "bad" : ""]],
            ["CHT", [live.cht.toFixed(0) + " °F", live.cht > 500 ? "bad" : live.cht > 450 ? "warnc" : ""]],
            ["Fuel press", [live.fuelP.toFixed(1) + " psi", live.fuelP < 0.5 ? "bad" : ""]],
            ["Priming shots", flooded ? ["FLOODED", "bad"] : live.prime > 0.2 ? live.prime.toFixed(1) : "—"],
            [
              "Carb ice",
              live.carbIce > 0.02
                ? [Math.round(live.carbIce * 100) + "%", live.carbIce > 0.3 ? "bad" : "warnc"]
                : "None",
            ],
            [
              "Starter",
              live.crankT > 15 ? ["> 15 s — let it cool", "bad"] : E.starterOn ? live.crankT.toFixed(1) + " s" : "—",
            ],
          ]}
        />
        <BtnRow>
          <button type="button" className="btn" onClick={scenarioRamp}>
            Reset: cold &amp; dark on the ramp
          </button>
        </BtnRow>
      </Ctl>
      <Small>
        Starting needs the master on (for the vibrator), fuel in the selected tank, the boost pump on, one to four
        priming pumps of the throttle with the mixture rich, then START pushed in for up to {START_HOLD} s. More than
        about four pumps floods it: then crank with the mixture in idle cut-off and the throttle half open. The magnetos
        keep the engine running with the master off (OM p. 3).
      </Small>
      <H3>Starting (OM p. 15–16; Ranger 3-7)</H3>
      <ol className="notes">
        {[
          "Fuel selector on the fullest tank; radios and electrical switches off; brakes on.",
          "Carburetor heat cold. Mixture full rich, propeller full forward (high RPM).",
          "Master ON — green gear light and the Low Vacuum light come on.",
          "Boost pump ON — note the fuel pressure.",
          "Pump the throttle twice (three or four when cold), then set it about ¼ in open.",
          "Turn the switch to START and push in. When it fires, hold another second, then let it spring back to BOTH.",
          "Oil pressure within 30 seconds or shut down. Warm up at 1,000–1,200 RPM.",
        ].map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <H3>Markings (OM Part V; TCDS 2A3)</H3>
      <Facts
        rows={[
          [
            "Tachometer",
            "red line 2,700 · green 2,300–2,700 · wide green 2,300–2,500 · red arc 2,000–2,250 (no continuous operation — Hartzell placards 2,100–2,350)",
          ],
          ["Oil pressure", "min 25 · idling 25–60 yellow · green 60–90 · start/warm-up 90–100 yellow · max 100 psi"],
          ["Oil temperature", "green 100–225 · red 245 °F"],
          ["CHT", "green 350–450 · red 500 °F"],
          ["Fuel pressure", "0.5–6.0 psi · normal 2.5–3.5"],
          ["Mag check", "1,700 RPM, max drop 125 (OM p. 18)"],
          ["Prop exercise", "1,800–2,000 RPM, control full out until 100 RPM drop, then full in"],
        ]}
      />
      <H3>Engine data</H3>
      <Facts
        rows={[
          ["Type", "O-360-A1D · 361 cu in · 8.7:1 · Dynafocal Lord mounts"],
          ["Carburetor", "Marvel-Schebler MA-4-5, updraft, accelerator pump = primer"],
          [
            "Ignition",
            "Two Bendix mags (S4LN-200 series); left has retard points; starting vibrator on the upper firewall; shielded plugs",
          ],
          [
            "Oil",
            "8 qt wet sump, 6 min for flight, add at 6; 180 °F thermostat; cooler on the lower left cowl; filter optional (OM p. 2)",
          ],
          [
            "Cooling",
            "Downdraft baffles; cowl flaps fixed on the 1968 airplane (adjustable to 1967: open on the ground and in climb)",
          ],
          ["Fuel", "91/98 min as built, 100/130 OK — 100LL today; 80 octane never"],
          ["Climb", "2,500 RPM / 25 in; 115–120 mph enroute for cooling; Vy ≈ 105 mph (OM p. 19)"],
          [
            "Cruise",
            "Avoid 2,150–2,300 RPM; best economy 25 °F lean of peak EGT, best power 100 °F rich; never lean above 75 % (OM p. 20)",
          ],
          ["Shutdown", "1,000–1,200 RPM, mixture to idle cut-off, throttle closed, mags and master OFF (OM p. 24)"],
        ]}
      />
      {live.carbIce > 0.1 && (
        <Caution title="Carburetor ice">
          Manifold pressure is dropping and the engine is losing power. Apply full carburetor heat — partial heat can
          raise the air to icing temperature (OM p. 22). Expect roughness while the ice clears, then a small MP loss
          from the warm air.
        </Caution>
      )}
      {s.eng.fail.starterStuck && s.eng.running && (
        <Caution title="Starter stays engaged">
          Throttle closed, mixture idle cut-off, switches OFF: a starter that stays engaged will destroy itself and
          drain the battery.
        </Caution>
      )}
      <H3>Engine — tap to locate</H3>
      <PartsList parts={CAT.pinned("engine")} />
    </>
  );
}

export function Propeller() {
  useTicker(150);
  const s = useM20C((x) => x.s),
    up = useM20C((x) => x.update);
  const gov = govRpm(s);
  return (
    <>
      <p className="lead">
        A Hartzell two-blade compact-hub constant-speed propeller, 74 in, with a single-acting governor on the engine.
        The propeller control sets the governor's speeder spring; the governor then meters engine oil into the hub to
        raise blade angle, holding RPM whatever the throttle and airspeed. The hub is not counterweighted: lose the oil
        and a spring and the blades' own centrifugal twist drive them to fine pitch — full RPM, an overspeed tendency —
        the opposite of the counterweighted props on bigger engines.
      </p>
      <H3>Controls</H3>
      <Ctl>
        <Slider
          id="prop2"
          label="Propeller control (low → high RPM)"
          min={0}
          max={1}
          step={0.01}
          value={s.eng.prop}
          onChange={(v) =>
            up((d) => {
              d.eng.prop = v;
            })
          }
          fmt={(v) => (v > 0.98 ? "HIGH RPM" : govRpmFor(v) + " RPM")}
        />
        <Slider
          id="thr2"
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
          fmt={(v) => (v < 0.02 ? "CLOSED" : v > 0.98 ? "FULL" : pct(v))}
        />
        <Check
          id="fGov2"
          label="Governor fails (blades to low pitch)"
          checked={s.eng.fail.governor}
          onChange={(v) =>
            up((d) => {
              d.eng.fail.governor = v;
            })
          }
        />
        <Readouts
          items={[
            ["Governor target", s.eng.fail.governor || live.oilP < 20 ? ["NONE", "bad"] : gov.toLocaleString()],
            ["RPM", [rpm10(), live.rpm > 2700 ? "bad" : ""]],
            ["Blade angle", bladeAngle(s, live.rpm).toFixed(0) + "° at 30 in"],
            ["Man press", live.map.toFixed(1) + " in"],
          ]}
        />
      </Ctl>
      <Small>
        Below the governing range — idle and the run-up — the blades sit on the low-pitch stop and RPM follows the
        throttle. Increase power: RPM first, then manifold pressure; decrease: manifold pressure first, then RPM (OM p.
        20). The low-RPM end of the control is not in the manual (≈1,800 here); blade angle is illustrative between 13°
        and 29°.
      </Small>
      {(s.eng.fail.governor || live.oilP < 20) && s.eng.running && (
        <Caution title="Governor or oil failure">
          The blades have gone to low pitch: control RPM with the throttle and keep it under 2,700. A wavering
          tachometer with the prop control full in and RPM below 2,700 is the tach, not the governor (OM p. 26).
        </Caution>
      )}
      <H3>Hardware (TCDS 2A3; Hartzell 115N)</H3>
      <Facts
        rows={[
          ["Model", "Hartzell HC-C2YK-1B (or -1BF) hub, 7666A-2 blades; 53.75 lb at arm −30.16"],
          ["Diameter", "74 in (72.5 in minimum after repair)"],
          ["Pitch at 30 in", "Low 13° · high 29° ± 2°"],
          [
            "Governor",
            "Hartzell D-1-4 / H-1 family, single acting: oil to high pitch, spring + centrifugal twist to low",
          ],
          ["Clearance", "9½ in — low; landing mistakes become prop strikes"],
          [
            "Hub AD",
            "2006-18-15 / 2009-22-03: eddy-current inspection of non-suffix hubs every 100 h unless an A- or B-suffix hub is fitted",
          ],
          ["Alternate", "McCauley 2D34C53-A / 74E-0 with a Woodward governor (TCDS)"],
          ["Red arc", "2,000–2,250 RPM (TCDS) — the Hartzell sheet says 2,100–2,350; use the airplane's placard"],
        ]}
      />
      <H3>Operating notes</H3>
      <Notes
        items={[
          "Take-off and landing: propeller full forward. After take-off reduce to 2,550–2,600; climb 2,500 / 25 in (OM p. 19).",
          "Run-up: exercise the prop at 1,800–2,000 until the tach drops 100 (OM p. 18). Surging on take-off is air or dirt in the governor (OM p. 26).",
          "Check the blades for nicks before every flight; nicks deeper than about 0.010 in come out before the next flight (OM p. 26; Ranger 7-9).",
          "Blade end-play at rest is normal — centrifugal force seats the blades once turning (OM p. 26).",
          "Avoid high RPM on gravel and open the throttle slowly for take-off (OM p. 17, 19).",
        ]}
      />
      <H3>Propeller — tap to locate</H3>
      <PartsList parts={CAT.pinned("propeller")} />
    </>
  );
}

export function Fuel() {
  useTicker(250);
  const s = useM20C((x) => x.s),
    E = useM20C((x) => x.E),
    up = useM20C((x) => x.update);
  const f = s.fuel;
  return (
    <>
      <p className="lead">
        Two integral sealed bays in the forward inboard part of each wing, 26 gallons a side, feeding through a
        LEFT–OFF–RIGHT selector on the floor ahead of the pilot's seat — no BOTH, so you switch tanks. From the selector
        the fuel passes the electric boost pump and the engine-driven pump to the carburetor. The selector has its own
        sump: pull the ring beside the handle to drain it on each tank before the first flight.
      </p>
      <H3>Try it</H3>
      <Ctl>
        <Seg
          id="fsel"
          label="Fuel selector (floor)"
          options={[
            ["L", "LEFT"],
            ["OFF", "OFF"],
            ["R", "RIGHT"],
          ]}
          value={f.sel}
          onChange={(v) =>
            up((d) => {
              d.fuel.sel = v;
            })
          }
        />
        <Check
          id="fpump"
          label="FUEL PUMP switch-breaker ON"
          checked={s.sw.fuelPump}
          onChange={(v) =>
            up((d) => {
              d.sw.fuelPump = v;
            })
          }
        />
        <Slider
          id="qL"
          label="Left tank"
          min={0}
          max={26}
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
          label="Right tank"
          min={0}
          max={26}
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
              ["Full · 52", 26, 26],
              ["Half", 13, 13],
              ["Low · 3 / 5", 3, 5],
              ["One tank dry", 0, 14],
            ] as const
          ).map(([t, l, r]) => (
            <button
              key={t}
              type="button"
              className="btn"
              onClick={() =>
                up((d) => {
                  d.fuel.qL = l;
                  d.fuel.qR = r;
                })
              }
            >
              {t}
            </button>
          ))}
        </BtnRow>
        <Readouts
          items={[
            ["Gauges L / R", E.gaugesPwr ? `${f.qL.toFixed(0)} / ${f.qR.toFixed(0)}` : ["NO PWR", "bad"]],
            ["Total", (f.qL + f.qR).toFixed(1) + " gal"],
            [
              "Feeding",
              f.sel === "OFF"
                ? ["OFF", "bad"]
                : fuelAvail(s)
                  ? f.sel === "L"
                    ? "LEFT"
                    : "RIGHT"
                  : ["EMPTY TANK", "bad"],
            ],
            ["Boost pump", s.sw.fuelPump ? (E.fuelPump ? "ON" : ["NO PWR", "bad"]) : "OFF"],
            ["Fuel pressure", [live.fuelP.toFixed(1) + " psi", live.fuelP < 0.5 ? "bad" : ""]],
            [
              "Endurance",
              live.ff > 0.5 ? `≈ ${((f.qL + f.qR) / live.ff).toFixed(1)} h at ${live.ff.toFixed(1)} gph` : "—",
            ],
          ]}
        />
      </Ctl>
      <Small>
        Selecting OFF or an empty tank stops the engine after a few seconds. If a tank runs dry, retard the throttle
        before switching and restarting: an advanced throttle can overspeed the engine (OM p. 21). The gauges need the
        master switch (Ranger 2-5).
      </Small>
      {s.eng.running && s.eng.fail.mechPump && !E.fuelPump && (
        <Caution title="Engine-driven pump failed">
          Fuel pressure is falling. Boost pump ON — it is there to provide pressure if the engine-driven pump
          malfunctions (OM p. 3).
        </Caution>
      )}
      <H3>Fuel path (OM p. 3)</H3>
      <ol className="notes">
        {[
          "Integral bay in each wing root, forward of the main spar; sump drain under the wing near the root.",
          "Aluminium lines to the two-way positive-setting selector valve on the floor (LEFT / RIGHT / OFF) with its own sump and pull-ring drain.",
          "Electric boost pump under the floor behind the firewall: on for take-off, landing and priming.",
          "Through the firewall to the engine-driven diaphragm pump on the accessory case.",
          "Carburetor (updraft, under the sump); fuel pressure is read in this line, 0.5–6 psi.",
        ].map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <H3>Details</H3>
      <Facts
        rows={[
          ["Capacity", "2 × 26 US gal = 52 (48 on 1962–63 airplanes); 3.4 lb unusable (TCDS)"],
          [
            "Grade",
            "91/98 minimum as placarded (blue); 100/130 (green) acceptable; 100LL today. Never 80 octane (red)",
          ],
          ["Gauges", "Electric float senders in the tanks → engine cluster; master switch on"],
          ["Pressure", "Red 0.5 and 6.0 · green 0.5–6.0 · normal 2.5–3.5 psi"],
          ["Drains", "One under each tank (sampler cup prong) and the selector sump ring in the cabin"],
          ["Vents", "Overflow vents in each tank (OM p. 26); check unobstructed"],
          [
            "Fuel management",
            "Fly one tank an hour, switch, run the second dry and the first then has that time less an hour (OM p. 21)",
          ],
          ["Sideslips", "Avoid sustained slips toward the tank in use below 36 lb in it (Ranger 4-9)"],
          ["Reseal", "Sealant ages; stripping and resealing the bays is a major job; bladders are the alternative"],
        ]}
      />
      <H3>Notes</H3>
      <Notes
        items={[
          "Before start: selector on the fullest tank; before landing: fuller tank, boost pump on, mixture rich (OM p. 15, 23).",
          "After refuelling wait five minutes before sampling so water settles (Ranger 7-5).",
          "Boost pump off after take-off — and watch the fuel pressure hold, proving the engine pump (OM p. 19).",
          "Fuel tank selector drain ring: be sure it returns to OFF and sits in its recess (OM p. 15).",
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("fuel")} />
    </>
  );
}
