/**
 * State transitions across real tick/store boundaries: DA40 receiver loss (AFMS p. 10), Cessna scenario recovery
 * (POH 7-63 / 7-65 standby gyro), and M20C carb heat / starting (OM pp. 15–16, 22).
 * Engine delays and icing rates are illustrative model parameters, not aircraft performance data.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { gfc700Key } from "@/lib/avionics/gfc700";
import { navDots } from "@/lib/avionics/flight";
import { AFCS_CFG, live as da40Live } from "@/aircraft/da40/model";
import { scenarioCruise as da40Cruise, useDA40 } from "@/aircraft/da40/store";
import { simTick as da40Tick } from "@/aircraft/da40/tick";
import { live as c172Live } from "@/aircraft/c172s/model";
import * as c172 from "@/aircraft/c172s/store";
import { simTick as c172Tick } from "@/aircraft/c172s/tick";
import { live as c182Live } from "@/aircraft/c182t/model";
import * as c182 from "@/aircraft/c182t/store";
import { simTick as c182Tick } from "@/aircraft/c182t/tick";
import { live as m20cLive } from "@/aircraft/m20c/model";
import { primeThrottle, scenarioCruise as m20cCruise, scenarioRamp, useM20C } from "@/aircraft/m20c/store";
import { simTick as m20cTick, START_HOLD } from "@/aircraft/m20c/tick";

function advance(tick: (dt: number) => void, seconds: number) {
  for (let i = 0; i < Math.round(seconds / 0.05); i++) tick(0.05);
}

describe("DA40 receiver and air-data integration", () => {
  beforeEach(() => da40Cruise());

  it("flags the selected failed NAV receiver and drops VOR flight-director guidance (AFMS p. 10)", () => {
    advance(da40Tick, 10);
    da40Live.fs = { ...da40Live.fs, navSrc: "VOR2", xtk: 0 };
    da40Live.afcs = gfc700Key(da40Live.afcs, "NAV", da40Live.fs, AFCS_CFG);
    expect(da40Live.afcs.lat).toBe("VOR");
    useDA40.getState().update((s) => {
      s.cb["GPS/NAV 2"] = true;
    });
    da40Tick(0.05);
    expect(useDA40.getState().E.gia2).toBe(false);
    expect(navDots(da40Live.fs)).toBeNull();
    expect(da40Live.afcs).toMatchObject({ fd: true, lat: "ROL", latFlash: { text: "VOR" } });

    useDA40.getState().update((s) => {
      s.cb["GPS/NAV 2"] = false;
    });
    da40Tick(0.05);
    expect(navDots(da40Live.fs)).not.toBeNull();
    expect(da40Live.afcs.lat).toBe("ROL"); // restoring the receiver does not reselect NAV
  });

  it("retains GPS on either receiver and flags it when both are lost", () => {
    useDA40.getState().update((s) => {
      s.cb["GPS/NAV 1"] = true;
    });
    da40Tick(0.05);
    expect(da40Live.fs.navValid).toBe(true);
    useDA40.getState().update((s) => {
      s.cb["GPS/NAV 2"] = true;
    });
    da40Tick(0.05);
    expect(navDots(da40Live.fs)).toBeNull();
  });

  it("uses the selected OAT in the flight data sent to the displays", () => {
    useDA40.getState().update((s) => {
      s.pitot.oat = -20;
    });
    da40Tick(0.05);
    expect(da40Live.fs.oat).toBe(-20);
  });
});

const cessnas = [
  ["C172S", c172Live, c172Tick, c172.scenarioColdDark, c172.scenarioCruise, c172.scenarioRunUp, c172.useC172, 4],
  ["C182T", c182Live, c182Tick, c182.scenarioColdDark, c182.scenarioCruise, c182.scenarioRunUp, c182.useC182, 7],
] as const;

describe.each(cessnas)("%s scenario sensor recovery", (_, live, tick, coldDark, cruise, runUp, store, lowFuel) => {
  it("restores the standby gyro together with its drift after a minute cold and dark (POH 7-63 / 7-65)", () => {
    coldDark();
    advance(tick, 60);
    expect(live.drift).toBeGreaterThan(40);
    const clock = live.fs.t;
    cruise();
    tick(0.05);
    expect(live.gyro).toBe(1);
    expect(live.vac).toBeGreaterThan(4);
    expect(live.drift).toBe(0);
    expect(live.fs.t).toBeCloseTo(clock + 0.05);
  });

  it("restarts the low-fuel delay when choosing a new scenario (POH 7-39 / 7-40)", () => {
    cruise();
    store.getState().update((s) => {
      s.fuel.qL = lowFuel;
      s.fuel.qR = 20;
    });
    advance(tick, 61);
    expect(store.getState().s.ann.lowFuelL).toBe(true);
    const hours = live.hobbs;
    runUp();
    advance(tick, 1);
    expect(store.getState().s.ann.lowFuelL).toBe(false);
    expect(live.hobbs).toBeGreaterThanOrEqual(hours);
    advance(tick, 60);
    expect(store.getState().s.ann.lowFuelL).toBe(true);
  });
});

describe("M20C combustion transitions", () => {
  it("retains a fully iced carburetor through shutdown until full heat is applied (OM p. 22)", () => {
    m20cCruise();
    useM20C.getState().update((s) => {
      s.eng.fail.carbIce = true;
    });
    advance(m20cTick, 46);
    expect(useM20C.getState().s.eng.running).toBe(false);
    for (let i = 0; i < 200; i++) {
      m20cTick(0.05);
      expect(useM20C.getState().s.eng.running).toBe(false);
    }
    expect(m20cLive.carbIce).toBe(1);
    useM20C.getState().update((s) => {
      s.eng.carbHeat = 1;
    });
    advance(m20cTick, 15);
    expect(m20cLive.carbIce).toBe(0);
    expect(useM20C.getState().s.eng.running).toBe(true);
  });

  it.each([true, false])("a flooded start leaves time to advance the mixture; mixture advanced = %s", (rich) => {
    scenarioRamp();
    useM20C.getState().update((s) => {
      s.elec.master = true;
      s.sw.fuelPump = true;
      s.eng.throttle = 0.1;
    });
    advance(m20cTick, 2);
    for (let i = 0; i < 5; i++) primeThrottle();
    useM20C.getState().update((s) => {
      s.eng.mix = 0;
      s.eng.throttle = 0.5;
      s.eng.key = "START";
    });
    m20cLive.startTimer = START_HOLD;
    advance(m20cTick, 1.5);
    expect(useM20C.getState().s.eng.running).toBe(true);
    expect(m20cLive.prime).toBe(0);
    if (rich)
      useM20C.getState().update((s) => {
        s.eng.mix = 1;
      });
    advance(m20cTick, 5);
    expect(useM20C.getState().s.eng.running).toBe(rich);
    expect(useM20C.getState().s.eng.key).toBe("BOTH");
  });
});
