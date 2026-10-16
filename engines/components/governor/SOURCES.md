# Propeller governor sources and how the numbers were read

## Taken as printed

| What                                                                                                         | Where                                                           |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| The governor's parts: gear pump, pilot valve, flyweights, speeder spring, relief valve, adjusting rack       | FAA-H-8083-32B ch. 7, pp. 7-8 to 7-9, Figures 7-15, 7-16        |
| Underspeed, overspeed and on-speed conditions; the speeder spring's compression sets the rpm                 | pp. 7-9 to 7-12, Figures 7-17 to 7-19                           |
| Governor pump boost "approximately 300 pounds per square inch"                                               | p. 7-6                                                          |
| Relief valve "set 275 psi" (the handbook's typical governor)                                                 | Figure 7-16                                                     |
| The non-feathering hub: piston on the front, spring, pitch-change rod and fork; oil to increase blade angle  | pp. 7-14 to 7-15, Figure 7-24                                   |
| Counterweighted hubs: oil to low pitch, counterweights to high pitch                                         | pp. 7-9, 7-14                                                   |
| IO-390-C: 215 hp at 2,700 rpm; front governor drive 0.895:1; normal oil pressure 55–95 psi                   | Lycoming IO-390-C IOM, Tables A-1, A-2, A-4 (see engines/io390) |
| The SR20's Hartzell HC-E3YR-1RF/F7392S-1: oil drives high pitch, spring and twisting moment return low pitch | SR20 POH 7-40, AMM 61-10 p. 1 (as cited in aircraft/sr20)       |

The handbook is the FAA's
[Aviation Maintenance Technician Handbook – Powerplant](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/amt_powerplant_handbook.pdf),
FAA-H-8083-32B; chapter 7 is published separately as `09_amtp_ch7.pdf` on faa.gov. Page numbers are the handbook's
own. Its governor description is generic (it describes a counterweighted hub); the 275 psi relief setting is for the
"typical governor" it draws, not a specific Hartzell or Woodward model.

The handbook also says the speeder spring's "governing range is limited to about 200 rpm"; the model follows the IO-390
simulation's 2,000–2,700 rpm propeller-control range instead, so that sentence is not modelled.

## Not published: chosen to fit

Everything in `GOVERNOR.model` (spec.ts): flyweight force, speeder-spring rate, pilot-valve travel, land overlap and
port size, valve lag, pump flow, port and leakage flows, the blades' return pressure and the hub spring, and the worn,
sticking and stuck-open failure values. They are chosen so the governor behaves as the handbook describes (holds the set
rpm within a few rpm, overshoots and settles after a change, rests on the low-pitch stop below its range) and are not
Hartzell, McCauley or Woodward data. The engine is a torque source (rated torque at full throttle) and the propeller's
load, pitch range, governor minimum rpm and inertia are the IO-390 simulation's model constants (engines/io390). The
3D view's sizes and shapes are schematic, and the pilot valve's movement is drawn four times larger.
