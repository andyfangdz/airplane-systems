/** Qualitative failure interactions grounded in1968POH1187, MAN106§§4/6/9 andBrittain11968. */
import { beforeEach, describe, expect, it } from "vitest";
import {
  fuelAvail,
  initialLive,
  initialSim,
  live,
  pcAvailable,
  solve,
  cabinHeatContaminated,
} from "@/aircraft/m20c/model";
import { useM20C, scenarioRamp, pumpFlaps } from "@/aircraft/m20c/store";
import { simTick } from "@/aircraft/m20c/tick";
import { flowRates } from "@/aircraft/m20c/flows";
beforeEach(() => {
  Object.assign(live, initialLive());
  const s = structuredClone(initialSim);
  useM20C.setState({ s, E: solve(s) });
});
const update = useM20C.getState().update;
describe("M20C detailed failure interactions", () => {
  it("pumps/holds manual flaps with a dead bus, while an internal valve leak loses held pressure", () => {
    update((d) => {
      d.elec.master = false;
      d.flaps.valve = "DOWN";
    });
    pumpFlaps();
    pumpFlaps();
    const down = live.flapAng;
    expect(down).toBeGreaterThan(14);
    simTick(0.5);
    expect(live.flapAng).toBe(down);
    update((d) => {
      d.faults.flapLeak = true;
    });
    simTick(0.5);
    expect(live.flapAng).toBeLessThan(down);
  });
  it("keeps feed-line supply visible during powered cranking before combustion, without requiring boost", () => {
    scenarioRamp();
    update((d) => {
      d.elec.master = true;
      d.eng.key = "START";
      d.sw.fuelPump = false;
    });
    live.startTimer = 6;
    live.rpm = 250;
    simTick(0.1);
    const { s, E } = useM20C.getState();
    expect(s.eng.running).toBe(false);
    expect(live.fuelP).toBeGreaterThan(0);
    const rates = flowRates(s, E);
    expect(rates.fuelL).toBeGreaterThan(0);
    expect(rates.fuelSel).toBeGreaterThan(0);
    expect(rates.dCarbFloat).toBeGreaterThan(0);
  });
  it("routes powered START sparks only through the left retard ignition leads", () => {
    scenarioRamp();
    update((d) => {
      d.elec.master = true;
      d.eng.key = "START";
    });
    live.rpm = 250;
    let { s, E } = useM20C.getState();
    let rates = flowRates(s, E);
    for (const key of ["dIgn1U", "dIgn2L", "dIgn3U", "dIgn4L"]) expect(rates[key]).toBeGreaterThan(0);
    for (const key of ["dIgn1L", "dIgn2U", "dIgn3L", "dIgn4U"]) expect(rates[key]).toBe(0);
    update((d) => {
      d.cb["IGN / VIBRATOR"] = true;
    });
    ({ s, E } = useM20C.getState());
    rates = flowRates(s, E);
    expect(rates.dIgn1U).toBe(0);
    expect(rates.dRetard).toBe(0);
  });
  it.each([
    {
      name: "powered START with the healthy left retard circuit",
      key: "START",
      master: true,
      leftFailed: false,
      rightFailed: true,
      pulledStart: false,
      restart: true,
    },
    {
      name: "START with a dead bus",
      key: "START",
      master: false,
      leftFailed: false,
      rightFailed: false,
      pulledStart: false,
      restart: false,
    },
    {
      name: "START with IGN / VIBRATOR pulled",
      key: "START",
      master: true,
      leftFailed: false,
      rightFailed: false,
      pulledStart: true,
      restart: false,
    },
    {
      name: "powered START with only the grounded right magneto healthy",
      key: "START",
      master: true,
      leftFailed: true,
      rightFailed: false,
      pulledStart: false,
      restart: false,
    },
    {
      name: "BOTH with a dead bus and only the left magneto healthy",
      key: "BOTH",
      master: false,
      leftFailed: false,
      rightFailed: true,
      pulledStart: true,
      restart: true,
    },
    {
      name: "BOTH with a dead bus and only the right magneto healthy",
      key: "BOTH",
      master: false,
      leftFailed: true,
      rightFailed: false,
      pulledStart: true,
      restart: true,
    },
    {
      name: "BOTH with both magnetos failed",
      key: "BOTH",
      master: false,
      leftFailed: true,
      rightFailed: true,
      pulledStart: true,
      restart: false,
    },
  ] as const)(
    "restarts a windmilling engine only through $name (1968 OM scan p. 15)",
    ({ key, master, leftFailed, rightFailed, pulledStart, restart }) => {
      update((d) => {
        d.air = true;
        d.eng.running = false;
        d.eng.key = key;
        d.eng.mix = 1;
        d.elec.master = master;
        d.faults.magL = leftFailed;
        d.faults.magR = rightFailed;
        d.cb["IGN / VIBRATOR"] = pulledStart;
      });
      live.rpm = 1500;
      live.fuelP = 3;
      live.prime = 2;
      live.crankT = 1.3;
      live.startTimer = 6;
      expect(useM20C.getState().E.vibrator).toBe(key === "START" && master && !pulledStart);
      simTick(0.1);
      expect(live.rpm).toBeGreaterThan(500);
      expect(useM20C.getState().s.eng.running).toBe(restart);
    },
  );
  it("boost primes an unstarted carburetor but a failed boost or blocked common selector screen cannot supply it", () => {
    scenarioRamp();
    update((d) => {
      d.elec.master = true;
      d.sw.fuelPump = true;
    });
    simTick(0.25);
    let { s, E } = useM20C.getState();
    expect(E.fuelPump).toBe(true);
    expect(flowRates(s, E).fuelSel).toBeGreaterThan(0);
    update((d) => {
      d.faults.boostPump = true;
    });
    ({ s, E } = useM20C.getState());
    expect(E.fuelPump).toBe(false);
    expect(flowRates(s, E).fuelSel).toBe(0);
    update((d) => {
      d.faults.boostPump = false;
      d.faults.fuelScreen = true;
    });
    ({ s, E } = useM20C.getState());
    expect(fuelAvail(s)).toBe(false);
    expect(flowRates(s, E).dCarbFloat).toBe(0);
  });
  it("stops supply when the mechanical pump fails and restores it with boost, using only the selected tank", () => {
    scenarioRamp();
    update((d) => {
      d.elec.master = true;
      d.eng.key = "START";
      d.eng.fail.mechPump = true;
      d.fuel.sel = "L";
      d.fuel.qR = 0;
    });
    live.rpm = 250;
    live.startTimer = 6;
    simTick(0.1);
    let { s, E } = useM20C.getState();
    let rates = flowRates(s, E);
    expect(live.fuelP).toBe(0);
    expect(rates.fuelCarb).toBe(0);
    expect(rates.dCarbFloat).toBe(0);
    update((d) => {
      d.sw.fuelPump = true;
    });
    simTick(0.1);
    ({ s, E } = useM20C.getState());
    rates = flowRates(s, E);
    expect(live.fuelP).toBeGreaterThan(0);
    expect(rates.fuelCarb).toBeGreaterThan(0);
    expect(rates.dTankScreenL).toBeGreaterThan(0);
    expect(rates.dTankScreenR).toBe(0);
    update((d) => {
      d.fuel.sel = "R";
    });
    ({ s, E } = useM20C.getState());
    rates = flowRates(s, E);
    expect(rates.fuelSel).toBe(0);
    expect(rates.dTankScreenL).toBe(0);
    expect(rates.dTankScreenR).toBe(0);
  });
  it("distinguishes powered pump/screen faults from electrical indication loss while the engine pump works", () => {
    update((d) => {
      d.sw.fuelPump = true;
      d.faults.boostPump = true;
    });
    for (let i = 0; i < 20; i++) simTick(0.2);
    let { s, E } = useM20C.getState();
    expect(E.bus).toBeGreaterThan(12);
    expect(E.fuelPump).toBe(false);
    expect(s.eng.running).toBe(true);
    expect(live.fuelP).toBeGreaterThan(0.5);
    expect(s.fuel.qL).toBeGreaterThan(0);
    update((d) => {
      d.faults.fuelScreen = true;
    });
    expect(useM20C.getState().E.bus).toBeGreaterThan(12);
    expect(fuelAvail(useM20C.getState().s)).toBe(false);
    for (let i = 0; i < 25; i++) simTick(0.2);
    ({ s, E } = useM20C.getState());
    expect(s.eng.running).toBe(false);
    expect(s.fuel.qL).toBeGreaterThan(0);
    expect(E.bus).toBeGreaterThan(0);
  });
  it("loses electric boost/quantity indication with the master off while retaining mechanical fuel pressure", () => {
    update((d) => {
      d.elec.master = false;
      d.sw.fuelPump = true;
    });
    for (let i = 0; i < 20; i++) simTick(0.2);
    const { s, E } = useM20C.getState();
    expect(E.bus).toBe(0);
    expect(E.gaugesPwr).toBe(false);
    expect(E.fuelPump).toBe(false);
    expect(s.faults.boostPump).toBe(false);
    expect(s.eng.running).toBe(true);
    expect(live.fuelP).toBeGreaterThan(0.5);
  });
  it("one failed magneto preserves BOTH ignition but selecting the failed magneto stops combustion", () => {
    update((d) => {
      d.faults.magL = true;
    });
    simTick(0.1);
    expect(useM20C.getState().s.eng.running).toBe(true);
    update((d) => {
      d.eng.key = "L";
    });
    simTick(0.1);
    expect(useM20C.getState().s.eng.running).toBe(false);
  });
  it("drops PC on servo leakage independently of manual controls and electric bus", () => {
    update((d) => {
      d.elec.master = false;
    });
    expect(pcAvailable(useM20C.getState().s)).toBe(true);
    update((d) => {
      d.faults.pcLeak = true;
      d.ctrl.roll = 0.4;
    });
    simTick(0.1);
    expect(pcAvailable(useM20C.getState().s)).toBe(false);
    expect(live.eff.roll).toBeGreaterThan(0);
  });
  it("opens the alternator study fault's protective relay, leaving battery power and manual gear", () => {
    update((d) => {
      d.faults.overvoltage = true;
    });
    const { s, E } = useM20C.getState();
    expect(E.genOn).toBe(false);
    expect(E.overvoltage).toBe(true);
    expect(E.bus).toBeGreaterThan(0);
    expect(s.gear.lever).toBe("UP");
  });
  it("identifies contaminated heater exposure only when running exhaust and cabin heat are present", () => {
    update((d) => {
      d.faults.exhaustLeak = true;
      d.env.heat = 0.5;
    });
    expect(cabinHeatContaminated(useM20C.getState().s)).toBe(true);
    update((d) => {
      d.env.heat = 0;
    });
    expect(cabinHeatContaminated(useM20C.getState().s)).toBe(false);
  });
});
