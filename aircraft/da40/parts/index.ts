/**
 * Declarative catalogue of every modelled DA40 XLS component (N949KC configuration, s/n 40.949).
 * Notes cite the DA 40 AFM Doc. 6.01.01-E Rev. 8 ("AFM x-y"), the Garmin G1000/GFC 700 AFMS 190-00492-10
 * ("AFMS p. n"), the G1000 SMM 190-00303-03 ("SMM") and, where marked, the TCDS or the GFC 700 load analysis.
 * Positions are in airplane coordinates (see geometry.ts) unless a part has a `parent` moving group.
 *
 * One file per system group; each registers its parts when imported, in the order below:
 * - catalogue.ts: `CAT`, the `part` / `shell` / `surface` / `onSurf` helpers and the DA40's own per-frame part
 *   animations (`fires`, `glow`, `leverAnim`…; the shared ones are in lib/anims.ts)
 * - airframe.ts: fuselage, spinner, wing, tip and tail shells; the hinged canopy and rear-door shells
 * - surfaces.ts: flaps, ailerons, elevator, rudder; static dischargers, hinges, stall strips, wing steps, trim tabs
 * - cowling.ts: cowling nose and cooling-air inlets
 * - gear.ts: main and nose gear, wheels, fairings, brakes, parking brake, rudder pedals
 * - engine.ts: propeller, Lycoming IO-360 and its accessories, exhaust, engine controls and ignition key
 * - structure.ts: firewall, baggage frame, roll bar, spar carry-throughs, root ribs, jack points, lower fin
 * - cabin.ts: instrument panel, consoles, seats, baggage, emergency equipment, control sticks
 * - controls.ts: flight-control mechanisms (bellcranks, horns, trim, AFCS servos); flap drive and selector
 * - fuel.ts: fillers, drains, vents, selector, fuel pump, gascolator
 * - electrical.ts: batteries, relays, regulator, breaker panel, switch rows and dimmers
 * - avionics.ts: G1000 LRUs, display bezels, standby cases, compass, remote enclosure, antennas
 * - pitot.ts: pitot-static mast, static system and stall warning
 * - environment.ts: heating and ventilation; canopy and door hardware
 * - lights.ts: exterior and cabin lights
 * Part ids come from a global counter and the first part of each name gets the label pin, so keep the import order,
 * and let a section import anchors only from sections above it (importing a later one would register it first).
 */
export { CAT, surfacePivot } from "./catalogue";
export { CANOPY_HINGE, DOOR_HINGE, CANOPY_SHELL, DOOR_SHELL } from "./airframe";
import "./surfaces";
import "./cowling";
export { MG, NOSE_GEAR, NOSE_CASTER } from "./gear";
export { PROP, CYLS } from "./engine";
import "./structure";
export { GMA_Z, CBP_Z, DEFROST_X, RB_NOZZLE } from "./cabin";
import "./controls";
export { SEL } from "./fuel";
import "./electrical";
export { DISPLAY_X, STBY_X, ENCL } from "./avionics";
export { PITOT_Z, pitotBase, STALL_Z, STALL_HOSE } from "./pitot";
import "./environment";
export { LIGHTS } from "./lights";

export type { PartSpec } from "@/lib/catalogue";
