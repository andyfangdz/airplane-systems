# Fuel injection (RSA) sources and how the numbers were read

The page runs its own copy of the IO-390-C engine simulation (`engines/io390`), so every flow, pressure and power it
shows comes from that model and its sources (`engines/io390/SOURCES.md`). This folder (`model.ts`) adds only what the injector's
parts are doing and the limits of the nozzle curve.

## How the parts work

**FAA-H-8083-32B, Aviation Maintenance Technician Handbook – Powerplant, Chapter 2**, "Bendix/Precision Fuel-Injection
System", pp. 2-21 to 2-24 (Figures 2-30 to 2-38). Public domain. It describes, and the scene draws:

- the airflow section: impact tubes (inlet air pressure) and venturi throat (venturi suction) on the two sides of the
  air diaphragm; their difference times the diaphragm area is the air metering force;
- the regulator: the fuel diaphragm between unmetered (fuel inlet) and metered fuel pressure, the fuel metering force;
  the ball valve on its stem opens until the two forces balance; a constant-head idle spring for low power;
- the fuel metering section: inlet strainer, manual mixture control rotary plate (full rich at the stop, idle cut-off),
  idle valve on an adjustable link from the throttle, main metering jet;
- the flow divider: keeps the metered fuel under pressure, divides it at idle, opens fully above idle so the nozzles
  set the distribution, shuts the nozzle lines at idle cut-off; a pressure gauge on it serves as the flow meter;
- air-bleed nozzles, one per cylinder, discharging into the intake port.

The pressure colours follow the handbook's figures.

## From the IO-390 IOM (January 2017)

- Fuel injection system parts and lines (fuel manifold, injector, four nozzles, diaphragm-type pump): p. 4, Figure 7.
- Injector model: Table A-1. Boost pump outlet limits at the injector inlet (14–45 psi parallel, 14–35 psi series) and
  fuel pressure at the pump inlet (−2 to +35 psi): Table A-2, p. 53.
- Inlet strainer removed, cleaned and reinstalled when a new engine is prepared: pp. 11, 13.
- **Figure C-2 (C-12855B), p. 58.** The nominal curve is the engine spec's. The high and low limits were read from the
  figure's embedded image (200 dpi) by finding each curve's pixels in the columns at whole and half psi and converting
  against the grid lines; reading uncertainty about ±0.3 lb/h. The figure is titled for the RSA-5AD1 although Table A-1
  lists the RSA-10AD1/-10AD2 (as `engines/io390/SOURCES.md` notes).

## Troubleshooting

**Precision Airmotive Form 15-901C** (4/30/02), Installation Troubleshooting Chart, RS/RSA Fuel Injection Systems: high
fuel flow reading with a plugged nozzle, low take-off flow with a sticky flow divider, poor cut-off, rough idle from
induction leaks, the 25–50 rpm idle mixture rise at 700 rpm.

## Manufacturer training cross-check

**Precision Airmotive Form 15-812B, RSA Fuel Injection System Training Manual**
([manufacturer PDF](https://precisionairmotive.com/wp-content/uploads/2019/06/15-812_b.pdf)), printed pp. 5,
7–8, 13, 17, reviewed October 23, 2026. The scan's PDF page indices differ from its printed pagination.
The regulator balances diaphragm forces; the idle spring supplements the air force near idle and is taken up above
that range. The kernel now adds pressure heads before the square root and releases the spring progressively.
`servoHead` supplies both the kernel and the cutaway. The displayed fuel force is inferred from delivered flow and
effective mixture area, so insufficient supply no longer falsely reports balance.

The IOM Table A-1 explicitly lists **AVStar** RSA-10AD1/-10AD2. Precision's training diagrams explain the RSA
principle, not proof of an installed Precision unit or dimensionally accurate AVStar internals. Also, a blocked
fuel restrictor and a blocked nozzle **air bleed** are different faults (15-812B p. 17); the existing nozzle failure
control models only the fuel restrictor. See [the research and audit](../../FUEL-METERING-RESEARCH.md).

## Not published: drawn or chosen

- No pressure inside the injector is published. The panel gives the air and fuel metering forces relative to rated
  air flow at sea level, from the square of the air mass flow over the inlet density (the venturi is an orifice).
- The spring's equivalent zero-air flow (`SERVO_IDLE_HEAD_LBH`, 3.5 lb/h) and release point (air-derived full-rich
  fuel flow of 20 lb/h) are illustrative fitting constants, not published spring settings. The supplemental head
  tapers quadratically to zero; this is a schematic take-up law, not measured spring compression.
- Valve travels (ball valve, flow divider, mixture plate, idle valve) are drawn, as is the flow above which the flow
  divider is shown fully open (`DIVIDER_FULL_LBH`: the handbook says only "above idle").
- Shapes, sizes and the flat layout are schematic, after the handbook's cutaway figures, not the unit's drawings.
- The Precision RSA-5/RSA-10AD1 Operation and Service Manual (Form 15-338) was not available to read; nothing here is
  taken from it.
