/** NAV III power module/standby components: POH Fig 7-7 pp. 7-47–58; 172RPC24 24-34/24-50.
 * Circuit topology follows POH; module internal packing/port positions are schematic. */
import type { Vec3 } from "@/lib/math";
import { box, cyl } from "../geometry";
import { DEPTH as D } from "../depth-anchors";
import { JBOX } from "./electrical";
import { part, P3 } from "./catalogue";
import { CAT } from "./catalogue";
const depthStart = CAT.parts.length;
export const CONTACTORS: Record<string, Vec3> = {};
for (const [name, key, offset, note] of [
  [
    "Main battery contactor",
    "master",
    [-0.02, -0.025, 0.03],
    "MASTER BAT connects the main battery to the power distribution node; magneto ignition remains self-powered when aircraft buses are lost.",
  ],
  [
    "Starter contactor",
    "starter",
    [0.02, -0.025, -0.025],
    "START energizes the relay coil through WARN; large starter current uses the contactor power terminals and bypasses the M BATT current shunt.",
  ],
  [
    "Alternator output relay",
    "alt",
    [-0.02, 0.025, -0.025],
    "Alternator output reaches the main distribution system through the module relay; field regulation/protection is handled separately by ACU.",
  ],
  [
    "External power relay",
    "external",
    [0.02, 0.025, 0.025],
    "External supply reaches the main node through a relay. Observe the POH MASTER/AVIONICS connection sequence; it is not a second alternator.",
  ],
] as [string, string, Vec3, string][]) {
  const at: Vec3 = [JBOX[0] + offset[0], JBOX[1] + offset[1], JBOX[2] + offset[2]];
  CONTACTORS[key] = at;
  part(() => box(0.027, 0.025, 0.025), ["electrical"], {
    pos: at,
    name,
    note: note + " POH Figure7-7; contacts/coil geometry and positions within J-box schematic.",
    color: "#B59D6B",
    pin: true,
  });
}
for (const [i, label] of ["A", "B", "C"].entries())
  part(() => cyl(0.008, 0.012, "x", 12), ["electrical"], {
    pos: [JBOX[0] - 0.044, JBOX[1] + 0.055, JBOX[2] - 0.034 + i * 0.034],
    name: "J-box feeder breaker " + label,
    color: "#DCC37B",
    pin: true,
    note: "Push-to-reset bus feeder breaker in the power distribution module (POH 7-57,Fig 7-7). Distinct from individual equipment breakers on the cockpit board. Ratings remain governed by the applicable wiring diagram; dimensions approximate.",
  });
for (const [name, at, note] of [
  [
    "Standby battery current sensor",
    D.stbyShunt,
    "Measures S BATT charging/discharging independently from M BATT; a sustained discharge produces STBY BATT (POH 7-54).",
  ],
  [
    "Standby battery inline fuse",
    P3(11.2, -12, 51),
    "25 A fuse protects the standby-battery connection shown in Fig 7-7. Aircraft-specific capacity/endurance are not inferred from the fuse rating.",
  ],
  [
    "Essential bus isolation diodes",
    P3(15, -10, 47),
    "Diodes isolate essential/crossfeed supply paths so standby power supports essential equipment without driving every primary-bus load (POH Fig 7-7).",
  ],
] as [string, Vec3, string][])
  part(() => box(0.035, 0.025, 0.035), ["electrical"], {
    pos: at,
    name,
    note: note + " Physical packing and sizes schematic.",
    color: "#BC9F50",
    pin: true,
  });

export const DEPTH_ELECTRICAL_PARTS = CAT.parts.slice(depthStart);
