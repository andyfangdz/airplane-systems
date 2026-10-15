# TSIO-550-K engine simulation: design note

A plan for `/engines/tsio550k`: the Continental TSIO-550-K of the Cirrus SR22T as a standalone engine page on the
engine framework (`engines/model` runs any `EngineSpec`; `engines/io390` is the existing engine). Nothing here is
built yet. The note sets out the physics, the generic `engines/model` additions (each behind an optional spec field,
the IO-390 unchanged), the scene generalisation, the scenarios, the calibration targets and the build order, so the
direction can be agreed before code lands. Figures are cited by document and page; no manual image is reproduced.

Abbreviations: **POH** = Cirrus SR22T POH/AFM P/N 13772-007 Reissue A (the manual's own page). **AMM** = Cirrus AMM
13773-002 Rev 7 (chapter-section, PDF page). **M-18** = Continental TSIO-550 Permold Series Engine Maintenance and
Overhaul Manual, 21 Sep 2017 (the manual's own page). **OI-18** = TCM TSIO-550 Installation and Operation Manual, 29
Nov 2006 (covers -B/-C/-E/-G; generic system text only). **CT-n** = calibration target n (§10). **FIT** = a constant
no document gives, chosen to reproduce a named target. **NEW** = an optional spec field proposed here.

## 1. Goal

A TSIO-550-K page that behaves like the SR22T's engine in the POH: 315 bhp at 2,500 rpm, turbo-normalized to hold
36.0 in.Hg for every takeoff up to about 18,000 ft, a differential ("sloped") wastegate controller fed by engine oil,
intercoolers, two TIT readings, an overboost relief valve, automatic alternate air, a fixed 2,500 rpm governor, START
firing both magnetos, and the POH's lean-of-peak cruise table, with the POH 2-9 instrument markings and flags named
after the POH's CAS messages. The IO-390 page and its tests do not change.

## 2. Scope and non-goals

In scope:

- `engines/tsio550k/` (spec, SOURCES.md, scene layout data, scenarios) and the model pieces it needs, each behind a NEW
  optional spec field (absent = today's code path).
- Scene: generalise the existing builders and add a turbo group; -K exhaust, induction, fuel, drives and oil branches.
- Page: monitor, panel, failures, scenarios, flags and pressure chart driven by the spec.
- Registry and routing, tests, screenshot support for engine pages.

Non-goals:

- Airframe parts (cowl, NACA ducts, baffles, mount, cabin-heat shroud): `aircraft/sr22t` already draws them.
- The avionics' own % power algorithm (POH 7-36): the page shows brake hp ÷ 315.
- A compressor or turbine map: none is published for the -K; the turbo is a quasi-steady power balance (§5, G2).
- A link from the SR22T airplane page to the engine page (a possible follow-up).

## 3. Sources and where they disagree

POH > AMM > Continental (engine items only, where Cirrus is silent). A higher source wins every conflict; the lower
value is kept as a note in SOURCES.md.

| #   | Item                            | Used                                                                                           | Not used                                                                   |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| C1  | Magneto → plug wiring           | POH 7-37: right magneto fires lower right + upper left                                         | AMM 74-00 PDF 2604, M-18 Fig 2-19 p. 2-20: the reverse                     |
| C2  | Installed full-throttle MAP     | POH 4-14, 4-17: 36.0 in.Hg (36.0–37.0 with cold oil)                                           | M-18 Table 2-2: rated at 37.5 (Fig 2-37 reaches 315 at 36.5)               |
| C3  | Overboost valve setting         | POH 7-39 gives no number; the model's cracking pressure is FIT above normal operation (§6, D1) | AMM 81-20 PDF 2812: 35 in.Hg, below the normal 36.0                        |
| C4  | Magneto-drop differential       | POH 4-15: 75 rpm                                                                               | M-18 7-3.3 p. 7-8: 50 rpm                                                  |
| C5  | Minimum takeoff oil temperature | POH 2-6: 75 °F                                                                                 | M-18 Table 2-3: 100 °F                                                     |
| C6  | Oil-pressure gauge scale        | POH 2-9: 0–100                                                                                 | POH 7-36: 0–90                                                             |
| C7  | Induction air at rated          | not a target                                                                                   | M-18 Table 2-6: 41.5 lb/min (would need VE ≈ 1.2)                          |
| C8  | Idle                            | POH 4-15: 600–750 band; AMM 73-20 PDF 2589: 700 ± 25 as the fit point                          | M-18 minimum 600                                                           |
| C9  | Full-power fuel flow            | AMM Fig 73-20-2 PDF 2592 band                                                                  | M-18 Fig 2-36 at 315 bhp (220 / 210 lb/h, includes return flow, Table 2-4) |

Not yet located: crankshaft rotation direction; which of the three M-18 magneto pairs Cirrus fits; the propeller-flange
station and rocker-cover width on M-18 Figs 5-33/5-34; whether the -K has pendulum counterweights and piston-cooling oil
jets (#79's `geometry.pendulumCounterweights` and `oil.pistonCoolingJets`); an M-18 page for the spring-open wastegate
(the open-spring fail-safe currently rests on a TCM TSIO-520 overhaul-manual excerpt, as cited in
`aircraft/sr22t/model.ts`, and is consistent with POH 3-27/3-28).

## 4. Fit with the O-360 change (#79)

The plan builds on the shapes the open O-360-A1D pull request (#79) introduces and adds to them rather than beside
them:

- `fuelSystem` (`kind: "injected" | "carburetor"`) gains a third member, `kind: "continental"`: Continental
  continuous-flow injection (engine-driven pump, throttle-linked metering, manifold valve, air-bled nozzles). The
  RSA servo's density richening does not apply.
- `fuelFlow` (`kind: "chart" | "bsfc"`) gains `kind: "continental"`: the M-18 Fig 2-36 curves against bhp.
- `doc`, `refs`, `modelNotes` and `parts` carry the -K's manual names, page references, model notes and part notes;
  no separate header or notes fields are needed.
- `scenariosFor(spec)` and a scenario's `only` predicate carry the -K's scenarios; labels and notes are functions of
  the spec, as in #79.
- `calibration.fuelTrim`, the optional `limits.starterMaxS` and the optional oil-cooler fields are used as #79 defines
  them; `propeller.cpScale` may suit the three-blade propeller.
- #79's per-cylinder `intakeLeak` (unmetered air after the throttle) is kept; the turbo's induction leak upstream of
  the throttle (POH 3-27) is a separate failure.

Where the plan differs from #79's direction, the choice is open (questions in the pull request):

- `performance` gains an optional `kind` (absent = Lycoming), where #79 makes its new discriminants required and
  writes `kind: "chart"` into the IO-390 spec.
- Scene layout data stays out of `EngineSpec` (a scene-side `layoutFor(spec)`), where #79 adds drawing flags to the spec
  (`geometry.pendulumCounterweights`, `oil.pistonCoolingJets`).
- Flags use the POH's CAS message names for this engine, where `alerts.ts` describes its flags as study limits, not an
  airplane's CAS.

If #79 changes before it merges, the same additions apply to whatever shape it lands with.

## 5. Model additions

Rule for every item: a NEW spec field is optional; absent, the model runs today's code path, and
`tests/io390-engine.test.ts` passes unchanged (CT-44). A literal hard-coded today moves into an optional field whose
default is that literal, byte for byte.

| #   | Change                                                                                                                                                                                                                                                                      | NEW field (absent = IO-390 path)                                                                  | Files                                                                 | IO-390 risk                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------- |
| G1  | Continental chart form: curved 2300/2400/2500 lines against absolute dry MAP 20–36.5 (M-18 Fig 2-37 p. 2-45); full rich above 30.5 in.Hg, best power at or below, blended ±1 in.Hg; 1 % per 6 °F of compressor-inlet temperature (M-18 Table 2-2 note 1); no altitude chart | `performance.kind`, `performance.continental`                                                     | `performance.ts`                                                      | low                              |
| G2  | Turbocharger: quasi-steady compressor/turbine power balance, first-order spool lag on deck pressure, derived shaft speed (display, Fig 2-41 limit)                                                                                                                          | `turbo`                                                                                           | new `turbo.ts`, `engine.ts`                                           | low (branch)                     |
| G3  | Wastegate + differential controller: proportional oil bleed, oil-pressure actuator, spring-open fail-safe; cold oil raises MAP (no integral term)                                                                                                                           | `turbo.wastegate`, `turbo.controller`                                                             | `turbo.ts`                                                            | none                             |
| G4  | Intercooler, manifold air temperature, deck vs manifold pressure (the throttle fed from the deck)                                                                                                                                                                           | `turbo.intercooler`                                                                               | `turbo.ts`, `engine.ts`, `induction.ts` (branch, signature unchanged) | medium                           |
| G5  | Overboost relief valve on the deck, with hysteresis                                                                                                                                                                                                                         | `turbo.overboost`                                                                                 | `turbo.ts`                                                            | none                             |
| G6  | Continental metering: full-rich λ schedule against air fraction, no density richening; pump and nozzle pressures; `mixtureFor` inverts through a function exported from `fuel.ts` per `fuelSystem.kind`                                                                     | `fuelSystem` `kind: "continental"`, `fuelFlow` `kind: "continental"`                              | `fuel.ts`, `trim.ts`, `engine.ts`, `performance.ts`                   | medium                           |
| G7  | Turbine-inlet pressure as the exhaust pressure (pumping, residuals, pressure chart); TIT per side = bank mean EGT + crossover mixing + offset, lagged                                                                                                                       | `turbo` (turbine area), `calibration.tit*`                                                        | `turbo.ts`, `engine.ts`                                               | low                              |
| G8  | Critical altitude emerges (gate closed, MAP falls); `ratedGrossHp` uses `rating.map`; throttle body sized by `induction.throttleLossInHg`; the normal-aspiration helpers are not used in the branch                                                                         | `rating.map`, `induction.throttleLossInHg`                                                        | `performance.ts`, `engine.ts`, `induction.ts`                         | low                              |
| G9  | Automatic alternate air upstream of the compressors; the door opens on filter restriction and closes when flow falls (POH 3A-11); the pilot `altAir` control is ignored                                                                                                     | `induction.altAir: "automatic"`, `induction.doorOpenInH2O`, `induction.altAirDeltaC`              | `engine.ts`                                                           | none                             |
| G10 | Oil to the turbos (bearing heat, small bleed) and to the wastegate actuator; oil loss and turbo internal failure                                                                                                                                                            | `turbo.oil`                                                                                       | `engine.ts`, `turbo.ts`                                               | none                             |
| G11 | START fires both magnetos, spark at TDC (impulse couplings, AMM 74-00 PDF 2604)                                                                                                                                                                                             | `ignition.startMags: "both"`                                                                      | `engine.ts` (`sparks`), `cycle.ts`; the scene reads a shared helper   | none                             |
| G12 | Governor with no pilot control                                                                                                                                                                                                                                              | `propeller.control: "fixed"`                                                                      | `engine.ts` (`governedRpm`), `scenarios.ts` (`propFor`)               | none                             |
| G13 | Volumetric efficiency as a fit (no Lycoming-style chart to derive it from)                                                                                                                                                                                                  | `calibration.ve`                                                                                  | `induction.ts`                                                        | none                             |
| G14 | Limits and flags for MAP, TIT (with the 30 s transient), turbine speed, the MAP floor above 18,000 ft, CHT floor, leaning above 30.5, START ENGAGED, OIL PRESS caution; flags read the POH 2-9 markings                                                                     | `markings`, `limits.*` NEW                                                                        | `alerts.ts`                                                           | none                             |
| G15 | Scenarios per engine; the IO-390 list unchanged                                                                                                                                                                                                                             | — (`scenariosFor`, `only`)                                                                        | `engines/model/scenarios.ts`, `store.ts`, `scenario.worker.ts`        | low                              |
| G16 | IO-390 literals in `engine.ts` behind spec defaults: pump psi 26/28, alternate air +15 °C, blocked filter `series(open, 0.12)`, exhaust `air.p × 1.02`, starter 230 N·m × (1 − rpm/380), slipstream 55 kt, oil pickup 1.5–3 qt, ram η 0.7                                   | `fuelSystem.pumpPsi`, `induction.*`, `accessories.starter*`, `calibration.slipKt`, `oil.pickupQt` | `engine.ts`                                                           | medium (byte-identical defaults) |
| G17 | Turbo-system failures                                                                                                                                                                                                                                                       | `Failures` optional members (§7)                                                                  | `engine.ts`, `turbo.ts`                                               | low                              |
| G18 | State additions                                                                                                                                                                                                                                                             | `EngineState` optional members (§7)                                                               | `engine.ts`                                                           | low                              |
| G19 | No-field notes: "observed" (Fig 2-36) and "corrected" (Fig 2-37) bhp treated alike; dry MAP = indicated (no humidity); 2300–2500 chart, governed 2500                                                                                                                       | —                                                                                                 | SOURCES.md                                                            | —                                |

Equation sketches:

- G2: `ΔT_c = T1 (PR^κ − 1)/η_c`, `P_c = ṁ_a c_p ΔT_c`; `P_t = ṁ_t c_pe T_TI η_t (1 − (p_tail/p_TI)^κ_e)`; `p_TI` by
  bisection so the turbine orifice and gate orifice together pass `ṁ_e`; `PR_eq` from `P_t = P_c`; deck lag
  `p2 += (PR_eq·p1 − p2)(1 − e^(−dt/τ_spool))`; `N = N_ref √((PR^κ − 1)/(PR_ref^κ − 1))`.
- G3: `Δ = deck − MAP`; `Δ_set = c0 + c1 (deck − deck_ref)`; bleed `b = clamp(b0 + k_b (Δ − Δ_set), 0, 1)`;
  `p_act = oilP / (1 + (b·r)²)`; `g_target = clamp((p_full − p_act)/(p_full − p_crack), 0, 1)` (1 = open); lag τ_gate.
  `oilP → 0 ⇒ g → 1`. Engine stopped ⇒ `g = 1`.
- G4: `T_mat = T2 − ε (T2 − T_cool)`; `deck = p2 − k_ic ṁ_a²/ρ2`;
  `solveManifold(…, source = deck, sourceC = T_mat, exhaust = p_TI)`.
- G1 reference conditions: M-18 Table 2-2 note 1 states the chart's standard day at the throttle inlet and exhaust exit,
  and that exhaust back pressure and accessory losses are not corrected for. The gross/pumping split keeps chart power
  exact at the sea-level reference `p_TI`; the 1 %/6 °F law uses compressor-inlet temperature as the note prints it.

Prior art in `aircraft/sr22t`: `MAP_FULL` 36.0, `MAP_RED_LINE` 37.5, the cold-oil 37.0 and the 36.5/37.5 MAN PRESSURE
thresholds are reused as calibration anchors; `wastegateOpen` (open when stopped, closed when seized) and
`overboostMayLift` are adapted into G3/G5; the `mapInHg` lever curve, `titState`, `TURBO_AMBIENT_INHG` and
`SEIZED_GATE_MAP_CEILING` are not reused (the model computes them). `engine-datum.ts` (Fig 5-34 stations) and
`parts/engine.ts` `FIRING_ORDER` are reused; the numbers and citations in the `*-layout.ts` files are reused by the
scene, re-expressed in engine-scene coordinates; the airframe catalogue, flows, cowl, baffle and mount plumbing are not.

## 6. Decisions

| #   | Point                                      | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Why                                          |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| D1  | Overboost / relief valve                   | The relief valve sits on the deck (LH intercooler outlet, upstream of the throttle, AMM 71-60 PDF 2542) with hysteresis; `turbo.overboost.crackInHg` is FIT so the valve never opens in normal operation, including the cold-oil 37.0 in.Hg case (CT-8), and opens with a wastegate seized closed (CT-10). Starting value: deck 38.5 in.Hg (with the ≈ 0.5–1 in.Hg throttle loss it lifts at MAP ≈ 37.5–38, inside the MAN PRESSURE warning band, consistent with POH 3-29). AMM 81-20's 35 in.Hg is recorded in SOURCES.md and not used. | POH > AMM; 35 is below the POH's normal 36.0 |
| D2  | MAN PRESSURE thresholds                    | Caution 36.5 < MAP ≤ 37.5, warning MAP > 37.5: the POH 2-9 band edges; POH 3-29 / 3A-9 name the messages but print no trigger. The flag text says "POH 2-9 band edge".                                                                                                                                                                                                                                                                                                                                                                    | only source with a number                    |
| D3  | Controller type                            | Differential ("sloped") controller, deck and MAP ports only, no aneroid: POH 7-39, AMM 81-20 PDF 2812, AMM 79-00 PDF 2764, M-18 2-1 p. 2-1, M-18 12-4.2 pp. 12-10/12-11. Full-throttle MAP holding comes from the slope.                                                                                                                                                                                                                                                                                                                  | confirmed on the pages                       |
| D4  | State names                                | One contract table (§7). Unit suffix where `EngineState` already uses one (`inletInHg`).                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                                              |
| D5  | Spec fields                                | One `types.ts` delta (§7). Scene layout data is a scene-side registry keyed by engine id (`components/engine/scene/layout.ts` + `engines/<id>/layout.ts`), so the model cannot read it. `markings` is the single source for gauge bands and the CAS-named flags. The required existing `limits` fields still carry the POH values, and a test checks they agree with `markings` (CT-47).                                                                                                                                                  | no duplicate numbers                         |
| D6  | Scenarios                                  | #79's `scenariosFor(spec)` with `only` predicates; the -K's scenarios live in `engines/tsio550k/scenarios.ts` and are listed for turbocharged specs only. Not a spec field (a scenario holds a `run` function that imports the model).                                                                                                                                                                                                                                                                                                    | `spec.ts` stays data                         |
| D7  | Fuel pump                                  | `controls.highBoost?: boolean` beside `boost`; the panel's OFF / BOOST / HIGH BOOST-PRIME switch sets both. Lockout per POH 7-41 using the later software (MAP ≥ 24 in.Hg and pressure altitude ≥ 10,000 ft), or rpm < 500. A pure `highBoostEnabled(spec, s, env)` in the model.                                                                                                                                                                                                                                                         | 2-state IO-390 control unchanged             |
| D8  | Exhaust group                              | `groupsFor(spec)` gives the -K a separate `exhaust` group; the IO-390 keeps "Induction and exhaust".                                                                                                                                                                                                                                                                                                                                                                                                                                      | IO-390 pixel-identical                       |
| D9  | Start retard                               | `startRetardATC: 0`, impulse couplings on both magnetos (AMM 74-00 PDF 2604).                                                                                                                                                                                                                                                                                                                                                                                                                                                             | page read                                    |
| D10 | Cruise mixture label                       | `rating.cruise[].mixture` gains `"lean of peak"` (display only; POH 4-22 "Lean of Peak / Best Economy").                                                                                                                                                                                                                                                                                                                                                                                                                                  |                                              |
| D11 | `leanMaxPowerROP`                          | Becomes optional in `limits` (the IO-390 keeps it); the -K uses NEW `limits.leanMaxMap` 30.5 (POH 4-22).                                                                                                                                                                                                                                                                                                                                                                                                                                  | no -K meaning                                |
| D12 | Turbo speed                                | Per side `turboRpm: [L, R]` (equal unless one side failed), for a failed-turbo animation. Display only.                                                                                                                                                                                                                                                                                                                                                                                                                                   |                                              |
| D13 | Failures UI                                | Booleans with FIT leak areas in the spec, not 0…1 sliders. Cold oil is a scenario, not a failure; "controller misadjusted" is the failure.                                                                                                                                                                                                                                                                                                                                                                                                | checkbox UI                                  |
| D14 | TIT peak readout                           | Shown: CT-29 puts the TIT peak within ±0.03 λ of the EGT peak.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |                                              |
| D15 | Ground leaning                             | After start, the mixture is leaned to maximum rpm for taxi until run-up (POH 4-12 step 13): CT-22; the `idle` and `runup` scenarios start from it.                                                                                                                                                                                                                                                                                                                                                                                        | POH procedure                                |
| D16 | Alternate-air door closes at reduced power | Filter blockage is partial (FIT area): door open at full power, closed at ≤ 30.5 in.Hg (POH 3A-11): CT-39.                                                                                                                                                                                                                                                                                                                                                                                                                                | POH procedure                                |
| D17 | TAS slider maximum                         | 220 kt from POH 5-34 (largest table TAS), not FIT.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |                                              |

## 7. Proposed `engines/types.ts` and `engine.ts` delta

Written against #79's shapes. Every NEW member is optional or a new union member; absent = IO-390 behaviour.

```ts
// engines/types.ts
export interface ContinentalLine { rpm: number; points: [number, number][] }      // [MAP in.Hg, bhp]
export interface Band { from: number; to: number; color: "red" | "yellow" | "green";
  cas?: string; level?: "caution" | "warning" }                                     // POH 2-9 row cell
export interface Marking { gauge: "cht" | "rpm" | "egt" | "map" | "oilP" | "oilT" | "pct" | "tit" | "ff";
  scale: [number, number]; unit: string; bands: Band[]; src: string }

export interface FuelFlowContinental { kind: "continental"; curve: string;           // M-18 Fig 2-36, [bhp, lb/h]
  richFullRich: [number, number][]; leanFullRich: [number, number][];
  bestPower: [number, number][]; bestEconomy: [number, number][] }
export interface ContinentalInjection { kind: "continental"; unit: string;
  nozzle: { curve: string; points: [number, number][] };
  fullRichLambda: [number, number][];                                                // [air fraction, λ]
  pumpPsi: { idle: [number, number]; rated: [number, number] }; boostPsi: [number, number];
  highBoost: { mapInHg: number; altFt: number; belowRpm: number }; nozzleRatedPsid: number }

EngineSpec += {
  ignition: + { startMags?: "retard" | "both"; advanceSrc?: string };  // pressure-chart caption source
  rating: + { map?: number;        // installed full-throttle MAP, in.Hg
    cruise[].mixture: + "lean of peak" };
  performance: + { kind?: "lycoming" | "continental"; continental?: { lines: ContinentalLine[];
    fullRichAboveInHg: number; blendInHg: number; tempPctPerF: number } };
  fuelFlow: FuelFlowChart | FuelFlowBsfc | FuelFlowContinental;
  fuelSystem: InjectedFuel | Carburetor | ContinentalInjection;
  induction?: { altAir?: "manual" | "automatic"; altAirDeltaC?: number; filterBlockedArea?: number;
    doorOpenInH2O?: number; throttleLossInHg?: number; ramEta?: number };
  turbo?: { count: 2; etaCompressor: number; etaTurbine: number; turbineArea: number; spoolTauS: number;
    rpmRef: number; prRef: number;
    wastegate: { pCrackPsi: number; pFullPsi: number; tauS: number; area: number };
    controller: { c0: number; c1: number; deckRef: number; kBleed: number; b0: number; ratio: number;
      misadjustInHg: number };
    intercooler: { effectiveness: number; dpInHgRated: number; coolRiseC: number };
    overboost: { crackInHg: number; hystInHg: number; area: number };
    leaks: { inductionArea: number; intercoolerArea: number; exhaustArea: number };
    oil: { bearingHeatK: number; bleedPsi: number; leakQtPerMin: number } };
  limits: + { leanMaxPowerROP?  /* now optional */;
    mapMinAbove?: { map: number; altFt: number; src: string };                  // 15 in.Hg above 18,000 ft
    titTransient?: { value: number; seconds: number; src: string };            // 1850 °F, 30 s
    turbineRpmMax?: { points: [number, number][]; src: string };               // [TIT °F, rpm]
    oilTempMinTakeoff?: Limit; chtMinDescent?: Limit; leanMaxMap?: Limit;
    exhaustBackPressureMax?: Limit; maxAltFt?: Limit;
    startEngaged?: { caution: number; warning: number; src: string };         // 15 s, 30 s
    oilPressCautionMinRpm?: Limit };                                           // OIL PRESS caution at ≥ 1000 rpm
  markings?: Marking[];                                                        // POH 2-9, as printed
  envelope?: { maxAltFt: number; maxTasKt: number; maxOilQt: number };          // panel slider maxima
  propeller: + { control?: "lever" | "fixed" };
  accessories: + { starterTorque?: number; starterFreeRpm?: number };
  oil: + { pickupQt?: [number, number] };
  calibration: + { ve?: [number, number][]; lambdaTarget?: number; titOffsetF?: number;
    titCrossover?: number; titTauS?: number; slipKt?: number };
}

// engines/model/engine.ts
Controls += { highBoost?: boolean };
Failures += { wastegateSeized?: "open" | "closed" | null; wastegateOil?: boolean; oilLeak?: boolean;
  inductionLeak?: boolean; intercoolerLeak?: [boolean, boolean]; exhaustLeak?: boolean;
  turboInternal?: [boolean, boolean]; controllerMisadjust?: boolean; titProbe?: [boolean, boolean] };
```

`noFailures(spec)` includes the turbo members (all false/null) only when `spec.turbo` is present.
`defaultEnvironment().oilQt` stays 7 for the IO-390; the -K page starts at 7 qt (POH 4-8 recommends seven quarts),
slider maximum `envelope.maxOilQt` 8.

### State contract (`EngineState` optional members; neutral values when `spec.turbo` is absent)

| Name                     | Unit              | Meaning                                                | Read by                                                    |
| ------------------------ | ----------------- | ------------------------------------------------------ | ---------------------------------------------------------- |
| `deckInHg`               | in.Hg             | upper-deck (throttle-inlet) pressure                   | panel readout, controller note                             |
| `gate`                   | 0 closed … 1 open | wastegate position; 1 when stopped or without oil      | wastegate plate and actuator rod, panel "Wastegate % open" |
| `bleed`, `pActPsi`       | 0…1, psi          | controller bleed, actuator oil pressure                | tests only                                                 |
| `turboRpm`               | [L, R] rpm        | shaft speed, display only                              | wheel spin (slowed, illustrative), panel, Fig 2-41 flag    |
| `compressorOutC`, `matC` | °C                | compressor discharge, manifold air (after intercooler) | intercooler tint, panel "Charge air"                       |
| `turbineInletInHg`       | in.Hg             | turbine-inlet (exhaust) pressure                       | pumping, residuals, pressure chart, CT-12                  |
| `tit`                    | [L, R] °F         | turbine inlet temperature                              | monitor TIT bars, turbine-housing tint, flags              |
| `titOverS`               | s                 | time above 1750 °F (transient timer)                   | flags                                                      |
| `reliefOpen`             | boolean           | overboost valve open                                   | poppet lift, panel, flag                                   |
| `altAirOpen`             | boolean           | alternate-air door open                                | door animation, panel, ALT AIR OPEN flag                   |
| `oilLossQt`              | qt                | oil lost to leaks this run                             | sump level (scene), oil pressure                           |
| `highBoostOn`            | boolean           | HIGH BOOST actually running (after the lockout)        | panel                                                      |

Existing members keep their meaning: `map` (after the throttle), `inletInHg` / `inletC` (compressor inlet for a turbo
spec), `oilP` (oil cooler adapter, M-18 Table 2-3 note 1), `govRpm`, `governing`.

## 8. The TSIO-550-K `EngineSpec`

Every value cites its page; FIT values say what they reproduce. The full digitized chart tables go in
`engines/tsio550k/SOURCES.md`.

### 8.1 Identity, geometry, ignition

| Field                                                          | Value                                                                                                                                                                                | Source                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `id` / `name` / `model`                                        | `tsio550k` / `TSIO-550-K` / `Continental TSIO-550-K`                                                                                                                                 | POH 1-7, 7-31                                                                                           |
| `doc` / `refs`                                                 | POH; start 4-12, idle 4-15, magneto check 4-15, cruise 5-32 to 5-34, leaning 4-22, tables Section 2                                                                                  | POH                                                                                                     |
| `lead`                                                         | 550 cu in, six cylinders, horizontally opposed, air-cooled, continuous-flow injection, twin turbochargers and intercoolers: 315 bhp at 2,500 rpm; holds 36.0 in.Hg for every takeoff | POH 2-6, 7-31, 4-14, 4-17                                                                               |
| cylinders                                                      | 6; right 1-3-5, left 2-4-6 viewed from the rear; No. 1 and No. 2 rearmost; left bank 2.47 in forward                                                                                 | M-18 2-1.2 Fig 2-3 p. 2-3; 2-2.1 p. 2-4; Fig 5-34 p. 5-54                                               |
| `firingOrder`                                                  | 1-6-3-2-5-4                                                                                                                                                                          | M-18 Table 2-1 p. 2-24                                                                                  |
| `cylinders[].pin`                                              | 1: 90, 6: 150, 3: 210, 2: 270, 5: 330, 4: 30 (deg)                                                                                                                                   | derived: 120° firing interval, IO-390 convention                                                        |
| `cylinders[].x` (m, + forward, mid-length origin)              | #1 −0.2751, #3 −0.0894, #5 0.0963, #2 −0.2123, #4 −0.0267, #6 0.1590                                                                                                                 | Fig 5-34 stations #1 5.42 in, #2 7.89 in from the accessory face, 7.31-in pitch; x = (s − 16.25)·0.0254 |
| `boreIn` / `strokeIn` / `displacementIn3` / `compressionRatio` | 5.25 / 4.25 / 552 / 7.5                                                                                                                                                              | M-18 Table 2-1 (the POH's "550" is nominal)                                                             |
| `rodIn` / `valves`                                             | 6.875 / ivo 20, ivc 55, evo 55, evc 20                                                                                                                                               | FIT (drawing and pressure trace only)                                                                   |
| `envelopeIn`                                                   | L 39.2, W 42.4 (intercoolers), H 34.0                                                                                                                                                | M-18 Table 2-8 p. 2-30                                                                                  |
| `ignition.advanceBTC`                                          | 24 (± 1)                                                                                                                                                                             | M-18 Table 2-1                                                                                          |
| `ignition.startMags` / `retardMag` / `startRetardATC`          | `"both"` / `"R"` (unused with both) / 0                                                                                                                                              | POH 7-37; AMM 74-00 PDF 2604                                                                            |
| `ignition.topPlugMag`                                          | odd (right) cylinders top plug `"L"`, even (left) top plug `"R"`                                                                                                                     | POH 7-37 (C1)                                                                                           |
| `ignition.minStartRpm`                                         | 50                                                                                                                                                                                   | FIT (IO-390 value; no Continental figure)                                                               |

### 8.2 Rating, chart, fuel

| Field                                                                     | Value                                                                                                                         | Source                                                               |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `rating.hp` / `rpm` / `map`                                               | 315 / 2500 / 36.0 in.Hg                                                                                                       | POH 2-6; POH 4-14, 4-17                                              |
| `rating.cruise`                                                           | 85 % 18.3 GPH, 80 % 17.4 (20,000–25,000 ft only), 75 % 16.4, 65 % 14.6, 55 % 12.7; 2500 rpm; `"lean of peak"`; hp = pct × 315 | POH 5-32 to 5-34                                                     |
| `performance.continental.lines`                                           | 2500 / 2400 / 2300 rpm, 20–36.5 in.Hg (read ±1 hp; 2400 above 29 in.Hg ±3 hp)                                                 | M-18 Fig 2-37 p. 2-45                                                |
| `performance.continental.fullRichAboveInHg` / `blendInHg` / `tempPctPerF` | 30.5 / 1 (FIT, keeps power continuous) / 1/6                                                                                  | Fig 2-37 "Full Rich Operation Only" region; M-18 Table 2-2 note 1    |
| `fuelFlow` (`kind: "continental"`)                                        | RFR / LFR / BP / BE curves, 173–315 bhp (LFR = RFR − 10 lb/h; BP/BE 173–262 only); includes return flow                       | M-18 Fig 2-36 p. 2-44; Table 2-4                                     |
| `fuelSystem.fullRichLambda`                                               | FIT ≈ 0.58 at rated air rising to ≈ 0.73 at 55 % air                                                                          | CT-14, CT-15                                                         |
| `fuelSystem.pumpPsi`                                                      | idle 7.0–9.0, rated 21.0–24.5 psi                                                                                             | AMM 73-20 PDF 2589; M-18 Table 2-4 gives 20.5–28.5 (the AMM governs) |
| `fuelSystem.boostPsi` / `highBoost`                                       | 4–6 psi / MAP 24 in.Hg, 10,000 ft, < 500 rpm                                                                                  | POH 7-41                                                             |
| `fuelSystem.nozzleRatedPsid`                                              | 14.5 (deck-referenced)                                                                                                        | M-18 Table 2-4: 14.2–14.8                                            |
| `fuelSystem.nozzle.points`                                                | √-law through (14.5 psid, CT-14 flow)                                                                                         | FIT, not Continental data                                            |

### 8.3 Limits and markings (POH Section 2 governs)

`markings` holds the POH 2-9 table as printed (CHT 100–500 °F, RPM 0–3000, EGT 1000–1800, MAP 10–40, oil P 0–100, oil
T 75–250, % power 0–100, TIT 1000–1800, FF 0–45 GPH with the dynamic arc of POH 2-10), with `cas` names: CHT (caution
420–460, warning > 460), RPM (> 2550), OIL PRESS (0–10 warning, 10–30 caution), OIL TEMP (> 240), TIT (1750–1800),
MAN PRESSURE (36.5–37.5 caution, 37.5–40.0 warning; D2).

| `limits` field                                            | Value                                                    | Source                                |
| --------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------- |
| `rpmMax`                                                  | 2500                                                     | POH 2-6                               |
| `idleRpm`                                                 | 600–750                                                  | POH 4-15                              |
| `oilPressMinIdle` / `oilPressNormal` / `oilPressMaxStart` | 10 / 30–60 / 100 psi                                     | POH 2-6, 2-9; M-18 Table 2-3          |
| `oilTempMax` / `oilTempBest`                              | 240 / 180 °F                                             | POH 2-6; POH 7-36, AMM 79-00 PDF 2764 |
| `chtMax` / `chtBestAbove75` / `chtBestAt75`               | 460 / 420 / 420 °F                                       | POH 2-9; 4-19, 4-22                   |
| `magDropMax` / `magDiffMax` / `magCheckRpm`               | 150 / 75 / 1700                                          | POH 4-15                              |
| `oilSumpQt` / `oilMinQt`                                  | 8 / 6 qt                                                 | POH 1-8; 4-8                          |
| `starterMaxS`                                             | 10 s (20 s cooling)                                      | POH 4-12                              |
| NEW `oilTempMinTakeoff`                                   | 75 °F                                                    | POH 2-6 (C5)                          |
| NEW `chtMinDescent`                                       | 240 °F                                                   | POH 4-23                              |
| NEW `leanMaxMap`                                          | 30.5 in.Hg                                               | POH 4-22                              |
| NEW `mapMinAbove`                                         | 15 in.Hg above 18,000 ft                                 | POH 2-6                               |
| NEW `titTransient`                                        | 1850 °F, 30 s                                            | M-18 Table 2-1                        |
| NEW `turbineRpmMax`                                       | 132,000 rpm to 1440 °F TIT, linear to 122,000 at 1750 °F | M-18 Fig 2-41 p. 2-49 (read ±500 rpm) |
| NEW `exhaustBackPressureMax`                              | 2.5 in.Hg                                                | M-18 Table 2-1                        |
| NEW `maxAltFt`                                            | 25,000 ft                                                | POH 2-19                              |
| NEW `startEngaged`                                        | caution 15 s, warning 30 s                               | POH 3A-10, 3-49                       |
| NEW `oilPressCautionMinRpm`                               | 1000 rpm                                                 | POH 3A-8                              |
| `envelope`                                                | maxAltFt 25,000; maxTasKt 220; maxOilQt 8                | POH 2-19; POH 5-34; POH 1-8           |

### 8.4 Oil, accessories, propeller

| Field                                          | Value                                                                                          | Source                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `oil.thermostatF`                              | 180                                                                                            | POH 7-36; AMM 79-00 PDF 2764                       |
| `oil.coolerFlowGpm` / `coolerMaxBtuMin`        | 7 / ≈ 650                                                                                      | M-18 Fig 2-38 p. 2-46 (7 GPM curve, 2,000 cfm end) |
| `oil.pickupQt`                                 | FIT inside the usable 4.5–5.0 qt of 8                                                          | M-18 Table 2-3                                     |
| `accessories` ratios                           | starter 48, alternator (gear) 3, magneto 1.5, tach 0.5, governor 1, fuel pump 1                | M-18 Table 2-9 p. 2-30                             |
| `accessories.rotation`                         | not yet located (§3)                                                                           | —                                                  |
| `accessories.weightLb`                         | 522.8                                                                                          | M-18 Table 2-8                                     |
| `accessories.starterTorque` / `starterFreeRpm` | FIT                                                                                            | CT-20                                              |
| `propeller`                                    | Hartzell PHC-J3Y1F-1N/N7605(B), 3 blades, 78.0 in; `control: "fixed"`; `governorMinRpm` = 2500 | POH 1-7, 2-8, 7-32, 7-39; AMM 61-20 PDF 2450       |
| `propeller.fineDeg` / `coarseDeg`              | FIT: static full power ≈ 2500 rpm                                                              | CT-21                                              |
| `propeller.inertia`                            | FIT ≈ 3.5–4.0 kg·m², never below the propeller minimum 1.81 kg·m² at a 700 rpm idle            | M-18 Table 2-7 p. 2-29                             |

### 8.5 Calibration and turbo (all FIT)

| Field                                                                                                                                                                                                                                                             | Starting value                                            | Reproduces                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------ |
| `idleArea`                                                                                                                                                                                                                                                        | ≈ 0.02                                                    | CT-18                                      |
| `lambdaBestPower`                                                                                                                                                                                                                                                 | 0.85                                                      | CT-3, CT-16                                |
| `lambdaFullRich`                                                                                                                                                                                                                                                  | 0.58 (documentation; the -K meters from `fullRichLambda`) | CT-14                                      |
| `lambdaTarget`                                                                                                                                                                                                                                                    | ≈ 1.12                                                    | CT-24, CT-25, CT-28                        |
| `peakEgtPower`                                                                                                                                                                                                                                                    | ≈ 0.965                                                   | CT-25                                      |
| `singlePlug`                                                                                                                                                                                                                                                      | ≈ 0.93                                                    | CT-19                                      |
| `egtBase`, `egtGain`, `titOffsetF`, `titCrossover` (≈ 0.2), `titTauS` (≈ 5 s)                                                                                                                                                                                     | —                                                         | CT-28 to CT-31                             |
| `chtRise`, `chtTau`, `oilRise`, `oilTau`, `oilPressPerRpm`, `oilRelief`                                                                                                                                                                                           | —                                                         | CT-32 to CT-36                             |
| `ve`                                                                                                                                                                                                                                                              | ≈ 0.90–0.95 at 2500 rpm                                   | CT-14, CT-24                               |
| `slipKt`                                                                                                                                                                                                                                                          | —                                                         | CT-32                                      |
| `fuelTrim`, `coolingTrim`                                                                                                                                                                                                                                         | 6 entries, illustrative                                   | spread only                                |
| `turbo.*` (η_c·η_t product, turbine area, spool τ ≈ 1.5 s, controller c0/c1/deckRef/kBleed/b0/ratio, gate crack/full/τ ≈ 0.5–1 s/area, intercooler ε 0.5–0.6, overboost crack ≈ 38.5 deck / hysteresis / area, leak areas, oil constants, `misadjustInHg` ≈ +1.0) | —                                                         | CT-1, CT-5 to CT-15, CT-37 to CT-39, CT-42 |
| `induction.throttleLossInHg` (≈ 0.5–1.0), `doorOpenInH2O`, `altAirDeltaC` (≈ 10–17 °C for 3–5 %), `filterBlockedArea`, `ramEta`                                                                                                                                   | —                                                         | CT-5, CT-37, CT-38, CT-39                  |

Intercooler effectiveness range: M-18 Fig 2-39 p. 2-47 (hot side 0.5–0.6 at the -K's flows).

## 9. State flow

Compressor inlet (ram, or cowl static with the door open) → compressor (`compressorOutC`) → intercooler (`matC`,
`deckInHg`) → relief valve on the deck → throttle (`map`) → cylinders → exhaust (`turbineInletInHg`, `tit`) → turbines
and wastegate (`gate`) → tailpipes. The controller reads `deckInHg − map`, bleeds actuator oil (`oilP`), and moves
`gate`.

## 10. Calibration targets

One test each, in `tests/tsio550k-engine.test.ts` unless named. Conditions not stated: ISA, warm engine (oil > 150 °F),
boost off, both magnetos, governor at 2500 rpm, filtered air. Tolerances: chart ±1 hp / ±0.5 lb/h plus model slack;
POH table fuel flow exact, power ±4 %. A FIT target sets constants; the rest must then hold without retuning.

A. Chart and rating

- **CT-1** Rated power at the installed MAP: sea level, static, full throttle, full rich, 2500: MAP 36.0 ± 0.2, bhp
  306–318 (Fig 2-37 311.7 at 36.0; POH 315). POH 1-7, 2-6, 4-14, 4-17; M-18 Fig 2-37.
- **CT-2** The chart function reproduces Fig 2-37 at 20, 25, 30.5, 36.0, 36.5 in.Hg (2500 and 2300 ±1.5 hp; 2400 ±1.5
  hp 20–29, ±3 hp at 36.5).
- **CT-3** 2500 rpm, 30.5 in.Hg, best power: 262 bhp ± 2 % (chart 265.7). M-18 Table 2-2.
- **CT-4** Compressor inlet 6 °F above standard: power 1.0 ± 0.2 % lower. M-18 Table 2-2 note 1.

B. Turbo, wastegate, controller

- **CT-5** (FIT) Full throttle, full rich, 120 KIAS, 2500: MAP 36.0 ± 0.3 at 0, 5,000, 10,000, 15,000, 17,000 ft. POH
  4-14, 4-17; M-18 Table 2-2.
- **CT-6** (FIT) Same climb: gate fully closed (g < 0.02) and MAP first below 35.7 between 18,000 and 21,000 ft. M-18
  Table 2-2 gives a critical altitude of 18,000 ft with no MAP condition; the installed 36.0 needs less pressure ratio
  than the 37.5 rating, so not below 18,000.
- **CT-7** Above critical altitude MAP falls monotonically, 30.5–35.0 at 25,000 ft; full-rich fuel flow averages
  34.3 ± 1.5 GPH over 18,000–20,000 and 33.5 ± 1.5 over 20,000–25,000. POH 5-28/5-29; 5-34.
- **CT-8** (FIT) Sea level, full throttle: oil at 100 °F → MAP in (36.0, 37.0]; oil ≥ 150 °F → 36.0 ± 0.2; fuel-flow
  ratio cold/warm = MAP ratio ± 1.5 %; MAP never above 37.0 in this case. POH 4-17; 3-29, 3A-9 notes.
- **CT-9** Cruise 10,000 ft, 30.5 in.Hg, failure `wastegateOil`: gate open within 5 s; full-throttle MAP ≤ ram + 1.5
  in.Hg; engine stopped → gate 1. POH 3-27, 3-28.
- **CT-10** Sea level, `wastegateSeized: "closed"`, full throttle: MAP > 37.5 (MAN PRESSURE warning), relief opens, MAP
  cycles ≥ 0.5 in.Hg while the valve cycles, peak ≤ 40.0; reducing to 30.5 stops it. In every other target the relief
  never opens. POH 3-30, 3-29, 2-9; AMM 71-60 PDF 2542.
- **CT-11** 10,000 ft cruise, `inductionLeak`: MAP within 2 in.Hg of the normally aspirated value, no MAN PRESSURE,
  engine runs. POH 3-27.
- **CT-12** Tailpipe back pressure at rated ≤ 2.5 in.Hg. M-18 Table 2-1.
- **CT-13** Sea-level rated takeoff: manifold air ≤ 130 °F and intercooler ε ≥ 0.5. M-18 Table 2-6 (bound), Fig 2-39.

C. Fuel

- **CT-14** (FIT `fullRichLambda` rated, `ve`) Sea level, static, full throttle, full rich, warm: fuel flow 36.7–39.8
  GPH at the CT-1 MAP (target 38.2 ± 1.0); at 36.5 in.Hg (cold oil) 37.35–40.45. AMM Fig 73-20-2 PDF 2592; POH 4-17.
- **CT-15** (FIT `fullRichLambda` shape) Sea level, 2500, full rich at 173, 205, 236, 262 bhp: fuel flow inside the Fig
  2-36 LFR–RFR band (83.4–93.4, 100–110, 118–128, 133–143 lb/h) with 3 lb/h slack, not above RFR (the chart includes
  return flow, M-18 Table 2-4); full-throttle full-rich flow 36 ± 1.5 GPH from sea level to 17,000 ft (from POH 5-28).
- **CT-16** (loose) Sea level, 2500, 236 bhp: best-power mixture 103 ± 8 lb/h, peak-EGT mixture 89 ± 8 lb/h (Fig
  2-36); rated induction air reported against M-18 Table 2-6 (C7), no tolerance.
- **CT-17** Unmetered fuel pressure 7.0–9.0 psi at 600 rpm, 21.0–24.5 psi at 2500 full power; nozzle 14.2–14.8 psid at
  full power. AMM 73-20 PDF 2589; M-18 Table 2-4.

D. Ground operation

- **CT-18** (FIT `idleArea`) Started per POH 4-12, warmed, idle: 600–750 rpm (fit 700 ± 25), oil ≥ 10 psi. POH 4-15;
  AMM 73-20 PDF 2589.
- **CT-19** (FIT `singlePlug`) 1700 rpm: each drop > 25 and ≤ 150, differential ≤ 75; a failed magneto drops > 150.
  POH 4-15; M-18 7-3.3.
- **CT-20** POH 4-12 start (full rich, power lever full forward, BOOST, open ¼ in, START): running within 10 s; during
  START both magnetos fire with spark at TDC; then 1000 rpm with oil pressure rising. POH 4-12, 7-37; AMM 74-00.
- **CT-21** Static full throttle at sea level: 2500 ± 30 rpm; climb and cruise 2500 ± 20 off the fine stop; idle and
  run-up throttle-set. POH 4-17, 7-32, 7-39.
- **CT-22** Ground leaning: at 1000 rpm after start, leaning from full rich raises rpm to a maximum before it falls.
  POH 4-12 step 13.
- **CT-23** HIGH BOOST lockout: `highBoostEnabled` true iff (MAP ≥ 24 and pressure altitude ≥ 10,000 ft) or rpm < 500;
  otherwise HIGH BOOST runs as BOOST. POH 7-41.

E. Cruise (POH Section 5, lean of peak)

- **CT-24** (FIT `lambdaTarget`, `peakEgtPower`) White cells, ISA, 2500, MAP ≤ 30.5, mixture to the table fuel flow
  (±0.1 GPH, 6.0 lb/gal): bhp = pct × 315 ± 4 % at 2,000 ft (75/65/55), 10,000 and 18,000 ft (85/75/65/55), 25,000 ft
  (85/80/75/65/55). A white cell needing more than 30.5 is a fitting error. POH 5-32 to 5-34; 4-22.
- **CT-25** hp/GPH at the CT-24 points = table ± 4 % (14.6, 14.5, 14.4, 14.0, 13.6).
- **CT-26** 10,000 ft, 30.5: leaning to λ ≈ 1.25 keeps hp/fuel flow within ± 5 %; leaner, roughness rises before power
  reaches zero. POH 4-22.
- **CT-27** 10,000 ft, 85 % at 18.3: ISA → hottest CHT ≤ 420, both TIT ≤ 1750; ISA +30 °C → at least one of CHT > 420,
  TIT > 1750 or MAP > 30.5 needed. POH 5-32 note, 5-33.

F. TIT, EGT, CHT, oil

- **CT-28** (FIT) 10,000 ft, 30.5: at the 85 % target fuel flow, TIT is 50–75 °F (±15) below the sweep's peak. POH 4-22.
- **CT-29** TIT peaks within ±0.03 λ of the EGT peak; L and R differ by < 60 °F unfailed. POH 7-35, 1-12.
- **CT-30** CT-1 and CT-32: both TIT < 1750, no flag; > 1750 → TIT warning; > 1850, or > 1750 for more than 30 s →
  transient flag. POH 2-9, 3-30; M-18 Table 2-1.
- **CT-31** Sea level, full throttle, leaned toward peak: TIT > 1750; back to full rich → both < 1750 within 30 s; one
  magneto raises TIT at fixed mixture. POH 3-30, 4-14.
- **CT-32** (FIT `chtRise`, `oilRise`) Full-power climb at 120 KIAS at 5,000 and 15,000 ft: CHT ≤ 420, oil 180–240 °F,
  oil 30–60 psi, cooler heat < `coolerMaxBtuMin`. POH 4-19, 2-9, 2-6; M-18 Fig 2-38.
- **CT-33** Static full throttle for 60 s or more (thermal speed-up): CHT > 460 and the CHT warning. POH 4-14, 2-9.
- **CT-34** Cruise 10,000 ft, 75 %: oil 180 ± 15 °F; climb ≤ 240. POH 7-36; AMM 79-00.
- **CT-35** Hot idle ≥ 10 psi; cruise 30–60; cold start (ISA −15 °C) 60–100. POH 2-6, 2-9; M-18 Table 2-3.
- **CT-36** (loose) At a lean-of-peak cruise point, −0.5 GPH lowers the hottest CHT by 15 ± 8 °F. POH 4-22.

G. Alternate air

- **CT-37** 10,000 ft, 75 %, filter fully blocked: door opens (ALT AIR OPEN) with no pilot input; MAP within 0.3 of
  before; bhp 3–5 % lower. POH 3A-11, 7-37; AMM 71-60.
- **CT-38** 22,000 ft, full throttle, same failure: MAP ≥ 0.5 lower than with filtered air; the CT-6 climb with the door
  open closes the gate at least 1,000 ft lower. POH 7-38, 3A-11.
- **CT-39** Filter partially blocked (`filterBlockedArea`): door open at full power, closed again at ≤ 30.5 in.Hg. POH
  3A-11.

H. Limits, flags, robustness

- **CT-40** MAP flags: 36.5 < MAP ≤ 37.5 caution, > 37.5 warning, 36.0 none (D2). POH 2-9, 3-29, 3A-9.
- **CT-41** Above 18,000 ft with MAP < 15 → caution; at or below 18,000 none. POH 2-6.
- **CT-42** Normal scenarios keep turbine speed below the Fig 2-41 limit for its TIT; a seized-closed gate with the
  relief lifting at 25,000 ft may raise the flag. M-18 Fig 2-41; POH 3-30.
- **CT-43** Every scenario × every failure (IO-390 list + turbo list), 20 s at 60 Hz: no non-finite state (λ = ∞
  allowed).
- **CT-44** `tests/io390-engine.test.ts`, `io390-scene`, `io390-store` pass unchanged after every stage.
- **CT-45** START ENGAGED caution > 15 s, warning > 30 s of starter engagement. POH 3A-10, 3-49.
- **CT-46** OIL PRESS caution 10–30 psi only at ≥ 1000 rpm; warning < 10 or > 100. POH 3A-8, 2-9.
- **CT-47** (spec test) `limits` and `markings` agree (CHT 420/460, oil 10/30/60/100, oil T 240, rpm 2550, TIT 1750,
  MAP 36.5/37.5); every `markings` band cites POH 2-9.

Fit order: CT-2/3/4 → CT-14/1 (VE, full-rich λ) → CT-5/6/7, then CT-8 → CT-24/25/28 → CT-29 to 31 → CT-32 to 36 →
CT-18/19/22 → failures and alternate air. Everything else must then hold unchanged.

## 11. Scene

Generalise the existing builders and add one group file, `components/engine/scene/Turbo.tsx`; no `tsio550k` scene
folder. Scene layout data comes from `layoutFor(spec)` (`components/engine/scene/layout.ts`, defaults = today's IO-390
constants) and `engines/tsio550k/layout.ts` + `layout-turbo.ts`; the model never reads them (D5).

IO-390 constants that do not fit the -K; each becomes a layout field with today's value as the default:

| Field                                             | IO-390 (today)                     | TSIO-550-K                                                                                                         | Source                                           |
| ------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `stationsIn` (accessory face, front, prop flange) | derived from cylinder x            | −16.25 / +16.25 in (32.50 in drawn length); prop flange not yet located                                            | M-18 Fig 5-33 p. 5-53                            |
| `coverWidthIn`                                    | `envelopeIn.width`                 | FIT ≈ 33.6 (not yet located); never `envelopeIn.width` (42.4 is the intercoolers)                                  | M-18 Table 2-8; Fig 5-34                         |
| `camBelow`                                        | false                              | true                                                                                                               | M-18 Fig 2-5 p. 2-5                              |
| `valvePlane`, `ports`                             | fore-aft, intake under             | vertical (schematic): intake top, exhaust bottom                                                                   | M-18 2-1 p. 2-1                                  |
| `coversPerCylinder`                               | 1                                  | 2                                                                                                                  | Fig 5-33 (qualitative)                           |
| `counterweights`                                  | cheeks of #3, #2                   | cheeks of #2, #5                                                                                                   | M-18 2-2.2.1 p. 2-6                              |
| `throwHalfIn`                                     | 1.26                               | ≤ 1.23 (half the 2.47-in stagger)                                                                                  | Fig 5-34                                         |
| `starter`                                         | front ring gear                    | rear right-angle adapter, worm + spring clutch, 48:1                                                               | AMM 80-10 PDF 2798; M-18 2-2.2 p. 2-5; Table 2-9 |
| `governor`                                        | front top, cam spur                | front lower left, cam bevel gear, 1:1                                                                              | AMM 61-20 PDF 2450; M-18 2-2.1, 2-2.2            |
| `alternators`                                     | one belt 3.2:1                     | ALT 1 gear 3:1 right front; ALT 2 belt front left (ratio FIT)                                                      | POH 7-47; M-18 2-2.1, 2-2.2, Table 2-9           |
| `fuel`                                            | servo under the sump               | pump (rear) with mixture valve → throttle/metering (top) → manifold valve → 6 air-bled nozzles at the intake ports | POH 7-38; M-18 Fig 12-14 p. 12-23; Fig 5-35      |
| `oilCooler`                                       | not drawn                          | engine-mounted, left case behind #2, vernatherm                                                                    | M-18 2-1 p. 2-1; POH 7-36                        |
| `magDrive`                                        | cam gear                           | idler off the crankshaft gear (one extra gear)                                                                     | M-18 2-2.2 p. 2-5                                |
| `labels`, `camera`                                | hard-coded                         | per layout; camera fitted to the envelope (FIT, checked by screenshot)                                             | —                                                |
| `groupsFor(spec)`                                 | fixed `GROUPS`                     | adds `turbo` and `exhaust` for the -K (D8)                                                                         | —                                                |
| strings                                           | "four", "eight", "Lycoming", "IOM" | counts and names from the spec (`doc`, `parts`, as in #79)                                                         | —                                                |

Part groups:

- **Cylinders** (Fig 5-34 stations; 7 studs + 2 through-bolts; CHT port 0.374-24 UNF as printed, M-18 2-1).
- **Case** (breather between #2 and #4).
- **Valvetrain** (12 lobes; computed lobe gaps 0.044/0.019/0.044 m > 0.014 m).
- **Rotating** (six crankpins, five mains, counterweights #2/#5).
- **Turbo**: two turbochargers, shaft 14.82/14.81 in below the crank centre line, outboard 12.94/13.45 in, turbine aft
  face 3.97 in from the accessory face (Fig 5-33, dimensioned); one wastegate and actuator on the LH tailpipe; the
  controller drawn free-standing behind the engine, labelled as mounted on the upper firewall in the airplane (AMM 81-20
  PDF 2812); intercoolers 12.28/11.54 in long, outer edges 21.15/21.23 in from the centre line (Fig 5-34); the overboost
  valve on the LH intercooler outlet (AMM 71-60); turbo oil supply from the cooler via a check valve and tee,
  reservoirs, scavenge pump (AMM 79-00).
- **Exhaust**: risers → tees → transitions → turbines, crossover without the cabin-heat shroud, wastegate transition,
  two tailpipes (M-18 Fig 12-22 legend); a new `Exhaust` component.
- **Induction**: air boxes, alternate-air assembly with door, compressor and intercooler ducts, Y, throttle body on
  top, manifold runners down to the head tops, MAP port 0.125-27 NPTF. There is no `scene/Induction.tsx` today
  (`Induction` is a component in `Systems.tsx`).
- **Fuel, oil, ignition** (12 plugs, POH 7-37 mapping, magneto pressurization line), **drives**.

Animation sources: the §7 state contract. Wheel spin is drawn slowed (illustrative, and the part note says so); a
stopped engine shows the wheels still and the gate spring-open.

## 12. Page: monitor, panel, failures, scenarios, flags

Monitor (`Monitor.tsx`): colours from `markings` (absent = today's derivation); six EGT/CHT pairs plus TIT L/R bars on
the 1000–1800 °F scale; the small row adds Deck (in.Hg) and TIT peak (D14); the Power tile is brake hp ÷ 315, with a
title noting that the airplane's display uses its own algorithm (POH 7-36). Phone: 8 columns, TIT wraps if needed (CSS
only).

Panel (`EnginePanel.tsx`):

- Header and description from the spec (`doc`, `refs`, `modelNotes`).
- Controls: "Power lever (MAX – IDLE)" = `controls.throttle`; no propeller slider with `propeller.control: "fixed"`,
  readout "Governor: 2,500 rpm (factory set)" (POH 7-32, 7-39; AMM 61-20); "Mixture (RICH – CUTOFF)"; ignition
  OFF/R/L/BOTH + hold START (both magnetos, POH 7-37); fuel pump OFF / BOOST / HIGH BOOST-PRIME (D7); no alternate-air
  control with `induction.altAir: "automatic"`, readout "Alternate air door: open/closed".
- Readings for a turbo spec: deck, wastegate % open ("spring open" when stopped), TIT L/R, turbo speed (illustrative),
  charge air, overboost valve (closed / relieving), alternate-air door.
- Conditions: altitude 0–25,000 ft (`envelope.maxAltFt`), TAS 0–220 kt (`envelope.maxTasKt`, POH 5-34), oil 2–8 qt with
  a flag below 6.
- Specs / Model / Sources blocks driven by the spec: "Operating limits" rows from `markings` and the NEW limits (75 °F
  takeoff oil, 15 in.Hg above 18,000 ft, 25,000 ft, taxi ≤ 1,000 rpm POH 4-13, cranking 10/20 s, magneto check, idle).
- Pressure chart: caption from the spec (`ignition.advanceSrc`: 24° BTC ± 1°, M-18 Table 2-1); exhaust pressure =
  `turbineInletInHg`.
- No "Lycoming", "IOM", "four" or "eight" literals left in shared components.

Failures (turbo spec, sub-heading "Turbo system"): wastegate stuck closed / stuck open, turbocharger failed L / R,
induction leak, intercooler leak L / R, exhaust leak, oil leak, actuator oil loss, controller misadjusted, TIT probe
failed L / R; plus the existing magneto, pump, starter, starter stuck, plug and nozzle failures and #79's intake leak.
"Air filter blocked" becomes "Induction filter blocked (ice or debris)" (the door opens by itself). Sources POH 3-27 to
3-31, 3A-9, 4-17.

Scenarios (`engines/tsio550k/scenarios.ts`, D6), each a POH procedure:

| id            | Setup                                                                                                                                | Source                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| `cold`        | ISA sea level, all off; note: prime with HIGH BOOST/PRIME for 2 s on a first start, power lever full forward then ¼ in, START ≤ 10 s | POH 4-11, 4-12                 |
| `idle`        | started, 1000 rpm, mixture leaned to maximum rpm (D15), power lever idle; idle 600–750, taxi ≤ 1000                                  | POH 4-12, 4-13, 4-15           |
| `runup`       | 1700 rpm, mixture as for taxi; drop ≤ 150, difference ≤ 75                                                                           | POH 4-15                       |
| `takeoff`     | full forward, full rich, BOOST, sea level; ≈ 2500 rpm, 36.0 in.Hg, fuel flow in the green arc                                        | POH 4-14, 4-17                 |
| `coldoil`     | as takeoff with oil just above 75 °F; MAP 36.0–37.0, MAN PRESSURE caution above 36.5                                                 | POH 4-17, 3A-9, 2-6            |
| `climb`       | full forward, full rich, BOOST, 120 KIAS, settled at 18,000 ft; MAP holds 36.0 to about the critical altitude                        | POH 4-19, 4-20; M-18 Table 2-2 |
| `cruiseclimb` | 30.5 in.Hg, target fuel flow (lean of peak), 120 KIAS minimum, CHT < 420                                                             | POH 4-21                       |
| `cruise`      | 10,000 ft, ≤ 30.5 in.Hg, 75 % at 16.4 GPH (the label carries the numbers)                                                            | POH 4-22, 5-33                 |
| `highcruise`  | 25,000 ft, ≤ 30.5, lean of peak; MAP not below 15                                                                                    | POH 2-6, 2-19, 4-22, 5-34      |
| `descent`     | MAP 18–20 in.Hg, mixture keeps CHT ≥ 240                                                                                             | POH 4-23                       |

Flags (`alerts.ts`), named as the POH CAS messages; `alerts.ts`'s note that these are study flags, not an airplane's
CAS, stays: MAN PRESSURE caution/warning (D2), TIT warning and transient, CHT caution/warning, RPM warning, OIL PRESS
warning / caution (≥ 1000 rpm), OIL TEMP warning, START ENGAGED caution/warning, ALT AIR OPEN caution; advisories: MAP <
15 above 18,000 ft, oil < 6 qt, takeoff power with oil < 75 °F, cranking > 10 s, leaned above 30.5 in.Hg, relief open,
turbine speed against TIT. The AMM's 235 °F / 60 psi oil cautions are not used (the POH governs).

## 13. Registry and routing

- `ENGINES` gains `TSIO550K` after the existing engines; `ENGINE_IDS` derives from it and `/engines/tsio550k` exports
  as a static page. Picker sub-label "Continental TSIO-550-K · 315 hp"; tab title "TSIO-550-K engine · Airplane
  Systems".
- The `ENGINE_IDS` copies follow, as #79 does for the O-360: `infra/cloudfront/view-rewrite.js` and the function source
  embedded in `infra/aws/site.json` (checked by `tests/cloudfront-view-rewrite.test.ts` and
  `tests/aws-template.test.ts`). `engines/README.md` step 2 is updated to name both copies.
- `scripts/test-fleet-ui.mjs`: the engines group lists every engine's link, `End` reaches the last, and the dropdown
  stays inside its height bound.

## 14. Tests

- Model: `tests/tsio550k-engine.test.ts`, one test per CT, named after its source; `tests/tsio550k-spec.test.ts` (CT-47,
  chart data shape); IO-390 tests unchanged (CT-44). The contract stage adds a golden test: a scripted 20 s IO-390 run
  with every NEW field absent equals the same run with the defaults written out explicitly.
- Scene: generic invariants as `describe.each` over every engine (lobes face tappets, no lobe overlap, 1:1 rockers,
  piston below head, covers within `coverWidthIn`, gears mesh at the spec ratios, no crank-cheek overlap, bounding box
  within `envelopeIn` + a stated margin, `groupsFor` has `turbo` iff a turbo layout); -K tests named after M-18/POH
  values (stations, counterweights, ratios, turbo stations, intercoolers, one LH wastegate on the LH tailpipe, intake on
  top, governor lower left, starter rear); animation maps as exported pure helpers (gate plate angle monotone in `gate`;
  wheel rate 0 when stopped and for a failed side, monotone in `turboRpm`; door open iff `altAirOpen`).
- Store and scenarios: `tests/tsio550k-store.test.ts` (`// vitest: isolate`): store tests parametrised over engines;
  `scenariosFor` lists; the worker resolves -K ids; notes cite the POH; `noFailures` turbo members.
- Flags: `tests/tsio550k-alerts.test.ts`, boundary tests per POH page; IO-390 `limitFlags` unchanged on the existing
  fixtures.
- React: a `tests/react/` test renders `EnginePanel` for each engine (-K: no propeller slider, three pump positions,
  altitude maximum 25,000, turbo failures; IO-390 unchanged). `check-react-compiler` stays green.
- Browser: a new `scripts/test-engine-ui.mjs` (+ `test:ui:engine`) for every engine, desktop 1280×800 and phone 390×844
  (phone also dark), each case with a `pageerror` collector registered before the first navigation and asserted empty;
  cases: load, monitor bars, controls, Takeoff scenario MAP/RPM, stuck-closed gate → MAN PRESSURE, part groups
  including Turbo, theme, picker round trip; run against the static export.
- Screenshots: `npm run shot` learns engine views (cameras iso/side/top/rear/front/below, hidden groups and a paused
  state) before the first visual change; before/after on every visual change; the IO-390 `--compare` shows no change.

## 15. Build sequence

Each stage is a self-contained change that keeps the IO-390 tests passing (CT-44). Stages on one line can proceed in
parallel (no shared files).

| Stage | Title                                                        | Main files                                                                                                      | After   | Tests                                                     |
| ----- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------- | --------------------------------------------------------- |
| 1     | Model contract (types, state, IO-390 literal defaults)       | `engines/types.ts`; declarations and literal reads in `engines/model/engine.ts`                                 | —       | golden IO-390 run                                         |
| 2     | Screenshot support for engine pages                          | `playwright.shots.config.mjs`, `scripts/shot*.mjs`                                                              | —       | shot view parsing                                         |
| 3     | Engine spec data and SOURCES.md                              | `engines/tsio550k/spec.ts`, `SOURCES.md`                                                                        | 1       | `tests/tsio550k-spec.test.ts` (CT-47)                     |
| 4     | Continental chart and fuel metering                          | `performance.ts`, `fuel.ts`, `trim.ts` (`mixtureFor`), VE in `induction.ts`                                     | 3       | CT-2, 3, 4, 15 (static), 16                               |
| 5     | Generalise the engine scene (IO-390 unchanged)               | `components/engine/scene/*` (generic), `scene/layout.ts`, `engines/tsio550k/layout.ts`                          | 2, 3    | scene invariants, `tests/tsio550k-scene.test.ts`          |
| 6     | Scenarios per engine                                         | `engines/tsio550k/scenarios.ts`, `engines/model/scenarios.ts`, `store.ts`, `scenario.worker.ts`                 | 3       | `tests/tsio550k-store.test.ts`                            |
| 7     | Turbocharger, wastegate controller, intercooler              | `engines/model/turbo.ts` (new), turbo branch of `engine.ts`                                                     | 4       | CT-1, 5–9, 12–14, 15 (climb)                              |
| 8     | Registry and routing                                         | `engines/index.ts`, `infra/cloudfront/view-rewrite.js`, `infra/aws/site.json`, `engines/README.md`, fleet tests | 4, 5    | fleet UI, `test:deploy`                                   |
| 9     | Controls: START on both magnetos, fixed governor, HIGH BOOST | `sparks` / `governedRpm` / pump in `engine.ts`, `cycle.ts`, `propFor`                                           | 7       | CT-20 (mechanics), 21, 23                                 |
| 10    | Relief valve, TIT, turbo oil, automatic alternate air        | relief / TIT / oil / alternate-air branches in `engine.ts`, `turbo.ts`                                          | 9       | CT-10, 29, 37, 38, 39, 42 (speed)                         |
| 11    | Turbo failures and POH flags                                 | `engines/model/alerts.ts`, failure branches                                                                     | 10      | `tests/tsio550k-alerts.test.ts`; CT-11, 30, 40–43, 45, 46 |
| 12    | Turbo part group in the scene                                | `scene/Turbo.tsx` (new), `engines/tsio550k/layout-turbo.ts`                                                     | 8       | `tests/tsio550k-scene.test.ts`                            |
| 13    | Exhaust, induction, fuel, drives and oil in the scene        | `scene/Exhaust.tsx` (new), -K branches in `Systems.tsx`, `Case.tsx`                                             | 12      | `tests/tsio550k-scene.test.ts`                            |
| 14    | Monitor and panel                                            | `Monitor.tsx`, `EnginePanel.tsx` (not Failures), `PressureChart.tsx`, `EngineApp.tsx`                           | 6, 8, 9 | `tests/react/` panel test                                 |
| 15    | Calibration to the POH cruise, thermal and ground targets    | `calibration` FIT values in `engines/tsio550k/spec.ts`, the fit section of SOURCES.md                           | 6, 11   | CT-17–19, 20 (timing), 22, 24–28, 31–36; scenario landing |
| 16    | Failures panel, flags and engine-page browser test           | `EnginePanel.tsx` Failures/Flags, `scripts/test-engine-ui.mjs`                                                  | 11, 14  | `npm run test:ui:engine`                                  |

- In parallel: 1 and 2; then 3; then 4, 5 and 6; then 7 and 8.
- Three chains then run side by side: model 9 → 10 → 11 (each touches `engines/model/engine.ts`); scene 12 → 13 (shared
  `EngineScene.tsx` mounts, labels and `engines/tsio550k/layout.ts`); UI 14 once 9 is in.
- Last, in parallel: 15 (the final model stage) and 16.

Model and scene work never share a file: the model reads only `EngineSpec`; the scene's layout data lives in
`engines/tsio550k/layout*.ts` behind `layoutFor(spec)`; FIT retuning in `engines/tsio550k/spec.ts` is model-only.

## 16. Risks

1. **Lean-of-peak cruise points may not close at ≤ 30.5 in.Hg** (85 % at 18.3 GPH needs ≈ 1,800 lb/h of air at
   λ ≈ 1.1; estimate ≈ 1,770 at 30.5 in.Hg, 10,000 ft, VE 0.93). Fit VE, `fullRichLambda` and `lambdaTarget` together
   early (stages 4 and 15); CT-24 fails rather than loosening.
2. **Coupled loops** (quasi-steady turbo, proportional controller, the `settle({map})` trim) can limit-cycle and fake
   the CT-10 surge or drift CT-5. Spool and gate lags stay well above the 1/120 s substep; "the relief never opens
   outside CT-10" is an assertion in every target.
3. **IO-390 regressions** from `induction`, `fuel`/`mixtureFor`, literal moves and the scene generalisation. Branch,
   don't rewrite; byte-identical defaults; the golden-run test (stage 1); IO-390 `--compare` screenshots (needs stage
   2 first).
4. **Power step at the 30.5 in.Hg basis switch**: the ±1 in.Hg blend has no document; CT-1 and CT-3 must both hold,
   with no step > 1 % over 29–32 in.Hg.
5. **Few thermal points** (TIT has only limits and the 50–75 °F rule): the shared constants `titOffsetF`,
   `titCrossover`, `chtRise` and `coolingTrim` are easy to over-fit; follow the fit order in §10.
6. **Drawing scale and phone layout**: several -K stations are scaled or not yet located; the engine is 1.5× taller than
   the IO-390; 6+2 monitor bars, 10 scenarios, ~13 failures, and one more engine in the picker against the dropdown's
   height bound.
7. **An uncalibrated page in the picker**: between the registry (stage 8) and calibration (stage 15) the -K page runs
   physics that do not yet meet the POH targets.
