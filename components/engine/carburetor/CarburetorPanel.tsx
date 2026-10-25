"use client";
import { ComponentIntro } from "../ComponentIntro";
/**
 * The carburetor page's panel: start-from scenarios and the engine controls (the engine page's), what each of the
 * carburetor's systems is doing, conditions, the failures that reach the carburetor, the documented numbers, how the
 * model works and the sources.
 */
import type { ReactNode } from "react";
import { MA45 } from "@/engines/components/carburetor/carburetor";
import { Check, Facts, H3, Notes, Readouts, Small } from "@/components/ui/controls";
import { f0 } from "@/lib/format";
import { useLiveSnapshot } from "@/lib/useLiveSnapshot";
import { Controls, Environment, StartFrom } from "../EnginePanel";
import type { EngineSim } from "../store";
import { live, primeStroke } from "./live";

const OI_HREF = "https://www.expaircraft.com/PDF/marvel-schebler-OH.pdf";
const AMT_HREF = "https://www.faa.gov/sites/faa.gov/files/04_amtp_ch2.pdf";
const PHAK_HREF = "https://www.faa.gov/sites/faa.gov/files/09_phak_ch7.pdf";
const OM_HREF =
  "https://www.lycoming.com/sites/default/files/file/2025-11/60297-12%20-%20O-360%2C%20HO-360%2C%20IO-360%2C%20AIO-360%2C%20HIO-360%2C%20and%20TIO-360%20Series.pdf";

const pct = (v: number) => `${Math.round(v * 100)} %`;
const degF = (c: number) => (c * 9) / 5 + 32;

function Systems() {
  const r = useLiveSnapshot(live, 250);
  const total = r.main + r.idle;
  const circuit =
    total < 0.05 ? "no fuel" : r.mainShare >= 0.999 ? "main nozzle" : r.mainShare <= 0.001 ? "idle jet" : "both";
  const afr = r.far > 0 ? (1 / r.far).toFixed(1) : "–";
  return (
    <>
      <H3>Carburetor</H3>
      <Readouts
        items={[
          ["Air through the bore", `${f0(r.air)} lb/h`],
          ["Fuel metered", `${total.toFixed(1)} lb/h`],
          ["Feeding from", circuit],
          ["Main nozzle", `${r.main.toFixed(1)} lb/h`],
          ["Idle jet", `${r.idle.toFixed(1)} lb/h`],
          ["Air–fuel ratio", afr === "–" ? afr : `${afr} : 1`],
          ["Accelerating pump", r.squirt > 0.05 ? "discharging" : r.plunger > 0.98 ? "bottomed" : "ready"],
          ["Manifold vacuum", pct(r.vacuum)],
          ["Throttle valve", `${f0(r.throttleDeg)}° open`],
          ["Mixture valve", r.mixture < 0.03 ? "idle cut-off" : r.mixture > 0.995 ? "full rich" : pct(r.mixture)],
          ["Inlet pressure", [`${r.fuelPsi.toFixed(1)} psi`, r.fuelPsi < 0.5 && r.rpm > 100 ? "bad" : ""]],
          ["Float bowl", [pct(r.bowl), r.bowl < 0.5 ? "bad" : ""]],
          [
            "Float valve",
            !r.inflow ? (r.bowl < 0.99 ? "open, nothing coming" : "no pressure") : `${pct(r.needle)} open`,
          ],
          ["Inlet air", `${f0(degF(r.inletC))} °F`],
          ["Mixture", [`${f0(degF(r.chamberC))} °F`, r.chamberC < 0 ? "warnc" : ""]],
          ["Ice", [pct(r.ice), r.ice > 0.2 ? "bad" : r.ice > 0.02 ? "warnc" : ""]],
          [
            "Primer",
            r.primer.t < 0
              ? "in and locked"
              : r.primer.discharging
                ? "pushing fuel to the cylinders"
                : "drawing fuel into the barrel",
          ],
        ]}
      />
      <Small>
        With the throttle nearly closed the venturi can&apos;t lift fuel from the main nozzle and the idle jet carries
        the engine; opening the throttle hands over to the main system. Snap the throttle open to see the accelerating
        pump. Prime works the primer, which sends fuel to the cylinders around the carburetor.
      </Small>
    </>
  );
}

function Failures({ sim }: { sim: EngineSim }) {
  const f = sim.useUi((x) => x.failures),
    set = sim.useUi((x) => x.setFailures);
  return (
    <>
      <H3>Failures</H3>
      <div className="eng-checks">
        <Check
          id="f-pump"
          label="Engine-driven fuel pump"
          checked={f.fuelPump}
          onChange={(v) => set({ fuelPump: v })}
        />
        <Check id="f-filter" label="Air filter blocked" checked={f.filter} onChange={(v) => set({ filter: v })} />
      </div>
      <Small>
        Without the pump, the boost pump keeps the inlet pressure; with neither, the bowl runs dry, the float drops and
        the engine stops. A blocked filter starves the engine of air. Carburetor heat air comes from around the exhaust,
        unfiltered on some installations (OM p. 3-9); in the model it bypasses the filter.
      </Small>
    </>
  );
}

function Documented() {
  const rows: [ReactNode, ReactNode][] = [
    ["Type", "Marvel-Schebler MA-4-5: single-barrel float type, manual mixture control, idle cut-off (OM pp. 1-2–1-3)"],
    ["On", "Lycoming O-360-A1D (OM Table 1, p. 1-3), under the oil sump (OM p. 1-2)"],
    ["Float setting", `${MA45.floatSetting.value} (${MA45.floatSetting.src})`],
    ["Float valve test", `${MA45.floatValveTest.value} (${MA45.floatValveTest.src})`],
    ["Pump discharge tube", `${MA45.pumpTube.value} (${MA45.pumpTube.src})`],
    ["Accelerating pump test", `${MA45.pumpTest.value} (${MA45.pumpTest.src})`],
    ["Fuel level", `${MA45.fuelBelowNozzle.value} (${MA45.fuelBelowNozzle.src})`],
    ["Lifting fuel to the nozzle", `${MA45.liftToNozzle.value} of venturi suction (${MA45.liftToNozzle.src})`],
    ["Carburetor inlet", "0.5–8.0 psi, 3.0 desired (OM p. 3-10)"],
    ["Mixture cooling", "up to 70 °F below the incoming air (OM p. 3-8)"],
    ["Icing", `${MA45.icingRange.value} (${MA45.icingRange.src})`],
    ["Primer", `${MA45.primer.value} (${MA45.primer.src})`],
    ["Priming", `${MA45.priming.value} (${MA45.priming.src})`],
    ["What the primer does", `${MA45.primerUse.value} (${MA45.primerUse.src})`],
  ];
  return (
    <>
      <H3>Documented numbers</H3>
      <Facts rows={rows} />
    </>
  );
}

const MODEL_NOTES = [
  "The engine is the O-360-A1D simulation (the engine page's, calibrated to the Lycoming OM's power chart and cruise fuel flows); this page drives it and draws its carburetor. Both pages share one engine, so a change on either shows on the other.",
  "Fuel flow follows the engine model: the main nozzle's flow tracks the air through the venturi (richer as the air thins or warms), the mixture valve scales it, and idle cut-off stops it. The idle jet is fed by manifold vacuum at the throttle valve's edge and carries the engine until the air flow is enough for the main nozzle; where the two hand over is a model constant, not a published figure.",
  "The accelerating pump's spring spreads a rapid throttle opening into a decaying discharge. A slow stroke lets fuel seep back into the bowl (FAA-H-8083-32B p. 2-13), so it delivers less total fuel. The drawing reads the same plunger and actual discharge the engine uses. Swept volume, spring timing and bypass rate are illustrative, not published MA-4-5 settings.",
  "The float bowl refills through the float valve in proportion to how far the level has dropped, up to what the inlet pressure pushes through the needle. Running, the needle sits partly open; the drawing exaggerates its lift. The bowl's size and the needle's capacity are model constants.",
  "Carburetor ice comes from the engine model: fuel evaporation and the pressure drop cool the mixture (limited to the OM's 70 °F); moisture the cooled air can't hold freezes and narrows the bore. How fast it builds and melts is illustrative.",
  "The primer is the engine model's: each stroke puts a fixed amount of fuel (a model constant, not published) straight into every cylinder, where it helps a cold engine start and evaporates or drains away. Here a press of Prime pulls and pushes the knob, and the fuel goes in as the plunger is pushed; the stroke's timing is a display constant. Its tee in the fuel line, the pump behind a piece of panel, one primer line and its nozzle on one intake pipe are drawn schematically: where they sit is the airframe's.",
  "The 3D carburetor is schematic: its parts are named and arranged after the overhaul instructions' exploded views (Figures 2-19 and 2-20), but their shapes, sizes and spacing are not measured. The air box and heat duct stand for the airframe's installation. Parts the model doesn't use, such as the power jet and the air metering pin, are not drawn.",
];

function Sources() {
  const list: [string, string, string][] = [
    [
      "Marvel-Schebler Aircraft Carburetor Overhaul Instructions, models MA-4-5, MA-4-5AA (Borg-Warner)",
      OI_HREF,
      "Part names and arrangement (Figures 2-18 to 2-20), float setting, float valve and accelerating pump tests (¶2-27, ¶3-1 to ¶3-3). Cited by paragraph; the copy has no page numbers.",
    ],
    [
      "FAA-H-8083-32B, Aviation Maintenance Technician Handbook—Powerplant, Chapter 2",
      AMT_HREF,
      "How a float carburetor's systems work: float chamber, main metering, idling, mixture control (the rotary metering valve), accelerating pump, icing (pp. 2-8 to 2-14).",
    ],
    [
      "Lycoming O-360 series Operator's Manual, P/N 60297-12",
      OM_HREF,
      "The O-360-A1D and its MA-4-5, starting, carburetor heat and icing, inlet pressure, idle mixture check, the primer provision and priming.",
    ],
    [
      "FAA-H-8083-25B, Pilot's Handbook of Aeronautical Knowledge, Chapter 7",
      PHAK_HREF,
      "What the fuel primer does and how to use it (p. 7-25), and where it sits in a fuel-pump system (Figure 7-30).",
    ],
  ];
  return (
    <>
      <H3>Sources</H3>
      <ul className="notes">
        {list.map(([t, href, note]) => (
          <li key={t}>
            <a href={href} target="_blank" rel="noreferrer">
              {t}
            </a>
            . {note}
          </li>
        ))}
      </ul>
    </>
  );
}

export function CarburetorPanel({ sim }: { sim: EngineSim }) {
  return (
    <div className="panel-inner">
      <ComponentIntro source="Marvel-Schebler MA-4-5">
        <p className="lead">
          The float carburetor of a Lycoming O-360-A1D, cut away and running. A float keeps fuel at a set level in its
          chamber; air speeding through the venturi draws it from the nozzle in proportion to the air flow; the throttle
          valve sets the air flow; an idle system feeds the engine at low throttle, an accelerating pump covers sudden
          openings, and the mixture valve leans it or cuts it off.
        </p>
      </ComponentIntro>
      <StartFrom sim={sim} />
      <Controls sim={sim} onPrime={primeStroke} />
      <Systems />
      <Environment sim={sim} />
      <Failures sim={sim} />
      <H3>Parts</H3>
      <Small>Point at any part for its name and what it does. X-ray turns the castings see-through.</Small>
      <Documented />
      <H3>How the model works</H3>
      <Notes items={MODEL_NOTES} />
      <Sources />
    </div>
  );
}
