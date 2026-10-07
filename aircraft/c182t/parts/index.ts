/**
 * Declarative catalogue of the C182T NAV III (POH 182TPHAUS-04 Rev 4 + Supplement 3), one file per system group:
 * - catalogue.ts — `CAT` and its label lists, `P3`/`PV`, the `part`/`shell`/`surface`/`onSurf` wrappers, the placement helpers
 *   (`wp`, `cAt`, `top`) and the per-frame animation helpers the sections share (no parts)
 * - airframe.ts — fuselage, spinner, wing, tip and stabilizer shells
 * - surfaces.ts — flaps, ailerons, elevator and rudder, and the details riding on them (dischargers, balance weights, trim tab)
 * - gear.ts — main and nose gear, wheels, fairings, brakes, steering, parking brake, tow bar
 * - engine.ts — propeller, engine, ignition, oil, induction, exhaust, cooling, cowl flaps, engine mount and engine controls
 * - structure.ts — firewall, aft cabin wall, spars, struts, door posts, tiedowns, steps; cockpit panel, pedestal and seats
 * - controls.ts — flight controls (Figure 7-1) and the electric flap drive
 * - fuel.ts — fuel system
 * - governor.ts — propeller governor and the throttle, propeller and mixture cables
 * - electrical.ts — electrical system
 * - avionics.ts — G1000 units, faceplate detail, antennas, compass, and the KAP 140 autopilot and its servos
 * - pitot.ts — pitot-static, stall warning and vacuum
 * - lighting.ts — exterior and interior lights
 * - cabin.ts — cabin heat and ventilation, cabin and safety equipment
 *
 * Fore/aft positions are the POH Figure 6-9 equipment-list arms; butt lines and heights are placed from the descriptions in
 * Section 7 and Figure 7-2 (the POH gives no BL or WL).
 *
 * The sections are imported below in registration order. Part ids come from a running counter and the first part with a
 * given name gets the label pin, so keep this order. A section may import only from catalogue.ts or from a section above it
 * here (importing a later one would register its parts first); shared constants go in catalogue.ts.
 */
export { CAT, P3, PV, onSurf, surfacePivot } from "./catalogue";
import "./airframe";
import "./surfaces";
export { MG, NOSE, NOSE_CASTER, NOSE_RAKE } from "./gear";
export { COWL_FLAP, CYLS, KNOB, PROP } from "./engine";
import "./structure";
export { FLAP_LEVER, YOKES } from "./controls";
export { DIVIDER, FSEL, TANK_BL } from "./fuel";
export { GOVERNOR } from "./governor";
export { JBOX } from "./electrical";
export { KAP, KAP_LCD } from "./avionics";
export { PITOT, STALL_VANE, STATIC_PORTS } from "./pitot";
export { LIGHTS } from "./lighting";
export { MANIFOLD } from "./cabin";
