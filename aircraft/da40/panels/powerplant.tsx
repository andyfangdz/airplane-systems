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
  Seg,
  Slider,
  Small,
  useTicker,
} from "@/components/ui/controls";
import { bladeAngle, fuelAvail, govRpm, govRpmFor, live, type Key, type Sim } from "../model";
import { CAT } from "../parts";
import { scenarioRamp, useDA40 } from "../store";
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
        id="fStart"
        label="Starter stays engaged"
        checked={s.eng.fail.starterStuck}
        onChange={(v) =>
          up((d) => {
            d.eng.fail.starterStuck = v;
          })
        }
      />
      <Check
        id="fFuelHi"
        label="Fuel pressure high (pump regulation)"
        checked={s.eng.fail.fuelHi}
        onChange={(v) =>
          up((d) => {
            d.eng.fail.fuelHi = v;
          })
        }
      />
    </BtnRow>
  </div>
);

export function Engine() {
  useTicker(150);
  const s = useDA40((x) => x.s),
    E = useDA40((x) => x.E),
    up = useDA40((x) => x.update);
  const g = s.eng;
  const flooded = live.prime > 7;
  return (
    <>
      <p className="lead">
        A Lycoming IO-360-M1A: air-cooled, four cylinders horizontally opposed, direct drive, fuel injected, with an
        underslung exhaust. Three levers on the centre console — throttle, blue RPM lever and red mixture — plus the
        ignition key, the electric fuel pump and the manual ALTERNATE AIR lever. There is no primer: the electric pump
        with the mixture RICH primes the engine.
      </p>
      <H3>Engine controls</H3>
      <Ctl>
        <div className="switches">
          <Rocker
            label="BAT"
            on={s.elec.bat}
            onToggle={() =>
              up((d) => {
                d.elec.bat = !d.elec.bat;
              })
            }
          />
          <Rocker
            label="ALT"
            on={s.elec.alt}
            onToggle={() =>
              up((d) => {
                d.elec.alt = !d.elec.alt;
              })
            }
          />
          <Rocker
            label="STROBE"
            on={s.lights.strobe}
            onToggle={() =>
              up((d) => {
                d.lights.strobe = !d.lights.strobe;
              })
            }
          />
          <Rocker
            label="FUEL PUMP"
            on={s.fuel.pump}
            onToggle={() =>
              up((d) => {
                d.fuel.pump = !d.fuel.pump;
              })
            }
          />
        </div>
        <Seg
          id="key"
          label="Ignition key"
          options={
            [
              ["OFF", "OFF"],
              ["L", "L"],
              ["R", "R"],
              ["BOTH", "BOTH"],
              ["START", "START"],
            ] as [Key, string][]
          }
          value={g.key}
          onChange={(v) => {
            if (v === "START") {
              live.startTimer = START_HOLD;
            }
            up((d) => {
              d.eng.key = v;
            });
          }}
        />
        <Slider
          id="thr"
          label="Throttle (IDLE → MAX PWR)"
          min={0}
          max={1}
          step={0.01}
          value={g.throttle}
          onChange={(v) =>
            up((d) => {
              d.eng.throttle = v;
            })
          }
          fmt={(v) => (v < 0.02 ? "IDLE" : v > 0.98 ? "MAX PWR" : pct(v))}
        />
        <Slider
          id="rpmL"
          label="RPM lever — blue (LOW → HIGH)"
          min={0}
          max={1}
          step={0.01}
          value={g.rpmLever}
          onChange={(v) =>
            up((d) => {
              d.eng.rpmLever = v;
            })
          }
          fmt={(v) => (v > 0.98 ? "HIGH RPM" : govRpmFor(v) + " RPM")}
        />
        <Slider
          id="mix"
          label="Mixture — red (LEAN/cut-off → RICH)"
          min={0}
          max={1}
          step={0.01}
          value={g.mix}
          onChange={(v) =>
            up((d) => {
              d.eng.mix = v;
            })
          }
          fmt={(v) => (v <= 0.05 ? "LEAN (cut-off)" : v > 0.97 ? "RICH" : "Leaned " + pct(v))}
        />
        <Check
          id="altAir"
          label="ALTERNATE AIR lever pulled (ON)"
          checked={g.altAir}
          onChange={(v) =>
            up((d) => {
              d.eng.altAir = v;
            })
          }
        />
        {fails(s, up)}
        <Readouts
          items={[
            [
              "Engine",
              g.running
                ? live.fireT >= 0
                  ? ["FIRING — MIXTURE RICH!", "warnc"]
                  : "RUNNING"
                : E.starterOn
                  ? ["CRANKING", "warnc"]
                  : ["STOPPED", "bad"],
            ],
            ["RPM", rpm10()],
            ["MAN IN", live.map.toFixed(1)],
            ["Fuel flow GPH", live.ff.toFixed(1)],
            ["Oil press PSI", [live.oilP.toFixed(0), live.oilP < 25 ? "bad" : live.oilP < 56 ? "warnc" : ""]],
            ["Oil temp °F", live.oilT.toFixed(0)],
            ["CHT °F", live.cht.toFixed(0)],
            ["Fuel press PSI", [live.fuelP.toFixed(0), live.fuelP < 14 ? "bad" : ""]],
            ["Priming", flooded ? ["FLOODED", "bad"] : live.prime > 0.2 ? live.prime.toFixed(1) + " s" : "—"],
            [
              "Starter",
              live.crankT > 10 ? ["> 10 s — let it cool", "bad"] : E.starterOn ? live.crankT.toFixed(1) + " s" : "—",
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
        Starting needs battery power through BATT and START, fuel in the selected tank, and either a prime (pump ON +
        mixture RICH for 1–7 s) or the mixture rich while cranking (about 4 s). START is held for up to {START_HOLD} s
        and released when the engine fires. More than about 7 s of priming floods the engine: then use the flooded-start
        method. In flight, a windmilling engine relights by itself once fuel pressure is back with the ignition on and
        the mixture rich enough (AFM 3.2.4).
      </Small>
      <H3>Cold start (AFMS p. 39, AFM 4A-14)</H3>
      <ol className="notes">
        {[
          "Throttle IDLE, mixture LEAN, RPM HIGH, alternate air CLOSED, avionics master and ESS BUS OFF.",
          "BAT ON, fuel selector on the fullest tank, strobe ON.",
          "Electric fuel pump ON — note pump noise.",
          "Throttle 3 cm (1.2 in) forward of IDLE.",
          "Mixture RICH for 3–5 s (warm engine 1–3 s), then LEAN.",
          "Throttle 1 cm (0.4 in) forward of IDLE.",
          "Ignition START (≤ 10 s; the G1000 shows STARTER ENGD while cranking).",
          "When the engine fires: mixture rapidly RICH. Oil pressure green within 15 s or shut down.",
          "Fuel pump OFF, ALT ON, check ammeter and fuel pressure, PFD annunciations.",
        ].map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <H3>Flooded engine (AFM 4A-17)</H3>
      <Notes
        items={[
          "Fuel pump OFF (the G1000 AFMS DA 40 page prints ON — the club checklist decides; the model uses the AFM).",
          "Mixture fully LEAN, throttle half open, START; as it starts pull the throttle back toward IDLE, then mixture rapidly RICH.",
        ]}
      />
      <H3>Markings (AFMS §2.5)</H3>
      <Facts
        rows={[
          ["RPM", "green 500–2,700 · red > 2,700 (legend red only above 2,780)"],
          ["Manifold pressure", "green 13–30 inHg"],
          ["Oil pressure", "red < 25 · yellow 25–55 · green 56–95 · yellow 96–97 · red > 97 psi"],
          ["Oil temperature", "green 149–230 · yellow 231–245 · red > 245 °F"],
          ["CHT", "green 150–475 · yellow 476–500 · red > 500 °F"],
          ["Fuel pressure", "red < 14 · green 14–35 · red > 35 psi"],
          ["Fuel flow", "green 1–20 · red > 20 GPH"],
        ]}
      />
      <H3>Engine data</H3>
      <Facts
        rows={[
          ["Rating", "180 hp (134 kW) at 2,700 RPM (AFM 7-20)"],
          ["Max continuous", "2,700 RPM with the MTV-12-B/183-59b prop (STC SA06-52)"],
          ["Displacement", "5,916 cm³ (361 in³)"],
          ["Oil", "4–8 qt (IFR min 6) · 15W-50 ashless dispersant"],
          ["Ignition", "OFF – L – R – BOTH – START; Slick mags + SlickSTART"],
          ["Mag check", "Max drop 175 RPM, max difference 50 RPM at 2,000 RPM"],
          ["Starter", "≤ 10 s, cool 20 s; after 6 tries wait 30 min"],
          ["Idle", "600–800 RPM"],
          ["Take-off check", "2,680 ± 20 RPM at full throttle"],
          ["Cooling", "Air-cooled, no cowl flaps; CHT change ≤ 50 °F/min"],
        ]}
      />
      <H3>Annunciations</H3>
      <Facts
        rows={[
          ["OIL PRES LO (red)", "Oil pressure below 25 psi"],
          ["FUEL PRES LO (red)", "Fuel pressure below 14 psi"],
          ["FUEL PRES HI (red)", "Fuel pressure above 35 psi (no AFM/AFMS checklist; try the pump-regulation failure)"],
          ["STARTER ENGD (red)", "Starter engaged — or not disengaged after start"],
        ]}
      />
      {s.eng.fail.starterStuck && s.eng.running && (
        <Caution title="Starter malfunction (AFM 3-38)">
          STARTER ENGD stays on after the start: throttle IDLE, mixture LEAN, ignition OFF, master OFF. Terminate the
          flight preparation.
        </Caution>
      )}
      <H3>Engine — tap to locate</H3>
      <PartsList parts={CAT.pinned("engine")} />
    </>
  );
}

export function Propeller() {
  useTicker(150);
  const s = useDA40((x) => x.s),
    up = useDA40((x) => x.update);
  const gov = govRpm(s);
  return (
    <>
      <p className="lead">
        An MT three-blade, hydraulically governed constant-speed propeller with wood-composite blades. The blue RPM
        lever sets the governor; the governor then meters engine oil into the hub so RPM stays put whatever the throttle
        and airspeed. Lose the governor or the oil and the blades go to fine pitch — maximum RPM — so you can keep
        flying, controlling RPM with the throttle.
      </p>
      <H3>Levers</H3>
      <Ctl>
        <Slider
          id="rpmL2"
          label="RPM lever (LOW → HIGH)"
          min={0}
          max={1}
          step={0.01}
          value={s.eng.rpmLever}
          onChange={(v) =>
            up((d) => {
              d.eng.rpmLever = v;
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
          fmt={(v) => (v < 0.02 ? "IDLE" : v > 0.98 ? "MAX PWR" : pct(v))}
        />
        <Check
          id="fGov2"
          label="Governor fails (blades to fine pitch)"
          checked={s.eng.fail.governor}
          onChange={(v) =>
            up((d) => {
              d.eng.fail.governor = v;
            })
          }
        />
        <Readouts
          items={[
            ["Governor target", s.eng.fail.governor || live.oilP < 15 ? ["NONE", "bad"] : gov.toLocaleString()],
            ["RPM", [rpm10(), live.rpm > 2700 ? "bad" : ""]],
            ["Blade angle", bladeAngle(s, live.rpm).toFixed(0) + "°"],
            ["MAN IN", live.map.toFixed(1)],
          ]}
        />
      </Ctl>
      <Small>
        Below the governing range — idle and the run-up — the blades sit on the fine-pitch stop and RPM follows the
        throttle. The low-RPM end of the lever is not given in the AFM (≈1,800 RPM here); blade angle is illustrative
        between 11° and 30°.
      </Small>
      {(s.eng.fail.governor || live.oilP < 15) && s.eng.running && (
        <Caution title="Governor or oil failure (AFM 7-22, 3-13)">
          Adjust RPM with the throttle and try not to exceed 2,700 RPM. If oil pressure is normal and pulling the RPM
          lever gives no audible change, the governor is defective.
        </Caution>
      )}
      <H3>Hardware</H3>
      <Facts
        rows={[
          ["Model", "mt-Propeller MTV-12-B/183-59b scimitar (STC SA06-52) — XLS"],
          ["Diameter", "1.83 m (72 in)"],
          ["Pitch at 0.75 R", "11.0° fine – 30.0° coarse"],
          ["Blades", "Wood composite, FRP coating, stainless leading-edge cladding"],
          ["Governor", "Woodward C-210776 or MT P-860-23, front of engine"],
          ["Pre-flight", "Blade shake ≤ 3 mm (⅛ in), angular play ≤ 2°"],
          ["Alternative", "Base AFM: MTV-12-B/180-17, Ø 1.80 m, 10.5–30°, max continuous 2,400"],
        ]}
      />
      <H3>Operating notes</H3>
      <Notes
        items={[
          "Move the throttle and RPM lever slowly: the light wooden blades change RPM faster than metal ones (AFM 7-22).",
          "Run-up: RPM lever back until the drop reaches at most 500 RPM, then HIGH; cycle three times (AFMS p. 47).",
          "Take-off HIGH RPM; after take-off 2,400; best-rate climb 2,700 with the SA06-52 prop (2,400 basic), cruise climb 2,400; cruise 1,800–2,400 RPM; before landing HIGH RPM (AFM 4A-26…4A-29; SA06-52 Ch. 4A).",
          "Never move the propeller by hand with the ignition on; avoid high RPM on loose ground (stone damage) (AFM 7-24).",
          "Confirm the installed propeller from N949KC's equipment list — the AFM copy used here is for another serial number.",
        ]}
      />
    </>
  );
}

export function Fuel() {
  useTicker(250);
  const s = useDA40((x) => x.s),
    E = useDA40((x) => x.E),
    up = useDA40((x) => x.update);
  const f = s.fuel,
    imb = Math.abs(f.qL - f.qR);
  return (
    <>
      <p className="lead">
        An aluminium tank in each wing — on the XLS the long-range version with three chambers per side. The selector on
        the centre console picks LEFT, RIGHT or OFF; there is no BOTH, so you alternate tanks. The engine-driven pump is
        the normal supply; the electric pump is for priming, take-off, landing, tank changes, high altitude and low fuel
        pressure.
      </p>
      <H3>Try it</H3>
      <Ctl>
        <Seg
          id="fsel"
          label="Fuel tank selector"
          options={[
            ["L", "LEFT"],
            ["R", "RIGHT"],
            ["OFF", "OFF"],
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
          label="FUEL PUMP switch ON"
          checked={f.pump}
          onChange={(v) =>
            up((d) => {
              d.fuel.pump = v;
            })
          }
        />
        <Slider
          id="qL"
          label="Left tank (usable)"
          min={0}
          max={25}
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
          max={25}
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
              ["Full · 50", 25, 25],
              ["18 / 18 (ungauged)", 18, 18],
              ["Low · 2.5 / 4", 2.5, 4],
              ["Imbalance 20 / 10", 20, 10],
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
            ["Gauge L / R", `${live.gaugeL.toFixed(0)} / ${live.gaugeR.toFixed(0)}`],
            ["Total usable", (f.qL + f.qR).toFixed(1) + " gal"],
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
            ["Electric pump", f.pump ? (E.pumpPwr ? "ON" : ["NO PWR", "bad"]) : "OFF"],
            ["Fuel pressure", [live.fuelP.toFixed(0) + " psi", live.fuelP < 14 ? "bad" : ""]],
            ["Imbalance", [imb.toFixed(1) + " gal", imb > 8 ? "bad" : ""]],
          ]}
        />
      </Ctl>
      <Small>
        Selecting OFF or an empty tank — or losing the engine-driven pump with the electric pump off — stops a running
        engine after a few seconds. The gauge pointer shows 24 when full and parks at 16 while the 3 gal of ungauged
        fuel (16–19) is used; it takes 30 s to migrate down.
      </Small>
      {imb > 8 && (
        <Caution title="Fuel imbalance">
          Max difference between tanks is 8 US gal with long-range tanks — also with the autopilot engaged, where
          imbalance shows up as a yellow ←AIL / AIL→ out-of-trim (AFM 2-23; AFMS p. 17, 27).
        </Caution>
      )}
      <H3>Fuel path (AFM 7.10 schematic)</H3>
      <ol className="notes">
        {[
          "Tank (3 chambers) → finger filter and drain at the inboard, lowest point.",
          "Wing feed line → fuel tank selector on the centre console.",
          "Filter/screen (gascolator) with drain — the lowest point of the system.",
          "Electric fuel pump, with a bypass for when it is off.",
          "Through the firewall → engine-driven (mechanical) pump with bleed line.",
          "Fuel-flow transducer → injection timing device (fuel servo) with screen; fuel pressure tapped here.",
          "Fuel distributor → four lines to the cylinders.",
        ].map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
      <H3>Long-range tanks</H3>
      <Facts
        rows={[
          ["Capacity", "2 × 25.5 US gal (≈ 96.5 l)"],
          ["Usable", "2 × 25 US gal = 50 · unusable 0.5 per tank"],
          ["Gauge", "Dual pointers (L top, R bottom), max indication 24 gal"],
          ["Ungauged", "16–19 gal: gauge reads 16 — measure with the dipstick device or plan on 16"],
          ["Probes", "Two per side (inboard + outboard chamber)"],
          ["Max imbalance", "8 US gal (also with the AP engaged)"],
          ["Fuel", "AVGAS 100LL"],
          ["Drains", "3: left tank, right tank, gascolator"],
          ["Vents", "Capillary + check valve under each wing ≈ 2 m from the tip"],
          ["Totalizer", "RST FUEL sets 50 gal; uses fuel flow only, not the probes"],
        ]}
      />
      <H3>Annunciations</H3>
      <Facts
        rows={[
          ["L FUEL LOW / R FUEL LOW (yellow)", "Less than 3 US gal (±1) in that tank"],
          ["FUEL PRES LO (red)", "Below 14 psi — check pump ON"],
          ["FUEL PRES HI (red)", "Above 35 psi"],
        ]}
      />
      <H3>Notes</H3>
      <Notes
        items={[
          "Before taxi, run the engine on each tank for at least 1 minute at 1,500 RPM (AFMS p. 45).",
          "Switch tanks with the electric fuel pump ON (AFM 4A-30).",
          "Engine fire: selector OFF — it is the only fuel shut-off (AFM 3-22, 3-26).",
          "Electric pump is on the MAIN bus: after an alternator failure with ESS BUS ON it is gone (AFMS p. 30).",
          "High altitude with the pump OFF can give vapour bubbles: intermittent low fuel pressure, then high fuel-flow indications (AFM 4A-27).",
        ]}
      />
      <H3>Components — tap to locate</H3>
      <PartsList parts={CAT.pinned("fuel")} />
    </>
  );
}
