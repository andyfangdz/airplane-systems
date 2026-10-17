// Frozen row keys identify authored members; preserve these tokens when inserting, moving or reshaping a row.
/** NAV III installed racks, pressure branches, sensors, cooling. POH 7-64–74;
 * Garmin 190-00352-00Rev K 1-1–1-7; Cessna 172RPC24 21-21,23-50,34-10/20,37-10. */
import type { Vec3 } from "@/lib/math";
import { box, cyl } from "../geometry";
import { DEPTH as D } from "../depth-anchors";
import { part, P3 } from "./catalogue";
import { CAT } from "./catalogue";
const depthStart = CAT.parts.length;
for (const [rowKey1, name, at, size, note] of [
  [
    "row-001",
    "GIA 1 mounting rack",
    D.gia1,
    [0.26, 0.012, 0.15],
    "Removable rack and backplate support the first integrated avionics unit; signal/power connectors remain separate from the LRU.",
  ],
  [
    "row-002",
    "GIA 2 mounting rack",
    D.gia2,
    [0.26, 0.012, 0.15],
    "Second IAU has its own rack, power feeds and corresponding display HSDB connection; the two GIAs are not directly Ethernet-paired.",
  ],
  [
    "row-003",
    "GTX 33 mounting tray",
    D.xpdr,
    [0.16, 0.012, 0.14],
    "Transponder tray/connector in the aft avionics installation; a transponder outage does not remove AHRS attitude.",
  ],
] as [string, string, Vec3, Vec3, string][])
  part(() => box(...size), ["avionics"], {
    instance: [rowKey1],

    id: "parts.depth-avionics.part.001",

    pos: [at[0], at[1] - 0.042, at[2]],
    color: "#78909B",
    name,
    note: note + " POH 7-69–70; 172RPC24 NAV III installation figures. Dimensions and rack stations approximate.",
    pin: true,
  });
for (const [rowKey2, name, at, note] of [
  [
    "row-001",
    "Pitot pressure distribution tee",
    D.pressureTee,
    "Pressure plumbing branches independently to the standby airspeed indicator and the GDC 74A. It supplies pressure, not avionics electrical power (POH 7-64).",
  ],
  [
    "row-002",
    "Static pressure distribution tee",
    D.staticTee,
    "Static plumbing feeds standby airspeed, standby altimeter and GDC 74A. Alternate-static selection substitutes cabin pressure for all connected instruments (POH 7-64).",
  ],
] as [string, string, Vec3, string][])
  part(() => cyl(0.008, 0.025, "z", 12), ["pitot"], {
    instance: [rowKey2],

    id: "parts.depth-avionics.part.002",

    pos: at,
    name,
    note: note + " Tee location/radius schematic.",
    color: "#51955E",
    pin: true,
  });
part(() => cyl(0.012, 0.025, "x", 12), ["vacuum"], {
  id: "parts.depth-avionics.vacuum-regulator-filter.003",
  pos: P3(2, 8, 57.5),
  name: "Vacuum regulator filter",
  color: "#ABBCB1",
  pin: true,
  note: "Separate regulator filter element listed for the NAV III gyro/vacuum installation (172RPC24 37-10-00 Fig 07item10A); the main gyro inlet filter is a different component. Restriction may reduce available suction; exact maintenance diagnosis is not simulated. Size/offset schematic.",
});
part(() => box(0.04, 0.04, 0.045), ["vacuum"], {
  id: "parts.depth-avionics.vacuum-pump-cooling-shroud.004",
  pos: P3(-5, -5.5, 46.5),
  fairing: true,
  name: "Vacuum pump cooling shroud",
  color: "#8AADA7",
  pin: true,
  note: "Cooling shroud encloses the engine-driven dry vacuum pump (POH 7-65; 172RPC24 37-10-00 Fig 07). Cooling and suction are distinct air circuits; vacuum failure does not disable GRS 77 attitude. Schematic housing.",
});
for (const [rowKey3, name, at, note] of [
  [
    "row-001",
    "GIA 1 rear connectors",
    P3(118.5, -4, 50),
    "Power, Ethernet, pressure/attitude data and NAV/COM/GPS connections at IAU1; two aircraft supply feeds preserve essential functions.",
  ],
  [
    "row-002",
    "GIA 2 rear connectors",
    P3(118.5, 4, 50),
    "IAU2 data interfaces are distinct from its AVIONICS BUS2 power feed; losing that bus removes COM2/NAV2 and GFC 700 servo power.",
  ],
  [
    "row-003",
    "GEA 71 sensor connectors",
    P3(10.3, 8, 57),
    "Analog/discrete engine/airframe inputs are converted for RS-485 delivery to both GIAs; a failed GEA can blank engine information while the engine continues running.",
  ],
  [
    "row-004",
    "GRS 77 connectors",
    P3(134, 1, 45.5),
    "AHRS supplies attitude through ARINC 429 and receives independent magnetic-field information from GMU 44; its digital processing uses electrical power.",
  ],
  [
    "row-005",
    "GDC 74A pressure fittings",
    P3(118.7, -4, 53.2),
    "Pitot and static ports connect to the air-data computer independently of the standby instruments and electrical connector.",
  ],
] as [string, string, Vec3, string][])
  part(() => box(0.025, 0.025, 0.035), ["avionics"], {
    instance: [rowKey3],

    id: "parts.depth-avionics.part.005",

    pos: at,
    color: "#798EA1",
    name,
    pin: true,
    note: note + " Garmin 190-00352-00Rev K 1-1–1-7; POH 7-69–70. Connector block shape and offset schematic.",
  });
part(() => box(0.045, 0.012, 0.07), ["avionics", "cabin"], {
  id: "parts.depth-avionics.cabin-audio-speaker.006",
  pos: P3(55, 0, 76),
  name: "Cabin audio speaker",
  color: "#596673",
  pin: true,
  note: "Overhead-console speaker receives selected audio from GMA 1347 (172RPC24 23-30-00; POH 7-69). Headset audio and speaker selection are separate; dimensions/station approximate.",
});
for (const side of [-1, 1])
  for (const [rowKey4, fs] of [
    ["row-001", 40],
    ["row-002", 76],
  ] as const)
    part(() => box(0.012, 0.022, 0.035), ["avionics", "cabin"], {
      id: "parts.depth-avionics.part.007",
      instance: [side, rowKey4],
      pos: P3(fs === 40 ? 27 : fs, side * 16, 50),
      name: fs < 50 ? "Front headset jacks" : "Rear headset jacks",
      color: "#444D53",
      pin: side < 0,
      note: "Headset microphone/audio connections to the GMA 1347 intercom (POH 7-69; 172RPC24 23-50-00). Separate signal wiring, not aircraft bus terminals. Jack sizes/stations approximate.",
    });

for (const [rowKey5, name, at] of [
  ["row-001", "PFD heat-sink cooling fan", D.pfd],
  ["row-002", "MFD heat-sink cooling fan", D.mfd],
] as const)
  part(() => box(0.035, 0.04, 0.035), ["avionics", "electrical"], {
    instance: [rowKey5],

    id: "parts.depth-avionics.part.008",

    pos: [at[0] + 0.04, at[1], at[2]],
    name,
    pin: true,
    color: "#5A6168",
    note: "Two separate fans blow directly on the displays' forward heat sinks; these are distinct from the forward windshield ventilation fan and aft avionics fan (POH 7-73; 172RPC24 21-21). Approximate fan housing and position.",
  });
export const DEPTH_AVIONICS_PARTS = CAT.parts.slice(depthStart);
