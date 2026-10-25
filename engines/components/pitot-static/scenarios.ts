/**
 * The page's "Try" set-ups: each settles the system in steady flight (or on the ramp), then fails what it fails and
 * sets the controls for what happens next. The notes say what to watch and cite where the handbooks or the POH say so;
 * tests/pitot-static-scenarios.test.ts checks that each shows it.
 */
import { defaultInputs, type Inputs } from "./model";
import { GPG, IFH, PHAK, POH } from "./spec";

/** What the airplane has: the scenarios keep it unless they need one in particular. */
export type Installation = Pick<Inputs, "avionics" | "ports">;

export type Group = "Blockages" | "Alternate static" | "Errors" | "Maintenance";

export interface Scenario {
  id: string;
  label: string;
  group: Group;
  /** Steady flight (or the ramp) to settle in. */
  setup: (i: Inputs) => void;
  /** Then: failures, and the profile to fly. */
  then: (i: Inputs) => void;
  note: string;
}

const level = (kcas: number, alt: number) => (i: Inputs) => Object.assign(i.controls, { kcas, alt });

/** Block the static port: on a cross-connected pair, both ports, so the set-up shows the same thing either way. */
const blockStatic = (i: Inputs) => Object.assign(i.failures, { portL: true, portR: i.ports === "paired" });

export const SCENARIOS: Scenario[] = [
  {
    id: "cruise",
    label: "Cruise",
    group: "Blockages",
    setup: level(107, 5500),
    then: () => {},
    note: `Healthy: 107 KCAS reads 110 KIAS, as Figure 5-1 Sheet 1 says (${POH} p. 5-10). The altimeter's ~40 ft high is the static port's position error under this model's reading of the table.`,
  },
  {
    id: "pitot-ice",
    label: "Pitot ices over",
    group: "Blockages",
    setup: (i) => {
      level(107, 5500)(i);
      i.weather.isaDev = -12;
    },
    then: (i) => {
      i.weather.moisture = true;
    },
    note: `In cloud at about −8 °C with PITOT HEAT off, ice closes the ram inlet: the airspeed sags, then falls toward zero; later the drain ices too and the needle freezes. Turn PITOT HEAT on (${POH} p. 3-14) and watch it clear. The altimeter's few hundred feet high is the cold air's error, not the ice's (${PHAK} p. 8-4).`,
  },
  {
    id: "ram",
    label: "Ram inlet blocked",
    group: "Blockages",
    setup: level(107, 5500),
    then: (i) => {
      i.failures.ram = true;
    },
    note: `The drain hole stays open, so the pitot side empties to outside pressure and the airspeed falls to zero: "not usually instantaneous but … very quickly" (${PHAK} p. 8-10). Altimeter and VSI are unaffected.`,
  },
  {
    id: "ram-drain",
    label: "Inlet and drain blocked, climb",
    group: "Blockages",
    setup: level(100, 4500),
    then: (i) => {
      Object.assign(i.failures, { ram: true, drain: true });
      Object.assign(i.controls, { alt: 6500, rate: 500 });
    },
    note: `Pressure trapped in the pitot side: the airspeed no longer follows speed, but rises as the airplane climbs, "like an altimeter" (${IFH} p. 5-3; ${PHAK} p. 8-11). Descend and it falls.`,
  },
  {
    id: "static-climb",
    label: "Static port blocked, climb",
    group: "Blockages",
    setup: level(90, 4000),
    then: (i) => {
      blockStatic(i);
      Object.assign(i.controls, { alt: 6500, rate: 700 });
    },
    note: `The altimeter freezes at 4,000 ft and the VSI sits at zero; the airspeed reads lower and lower as the airplane climbs above the blockage (${PHAK} p. 8-11, Figure 8-11).`,
  },
  {
    id: "static-descent",
    label: "Static port blocked, descend",
    group: "Blockages",
    setup: level(110, 7500),
    then: (i) => {
      blockStatic(i);
      Object.assign(i.controls, { alt: 4500, rate: 700 });
    },
    note: `Below the blockage altitude the airspeed reads higher than the airplane is flying, toward the yellow arc, while the altimeter stays where it was (${PHAK} p. 8-11). Pull ALT STATIC AIR.`,
  },
  {
    id: "pitot-takeoff",
    label: "Pitot blocked before take-off",
    group: "Blockages",
    setup: level(0, 0),
    then: (i) => {
      Object.assign(i.failures, { ram: true, drain: true });
      Object.assign(i.controls, { kcas: 50, alt: 0 });
    },
    note: `Insects in the pitot tube, inlet and drain: on the take-off roll the airspeed stays at zero. "When beginning the takeoff, make sure the airspeed is increasing at an appropriate rate" (${PHAK} p. 8-10): abort. The covers are there to keep insects out (p. 8-2).`,
  },
  {
    id: "tape",
    label: "Taped static port, take-off",
    group: "Blockages",
    setup: level(0, 0),
    then: (i) => {
      blockStatic(i);
      Object.assign(i.controls, { kcas: 75, alt: 3000, rate: 700 });
    },
    note: `Tape left on the port after washing: everything is right on the runway, then the altimeter stays at the field and the airspeed shrinks in the climb, to zero by about 500 ft. Remove all tape and plugs (AMT p. 10-81); check the static opening clear (${POH} p. 4-9).`,
  },
  {
    id: "alt-level",
    label: "Pull ALT STATIC AIR, level",
    group: "Alternate static",
    setup: (i) => {
      level(107, 5500)(i);
      i.cockpit.heatAir = true;
    },
    then: (i) => {
      i.cockpit.altStatic = true;
    },
    note: `Cabin pressure is lower than outside: the altimeter reads slightly higher, the airspeed faster (112 KIAS, Figure 5-1 Sheet 2), and the VSI shows a momentary climb, then settles (${PHAK} p. 8-3).`,
  },
  {
    id: "alt-blocked",
    label: "Static blocked: use alternate",
    group: "Alternate static",
    setup: level(110, 7500),
    then: (i) => {
      blockStatic(i);
      Object.assign(i.controls, { alt: 5500, rate: 500 });
    },
    note: `A descent with the port iced over. Do ${POH} p. 3-15: ALT STATIC AIR on, cabin vents closed, CABIN HT and CABIN AIR on, and read the airspeed against Figure 5-1 Sheet 2.`,
  },
  {
    id: "glass",
    label: "No alternate: break the VSI glass",
    group: "Alternate static",
    setup: (i) => {
      level(90, 4000)(i);
      // the G1000 has no mechanical VSI to break
      i.avionics = "six-pack";
    },
    then: (i) => {
      blockStatic(i);
      Object.assign(i.controls, { alt: 5500, rate: 500 });
      i.failures.vsiGlass = true;
    },
    note: `With no alternate source, breaking the VSI's glass lets cabin air into the static line through the VSI's calibrated leak: altimeter and airspeed work again, seconds late and reading high, and the VSI is "most likely … inoperative" (${PHAK} p. 8-3; ${IFH} p. 11-8). Here it reads backwards.`,
  },
  {
    id: "adc",
    label: "G1000: air data computer fails",
    group: "Errors",
    setup: (i) => {
      level(107, 5500)(i);
      i.avionics = "g1000";
    },
    then: (i) => {
      i.failures.adc = true;
    },
    note: `Red X over the PFD's airspeed, altitude and vertical speed: the display gets no air data (${GPG} p. 565). ${POH} p. 3-21: ADC/AHRS circuit breakers CHECK IN (ESS BUS and AVN BUS 1), then use the standby airspeed indicator, and the standby altimeter set to the current pressure. The standby instruments read the same pitot and static lines, without the computer.`,
  },
  {
    id: "slip",
    label: "Slip with one static port",
    group: "Errors",
    setup: (i) => {
      level(65, 1500)(i);
      i.controls.flaps = "full";
    },
    then: (i) => {
      i.controls.slip = 12;
    },
    note: `A forward slip on final: the left port, windward, reads high pressure, so the airspeed reads low and the altimeter low. Switch Installation to a cross-connected pair and the error cancels (${IFH} p. 5-2; AMT p. 10-13).`,
  },
  {
    id: "water",
    label: "Water in the static line, freezing",
    group: "Errors",
    setup: level(100, 5500),
    then: (i) => {
      i.failures.water = true;
      Object.assign(i.controls, { alt: 9500, rate: 500 });
    },
    note: `Water at the line's low point: the altimeter lags and wanders (AMT p. 10-81). Above the freezing level it freezes and the static system is blocked. The POH's answer is the alternate source (${POH} p. 7-64).`,
  },
  {
    id: "disconnected",
    label: "Static line off behind the panel",
    group: "Errors",
    setup: level(107, 5500),
    then: (i) => {
      i.failures.leak = "disconnected";
    },
    note: "A static line pulled off its fitting behind the panel lets cabin air in: the instruments read as if partly on the alternate source.",
  },
  {
    id: "high-low",
    label: "High to low",
    group: "Errors",
    setup: (i) => {
      level(110, 5500)(i);
      i.weather.qnh = 29.42;
    },
    then: () => {},
    note: `The altimeter still set to 29.92 where the pressure is 29.42: it reads about 500 ft high. "Going from a high to a low, look out below" (${PHAK} p. 8-4). Set the barometric scale to 29.42.`,
  },
  {
    id: "cold",
    label: "Cold day",
    group: "Errors",
    setup: (i) => {
      level(110, 5500)(i);
      i.weather.isaDev = -25;
    },
    then: () => {},
    note: `25 °C colder than standard, correctly set: the airplane is lower than the altimeter says. "From hot to cold, look out below" (${PHAK} pp. 8-4, 8-5).`,
  },
  {
    id: "leak-test",
    label: "Static leak test",
    group: "Maintenance",
    setup: (i) => {
      i.mode = "test";
      i.failures.leak = "cracked";
    },
    then: (i) => {
      i.test.alt = 1000;
    },
    note: "A test set on the ramp takes the static side to 1,000 ft above the field. When it's there, seal it and time a minute: more than 100 ft lost fails (AMT p. 10-81). This one has a cracked fitting; repair it under Failures and test again.",
  },
];

export const scenarioById = (id: string) => SCENARIOS.find((x) => x.id === id);

/** The inputs a scenario settles in, and those it then flies, on the airplane's installation unless it needs another. */
export function scenarioInputs(sc: Scenario, installation?: Installation): { setup: Inputs; then: Inputs } {
  const setup = { ...defaultInputs(), ...installation };
  sc.setup(setup);
  const then = structuredClone(setup);
  sc.then(then);
  return { setup, then };
}
