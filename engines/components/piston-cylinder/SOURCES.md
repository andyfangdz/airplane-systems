# Piston cylinder

An isolated, externally driven cylinder bench. It uses the IO-390 geometry and existing engine mixture and
thermal relationships. It is not an aircraft performance or maintenance diagnostic model.

## Published information

[Lycoming IO-390-C Series Installation and Operation Manual, January 2017](https://www.lycoming.com/sites/default/files/attachments/IOM-IO-390-C%2520Series%2520-%25201-31-17.pdf):

- Two spark plugs per cylinder: System Description p. 2.
- Bore, stroke, compression ratio and 20° BTC ignition timing: Table A-1, pp. 51–52.
- 465°F maximum CHT at the thermocouple: Table A-2, p. 53. The EGT meter is a display range, not a published limit.
- Magneto checks and fouling caution: pp. 37–38. This bench selects plugs directly rather than claiming a particular
  magneto-to-plug wiring installation.
- 75% cruise fuel flow (12.8 gph at 2,450 rpm): Table A-1, p. 51, used as a reference for the illustrative fuel schedule.

[FAA-H-8083-32B, Aviation Maintenance Technician Handbook — Powerplant](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/amt_powerplant_handbook.pdf):

- Carbon fouling and overrich idle mixtures, pp. 4-33–4-34: soot accumulates at low heat/turbulence and can prevent
  a spark from bridging the gap. This supports the mechanism, not the bench's chosen fouling rates.
- Figure 3-8, p. 3-5: sticking engine valves are a cause of rough running. The bench's completely stuck-open/closed
  cases are schematic fault extremes, not the handbook's quantitative model.

- Detonation, pre-ignition and intake backfiring: pp. 10-29–10-30. Detonation is end-gas autoignition after
  ignition; pre-ignition comes from a hot spot before the timed spark; a slow-burning lean charge can ignite the
  intake when its valve opens. The handbook notes that light/medium detonation may have no obvious cockpit symptoms.

See also [IO-390 sources](../../io390/SOURCES.md).

## Shared model and explicit assumptions

- Slider-crank, chamber volume and valve lift use `engines/model/cycle.ts`. Rod length and valve events are existing
  illustrative assumptions, not published Lycoming data. Valve lift is normalized, not a measured cam profile.
- `engines/model/mixture.ts` supplies mixture power, combustion stability and EGT/head-heat curves. Their shape is
  illustrative; the engine specification contains the calibrated best-power anchors.
- Fuel equivalence ratio φ is a direct fuel/air setting, with λ = 1/φ. Zero shuts off fuel. It is not a calibrated
  cockpit mixture-lever position. Per-cylinder fuel flow scales the reference cruise flow by charge, shaft rpm
  and φ; it does not solve the fuel servo or manifold airflow.
- The engine's `singlePlug`, `egtBase`, `egtGain`, `chtRise` and `chtTau` constants are reused. As in the engine
  model, one operating plug reduces work and adds a 60°F term to EGT. That term is a model assumption, not a
  published diagnostic threshold. EGT responds over 3 s when firing / 12 s otherwise; CHT over 150 s.
- Thermal load scales with charge, relative combustion work and shaft speed / rated rpm.
  Ambient is fixed at 59°F with fixed cooling. Shaft speed and charge are imposed by the bench, even with failed
  ignition or valves; there is no propeller/torque equilibrium. Playback speed changes only the animation.
- Fouling is an accelerated example: at less than 1,200 rpm, φ > 1.35 and CHT < 320°F, deposits increase at
  `(φ - 1.35) / 18` per second, with the top plug accumulating at 75% of the lower plug's rate. At 80% deposits a
  plug ceases firing. All these thresholds, rates and asymmetry are illustrative, not service-life predictions.
  The rich-idle scenario starts with deposits to make progression visible. Leaning stops accumulation but does not
  remove deposits. Service plugs represents maintenance and clears them explicitly.
- A valve stuck open is held at 55% normalized lift; stuck closed at zero. Any stuck valve eliminates useful
  cylinder work in this simplified model (loss of charge/sealing/scavenging). The model does not predict transient
  trapped-gas temperatures, valve-fault-induced backfires, valve-to-piston collisions, or mechanical damage.
- Work and roughness are mean indicators, not a simulation of individual random misfires. A spark may occur
  without useful combustion (fuel off or valve fault). Temperatures cool rather than snapping to ambient.
- The geometry is schematic, including relocated dual plugs and probes for visibility, head cutaway, ports,
  piston thickness, fins, electrodes and colours. The crankshaft front web and main journal are cut away to
  expose the connecting-rod bearing on the offset crankpin; journal, web, bearing dimensions and visible clearances
  are illustrative, not manufacturing dimensions. Colours identify strokes rather than measured gas temperatures.

Phase zero is firing TDC: power 0–180°, exhaust 180–360°, intake 360–540°, compression 540–720°.
Initial temperatures (300°F CHT / 1,100°F EGT; rich-idle scenario 230°F / 900°F) are illustrative warm states.
The route owns a fixed 120 Hz clock. Pausing freezes the whole bench, including temperatures and deposits;
angle scrubbing does not integrate time. Scenario selection resets controls, deposits, temperatures and clock.

## Abnormal combustion demonstrations

These are explicitly selected faults, not inferred diagnoses or predictions of onset. Only one combustion fault
can be selected at a time. Temperatures and work describe a severe illustrative case; no octane, chemistry,
pressure-wave solver, structural damage or probability of an event is modeled.

- **Detonation:** requires a burnable charge, working ignition and free valves. The selected demonstration becomes
  active at charge > 75%, CHT > 380°F and 0.8 ≤ φ < 1.3. These gates are illustrative, not operating limits.
  It reduces relative work by 15%, adds 180°F to the CHT target and uses a 45 s head response. Orange rings appear
  10–70° after firing TDC, after the timed spark. Reducing charge or enriching suppresses this particular example.
- **Pre-ignition:** the selected hot spot can ignite a burnable charge with both plugs off or fouled. It reduces
  work by 35%, adds 360°F to the CHT target and uses an 18 s response. The flame appears at 660–700° (60–20° before
  firing TDC), before the unchanged 20° BTC spark. The hot-spot source remains selected until cleared explicitly;
  fuel cut-off or a stopped shaft suppresses combustion. This is not a simulated early spark.
- **Intake backfire:** demonstrates a slow-burning lean charge, with working spark ignition, free valves and
  φ < 0.8. It reduces work by 35% and subtracts 100°F from the EGT target to represent intermittent/cool running.
  Flame and reversed particles appear only at 340–410°, with positive intake lift. Enriching suppresses the example.
  Exhaust afterfire and backfire from incorrect ignition timing are not modeled.
- Active abnormal cases have a minimum 45% illustrative roughness indicator. Initial CHT is 430°F for detonation
  and 420°F for pre-ignition. Animation angles, thresholds, thermal terms and penalties are chosen demonstrations,
  not manufacturer measurements. Effects use the fixed clock; scrubbing changes only the visible cycle event.
