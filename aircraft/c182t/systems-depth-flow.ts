/** C182T source-backed independent power, avionics data, sensing and cabin-control paths.
 * POH182TPHAUS-04 Fig7-7/7-8/7-9; Garmin190-00352-00 RevK1-2–1-7; Cessna182SMM14 ATA21/24/28/32/34/37.
 * Routing is schematic: coordinates are not an installation or wire-gauge specification.
 */
import type { FlowSpec } from "@/lib/catalogue";
import type { Vec3 } from "@/lib/math";
import type { Elec, Sim } from "./model";
import { DEPTH as D } from "./depth-anchors";
import { AF, X, Y, Z, botY, fLE, fus } from "./geometry";
import { wp, cAt } from "./parts/catalogue";
const { P3 } = AF;
const F: FlowSpec[] = [];
const add = (
  key: string,
  pts: FlowSpec["pts"],
  name: string,
  note: string,
  sys: FlowSpec["sys"] = ["avionics"],
  extra: Partial<FlowSpec> = {},
) =>
  F.push({
    key,
    pts,
    sys,
    name,
    note: note + " Routing schematic.",
    r: 0.0035,
    tension: 0,
    color: "#4B7484",
    pcolor: "#87D9E8",
    size: 0.022,
    count: 7,
    ...extra,
  });
const lane = (fs: number, side = 1): Vec3 => {
  const x = X(fs),
    s = fus(x);
  return [x, s.cy - s.hh * 0.65, side * Math.min(s.hw * 0.45, 0.25)];
};
/** All long avionics/data runs follow the underfloor volume; forward links remain behind the panel. */
const wire = (
  key: string,
  a: Vec3,
  b: Vec3,
  name: string,
  note: string,
  sys: FlowSpec["sys"] = ["avionics"],
  power = false,
) => {
  const side = a[2] + b[2] < 0 ? -1 : 1;
  const afs = 100 - a[0] / 0.0254,
    bfs = 100 - b[0] / 0.0254;
  const pts: Vec3[] = [a, [a[0], fus(a[0]).cy, a[2]], lane(afs, side)];
  const stations = [0, 10, 20, 40, 60, 80, 100, 120, 140, 160].filter(
    (fs) => fs > Math.min(afs, bfs) && fs < Math.max(afs, bfs),
  );
  if (afs > bfs) stations.reverse();
  pts.push(...stations.map((fs) => lane(fs, side)), lane(bfs, side), [b[0], fus(b[0]).cy, b[2]], b);
  add(key, pts, name, note, sys, power ? { color: "#AD8739", pcolor: "#FFD167" } : {});
};
/* Dual protected inputs supply early NAVIII LRUs, unlike the single-feed MFD/transponder/audio. */
for (const [key, end, label, bus] of [
  ["depthPfdEss", D.pfd, "PFD", "ESS"],
  ["depthPfdAv1", D.pfd, "PFD", "AV1"],
  ["depthAhrsEss", D.ahrs, "ADC AHRS", "ESS"],
  ["depthAhrsAv1", D.ahrs, "ADC AHRS", "AV1"],
  ["depthAdcEss", D.adc, "ADC AHRS", "ESS"],
  ["depthAdcAv1", D.adc, "ADC AHRS", "AV1"],
  ["depthGia1Ess", D.gia1, "NAV 1 ENG", "ESS"],
  ["depthGia1Av1", D.gia1, "NAV 1 ENG", "AV1"],
  ["depthGeaEss", D.gea, "NAV 1 ENG", "ESS"],
  ["depthGeaAv1", D.gea, "NAV 1 ENG", "AV1"],
  ["depthMfdFeed", D.mfd, "MFD", "AV2"],
  ["depthGia2Feed", D.gia2, "NAV 2", "AV2"],
  ["depthAudioFeed", D.audio, "AUDIO", "AV2"],
  ["depthXpdrFeed", D.xpdr, "XPNDR", "AV2"],
] as const)
  wire(
    key,
    D.cb,
    end,
    `${bus}:${label} feed`,
    "Independent input per POH Fig. 7-7 Sheet 2; pulling one input does not remove the other",
    ["electrical", "avionics"],
    true,
  );
wire(
  "depthAltField",
  D.jbox,
  P3(-33.4, 9, 41.5),
  "Alternator field control",
  "MASTER ALT/ALT FIELD feed ACU and field; separate from high-current alternator output (POH 7-48)",
  ["electrical"],
  true,
);
wire(
  "depthWarnSense",
  D.cb,
  D.controller,
  "WARN → standby controller sensing",
  "WARN breaker carries main-voltage sensing and standby control, not the high-current 25 A battery output (POH 7-50)",
  ["electrical"],
  true,
);
wire(
  "depthShuntGea",
  D.jbox,
  D.gea,
  "M BATT shunt → GEA",
  "Main battery net charge/discharge measurement (POH 7-48/7-53)",
  ["electrical", "avionics"],
);
wire(
  "depthStbyShuntGea",
  D.controller,
  D.gea,
  "S BATT shunt → GEA",
  "Standby controller current/voltage indication (POH 7-50)",
  ["electrical", "avionics"],
);

/* True early G1000 links: GRS 77AHRS + separate GDC 74A, not dual Cirrus ADAHRS. */
wire(
  "depthGia1Pfd",
  D.gia1,
  D.pfd,
  "GIA 1 ↔ PFD HSDB",
  "Ethernet high-speed display link (Garmin 190-00352-00 Rev K p. 1-2)",
);
wire("depthGia2Mfd", D.gia2, D.mfd, "GIA 2 ↔ MFD HSDB", "Ethernet high-speed display link (Garmin 1-2)");
add(
  "depthDisplayBus",
  [D.pfd, P3(14, -8.7, 62), P3(14, 8.3, 62), D.mfd],
  "PFD ↔ MFD HSDB",
  "Ethernet display-to-display link (Garmin 1-2)",
);
for (const [n, g] of [
  [1, D.gia1],
  [2, D.gia2],
] as const) {
  wire(`depthGeaGia${n}`, D.gea, g, `GEA → GIA${n}`, "RS-485 engine/airframe data to BOTH GIAs (Garmin 1-3)");
  wire(
    `depthAhrsGia${n}`,
    D.ahrs,
    g,
    `GRS 77 ↔ GIA${n}`,
    "ARINC 429 attitude/heading plus GPS aiding (Garmin 1-3/1-6)",
  );
  wire(`depthAdcGia${n}`, D.adc, g, `GDC 74A → GIA${n}`, "ARINC 429 pressure altitude/airspeed/OAT (Garmin 1-3/1-6)");
  wire(
    `depthAudioGia${n}`,
    D.audio,
    g,
    `GMA 1347 ↔ GIA${n}`,
    "RS-232 controls/configuration; digital COM/NAV audio (Garmin 1-2/1-7)",
  );
  wire(
    `depthXpdrGia${n}`,
    D.xpdr,
    g,
    `GTX 33 ↔ GIA${n}`,
    "RS-232 transponder control/data to both GIAs (Garmin 1-4/1-7)",
  );
}
wire("depthAhrsPfd", D.ahrs, D.pfd, "AHRS → PFD", "Primary ARINC 429 attitude/heading path (Garmin 1-6)");
wire("depthAhrsMfd", D.ahrs, D.mfd, "AHRS → MFD", "Secondary ARINC 429 attitude/heading path (Garmin 1-6)");
wire("depthAdcPfd", D.adc, D.pfd, "ADC → PFD", "Independent air data path (Garmin 1-6)");
wire(
  "depthAdcAhrs",
  D.adc,
  D.ahrs,
  "ADC → AHRS aiding",
  "GRS 77 uses airspeed from GDC 74A in addition to magnetic/GPS/inertial data (Garmin 1-6)",
);
const mag = wp(-170, cAt(44, 170));
add(
  "depthMagAhrs",
  [
    mag,
    ...[-150, -120, -90, -60, -30, -19].map((bl) => wp(bl, 0.45)),
    P3(45, -13, 70),
    lane(45, -1),
    lane(100, -1),
    lane(140, -1),
    D.ahrs,
  ],
  "GMU 44 → GRS 77",
  "Left-wing magnetometer RS-485 data/power from AHRS (POH 7-67; Garmin 1-3)",
);
const oat = P3(41.5, -4, 80.5);
add(
  "depthOatAdc",
  [oat, P3(41.5, -4, 77), P3(28, -12, 73), P3(14, 8.3, 60), D.adc],
  "OAT → GDC 74A",
  "GTP 59 outside-air sensor independent of pitot/static pressure input (POH 7-67)",
  ["pitot", "avionics"],
);
wire(
  "depthGdlMfd",
  D.gdl,
  D.mfd,
  "GDL 69A ↔ MFD",
  "XM weather/audio channel control via HSDB Ethernet; optional FIS breaker (Garmin 1-4; POH 7-68)",
);
wire(
  "depthGdlAudio",
  D.gdl,
  D.audio,
  "GDL 69A → entertainment audio",
  "XM audio to GMA 1347 is separate from its Ethernet weather/control link (Garmin 190-00352-00 Rev K p. 1-4)",
);
wire(
  "depthXmCoax",
  wp(-7, cAt(61.2, -7), 1, -0.015),
  D.gdl,
  "XM antenna → GDL 69A",
  "Left roof antenna's satellite channel feeds the optional data-link receiver (POH 7-69)",
);
wire(
  "depthXpdrCoax",
  D.xpdr,
  [X(86.5), botY(X(86.5)) + 0.02, Z(2)],
  "GTX 33 → transponder antenna",
  "RF coax reaches the inside of the belly antenna mounting aperture; not a data bus (POH 7-70)",
);
wire(
  "depthMarkerCoax",
  [X(131.5), botY(X(131.5)) + 0.02, 0],
  D.audio,
  "Marker antenna → GMA 1347",
  "Belly marker receiver antenna feeds audio panel's marker-beacon receiver (POH 7-66/7-70)",
);
for (const [n, gia] of [
  [1, D.gia1],
  [2, D.gia2],
] as const)
  wire(
    `depthNavCoax${n}`,
    [fLE(Y(88)) - 0.12, Y(88), 0],
    gia,
    `VOR/GS antenna → NAV${n}`,
    "Fin-mounted navigation antenna RF feeds the GIA's VHF NAV receiver; endpoint is inside the antenna mounting region (POH 7-69; Garmin p. 1-7)",
  );
wire("depthSpeaker", D.audio, P3(55, 0, 77), "GMA → cabin speaker", "Audio panel output (POH 7-66)");
for (const [i, fs, bl] of [
  [1, 37, -16],
  [2, 37, 16],
  [3, 79, -16],
  [4, 79, 16],
] as const)
  wire(
    `depthHeadset${i}`,
    D.audio,
    P3(fs, bl, 45),
    "Headset/microphone audio",
    "Crew/passenger intercom and COM audio from GMA 1347 (POH 7-66)",
  );
/* Combined roof antennas carry separate GPS and VHF coax channels (POH7-69). */
for (const [n, gia, bl] of [
  [1, D.gia1, 7],
  [2, D.gia2, -7],
] as const) {
  const antenna = wp(bl, cAt(61.2, bl), 1, -0.015);
  wire(
    `depthComCoax${n}`,
    gia,
    antenna,
    `COM${n} antenna coax`,
    "VHF radio channel in combined roof antenna; passive antenna requires its receiver/transmitter, not an extra breaker (POH 7-69)",
  );
  wire(
    `depthGpsCoax${n}`,
    antenna,
    gia,
    `GPS${n} antenna coax`,
    "GPS antenna channel to respective GIA receiver (POH 7-69)",
  );
}
/* Four fans have three protected feeds. Displays may survive on ESS while ALL cooling fans stop. */
for (const [key, a, b] of [
  ["depthPfdCool", D.pfdFan, D.pfd],
  ["depthMfdCool", D.mfdFan, D.mfd],
  ["depthDeckCool", D.deckFan, P3(18, -1, 64)],
  ["depthAftCool1", D.aftFan, D.gia1],
  ["depthAftCool2", D.aftFan, D.gia2],
  ["depthAftCoolXpdr", D.aftFan, D.xpdr],
] as const)
  add(
    key,
    [a, [(a[0] + b[0]) / 2, Math.min(a[1], b[1]), (a[2] + b[2]) / 2], b],
    "Avionics cooling branch",
    "Airflow direction and four fan topology from MM 21-21-00 pp. 201–205; breaker feeds POH 7-49/7-69",
    ["avionics"],
    { r: 0.009, color: "#587C84", pcolor: "#A1E3E9" },
  );
/* Gauge and annunciator signals remain independent from tank supply tubing. */
for (const side of [-1, 1]) {
  const sender = wp(side * 62, cAt(56.3, 62));
  add(
    `depthFuelQty${side < 0 ? "L" : "R"}`,
    [
      sender,
      ...[55, 45, 35, 24, 19].map((bl) => wp(side * bl, 0.5)),
      P3(45, side * 12, 68),
      lane(45, side),
      lane(15, side),
      D.gea,
    ],
    "Fuel float → GEA",
    "Electrical signal remains in the wing/cabin harness, separate from supply manifold (POH 7-40)",
    ["fuel", "avionics"],
  );
}
wire(
  "depthVacSense",
  D.vacTransducer,
  D.gea,
  "Vacuum transducer → GEA",
  "LOW VACUUM is electronic indication of a mechanically independent standby gyro circuit (POH 7-63)",
  ["vacuum", "avionics"],
);
wire(
  "depthCoGea",
  D.co,
  D.gea,
  "CO detector → annunciation",
  "Optional CO detector triggers CO LVL HIGH at 50 PPM (POH 7-75)",
  ["environment", "avionics"],
);
wire(
  "depthEltRemote",
  D.eltRemote,
  D.elt,
  "ELT remote control",
  "Pointer 3000-11 has its own battery; remote control does not make it an avionics-bus load (Supplement 1)",
  ["cabin"],
);
/* Mechanical standby instruments retain pneumatic input with all electrical buses off. */
for (const [key, source, end, pressure, note] of [
  ["depthPitotAsi", D.pitotTee, D.standbyAsi, "Pitot", "Total pressure to mechanical standby airspeed capsule"],
  ["depthStaticAsi", D.staticTee, D.standbyAsi, "Static", "Static pressure to standby airspeed case"],
  ["depthStaticAlt", D.staticTee, D.standbyAlt, "Static", "Static pressure to standby altimeter aneroid"],
  ["depthStaticKap", D.staticTee, D.kap, "Static", "Direct static-pressure branch to KAP 140"],
] as const)
  add(
    key,
    [source, P3(14.8, end[2] / 0.0254, 53), end],
    `${pressure} → standby instrument`,
    `${note}; independent of ADC and aircraft electrical power (POH 7-62; MM 34-11-00 Fig. 201 Sheet 2)`,
    ["pitot"],
    { r: 0.005, color: pressure === "Pitot" ? "#3A9448" : "#2E7A3A" },
  );

/* Separate gyro inlet and regulator bypass air. */
add(
  "depthVacRegAir",
  [P3(4, 8, 58), D.regulator],
  "Vacuum regulator bypass air",
  "Regulator-filter inlet holds suction, separate from gyro-filter inlet (MM 37-10-00 p. 207)",
  ["vacuum"],
  { r: 0.006, color: "#58A99E" },
);
add(
  "depthVacTransducer",
  [D.regulator, D.vacTransducer],
  "Vacuum sensing branch",
  "Pressure tee/transducer to GEA; no airflow implied through sensor (MM 37-10-00 p. 201)",
  ["vacuum"],
  { r: 0.005, color: "#58A99E" },
);
add(
  "depthParkCable",
  [D.park, P3(14, -10, 35), D.masterL, P3(10, -6, 35), D.masterR],
  "Parking brake mechanical cable",
  "Ratchet cable holds both integral-reservoir master pistons; no common hydraulic parking shutoff valve (MM 32-42-00 p. 201)",
  ["gear"],
  { r: 0.003, color: "#78888F" },
);
for (const [name, start, end] of [
  ["depthHeatControl", P3(18.4, 15, 46), D.heater],
  ["depthAirControl", P3(18.4, 12.6, 46), D.airDoor],
  ["depthDefrostControl", P3(18.4, 17.4, 46), D.defrostValve],
] as const)
  add(
    name,
    [start, P3(12, 12, 45), end],
    "Cabin air control cable",
    "Mechanical cable from push/pull or rotary cabin control; works without electrical buses (POH 7-60; MM 21-40-00 p. 201)",
    ["environment"],
    { r: 0.003, color: "#536B70" },
  );
export const SYSTEM_DEPTH_FLOWS = F;
export function systemsDepthRates(s: Sim, E: Elec, rpm: number): Record<string, number> {
  const r: Record<string, number> = {},
    on = (key: string) => !!E.on[key];
  for (const [key, bus, cb] of [
    ["depthPfdEss", "ESS", "PFD"],
    ["depthPfdAv1", "AV1", "PFD"],
    ["depthAhrsEss", "ESS", "ADC AHRS"],
    ["depthAhrsAv1", "AV1", "ADC AHRS"],
    ["depthAdcEss", "ESS", "ADC AHRS"],
    ["depthAdcAv1", "AV1", "ADC AHRS"],
    ["depthGia1Ess", "ESS", "NAV 1 ENG"],
    ["depthGia1Av1", "AV1", "NAV 1 ENG"],
    ["depthGeaEss", "ESS", "NAV 1 ENG"],
    ["depthGeaAv1", "AV1", "NAV 1 ENG"],
    ["depthMfdFeed", "AV2", "MFD"],
    ["depthGia2Feed", "AV2", "NAV 2"],
    ["depthAudioFeed", "AV2", "AUDIO"],
    ["depthXpdrFeed", "AV2", "XPNDR"],
  ])
    r[key] = Number(on(`${bus}:${cb}`));
  Object.assign(r, {
    depthAltField: Number(s.elec.alt && on("XF:ALT FIELD")),
    depthWarnSense: Number(on("XF:WARN")),
    depthShuntGea: Number(E.gea && E.node > 0),
    depthStbyShuntGea: Number(E.gea && s.elec.stby !== "OFF"),
    depthGia1Pfd: Number(E.gia1 && E.pfd),
    depthGia2Mfd: Number(E.gia2 && E.mfd),
    depthDisplayBus: Number(E.pfd && E.mfd),
    depthAhrsPfd: Number(E.ahrs && E.pfd),
    depthAhrsMfd: Number(E.ahrs && E.mfd),
    depthAdcPfd: Number(E.adc && E.pfd),
    depthAdcAhrs: Number(E.adc && E.ahrs),
    depthMagAhrs: Number(E.ahrs),
    depthOatAdc: Number(E.adc),
    depthGdlMfd: Number(on("AV1:FIS") && E.mfd),
    depthGdlAudio: Number(on("AV1:FIS") && E.audio),
    depthXmCoax: Number(on("AV1:FIS")),
    depthXpdrCoax: Number(E.xpdr),
    depthMarkerCoax: Number(E.audio),
    depthNavCoax1: Number(E.gia1),
    depthNavCoax2: Number(E.gia2),
    depthSpeaker: Number(E.audio),
    depthPfdCool: Number(E.fwdFan),
    depthMfdCool: Number(E.mfdFan),
    depthDeckCool: Number(E.fwdFan),
    depthAftCool1: Number(E.aftFan),
    depthAftCool2: Number(E.aftFan),
    depthAftCoolXpdr: Number(E.aftFan),
    depthFuelQtyL: Number(E.gea),
    depthFuelQtyR: Number(E.gea),
    depthVacSense: Number(E.gea),
    depthCoGea: Number(E.gea),
    depthEltRemote: Number(s.cabin.elt !== "AUTO"),
    depthPitotAsi: Number(!s.ground && !s.pitot.pitotBlocked),
    depthStaticAsi: Number(s.pitot.altStatic || (!s.ground && !s.pitot.staticBlocked)),
    depthStaticAlt: Number(s.pitot.altStatic || (!s.ground && !s.pitot.staticBlocked)),
    depthStaticKap: Number(s.pitot.altStatic || (!s.ground && !s.pitot.staticBlocked)),
    depthVacRegAir: Number(rpm > 150 && !s.vac.fail),
    depthVacTransducer: 0,
    depthParkCable: 0,
    depthHeatControl: 0,
    depthAirControl: 0,
    depthDefrostControl: 0,
  });
  for (const [n, g] of [
    [1, E.gia1],
    [2, E.gia2],
  ] as const) {
    r[`depthGeaGia${n}`] = Number(E.gea && g);
    r[`depthAhrsGia${n}`] = Number(E.ahrs && g);
    r[`depthAdcGia${n}`] = Number(E.adc && g);
    r[`depthAudioGia${n}`] = Number(E.audio && g);
    r[`depthXpdrGia${n}`] = Number(E.xpdr && g);
  }
  r.depthComCoax1 = Number(E.com1);
  r.depthComCoax2 = Number(E.com2);
  r.depthGpsCoax1 = Number(E.gia1);
  r.depthGpsCoax2 = Number(E.gia2);
  for (let i = 1; i <= 4; i++) r[`depthHeadset${i}`] = Number(E.audio);
  return r;
}
