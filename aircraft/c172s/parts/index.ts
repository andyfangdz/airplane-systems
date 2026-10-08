/**
 * Declarative catalogue of the C172S NAV III (POH 172SPHBUS-04), one file per system group:
 * - catalogue.ts — `CAT` and its label lists, `P3`/`PV`, the `part`/`shell`/`surface`/`onSurf` wrappers and the per-frame
 *   animation helpers the sections share (no parts)
 * - airframe.ts — fuselage, spinner, wing, tip and stabilizer shells
 * - surfaces.ts — flaps, ailerons, elevator and rudder, and the details riding on them (dischargers, balance weights, trim tabs)
 * - gear.ts — main and nose gear, wheels, brakes, steering, parking brake, tow bar
 * - engine.ts — propeller, engine, ignition, oil, induction, exhaust, cooling, engine mount and engine controls
 * - structure.ts — firewall, baggage walls, spars, struts, door posts, tiedowns, steps; cockpit panel, pedestal and seats
 * - controls.ts — flight controls (Figure 7-1), GFC 700 servos and controls, electric flap drive
 * - fuel.ts, electrical.ts, avionics.ts — those systems
 * - pitot.ts — pitot-static, stall warning and vacuum
 * - lighting.ts — exterior and interior lights
 * - cabin.ts — cabin heat and ventilation, cabin and safety equipment
 *
 * The sections are imported below in registration order. Part ids come from a running counter and the first part with a
 * given name gets the label pin, so keep this order, and never import a section from one that comes before it here.
 * Shared constants go in catalogue.ts.
 */
export { CAT, P3, PV, onSurf, surfacePivot } from "./catalogue";
import "./airframe";
import "./surfaces";
export { MG, NOSE, NOSE_CASTER } from "./gear";
export { CYLS, INTAKES, NOZZLES, PROP } from "./engine";
import "./structure";
export { YOKES } from "./controls";
export { FSEL } from "./fuel";
export { ALTERNATOR, BATTERY_TERMINAL, JBOX } from "./electrical";
import "./avionics";
export { PITOT, STALL_INLET, STATIC_PORT } from "./pitot";
export { LIGHTS } from "./lighting";
export { MANIFOLD } from "./cabin";
