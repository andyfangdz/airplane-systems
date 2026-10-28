/**
 * The Diego Garcia replay's data against the USAF's flight data animation and Jay Lacklen's account ("The C-5 Galaxy
 * that nearly crashed at Diego Garcia", The Aviation Geek Club, 13 July 2018; his times are the video's).
 */
import { describe, expect, test } from "vitest";
import {
  DURATION,
  GEAR_TRANSIT_S,
  IAS_FLOOR,
  MOMENTS,
  PLACEMENT,
  SLAT_SHORT,
  SLAT_TRANSIT_S,
  T_END,
  T_START,
  TRACK,
  channel,
  gearTravel,
  groundAt,
  groundFrame,
  sample,
  slatTravel,
  trackAt,
} from "@/fdr/c5-diego-garcia/model";
import { ALT_READINGS, HDG_READINGS, IAS_READINGS } from "@/fdr/c5-diego-garcia/readings";
import { TRANSCRIPT, lastLineIndex, lineAt } from "@/fdr/c5-diego-garcia/transcript";
import { C5_DIEGO_GARCIA } from "@/fdr/c5-diego-garcia/spec";

const at = (t: number) => sample(t);
/** The data's times, every sample. */
const times = (from: number, to: number) => {
  const out: number[] = [];
  for (let t = from; t <= to + 1e-9; t += 0.2) out.push(t);
  return out;
};
/** When the altitude first falls below `ft` after the top. */
const passing = (ft: number) => times(104, T_END).find((t) => channel("alt", t) < ft)!;

describe("the flight against Lacklen's account", () => {
  test("the data runs from the end of the title cards to the end of the video", () => {
    expect(T_START).toBe(7);
    expect(T_END).toBeLessThanOrEqual(DURATION);
    expect(at(3).data).toBe(false);
    expect(at(7).data).toBe(true);
  });

  test("the approach starts at about 4,600 ft and 207 kt with the flaps up", () => {
    const f = at(7);
    expect(f.alt).toBeCloseTo(4601, -1);
    expect(f.ias).toBeCloseTo(207, 0);
    expect(f.flaps).toBe(0);
  });

  test("“Flaps 40”: the flaps reach 40% at about 52 s", () => {
    expect(channel("flaps", 45)).toBeLessThan(40);
    expect(channel("flaps", 53)).toBeCloseTo(40, 0);
  });

  test("power instead of descent: N1 from about 28% to 77% by 70 s, level near 4,560 ft", () => {
    expect(at(60).n1.every((n) => n < 35)).toBe(true);
    expect(at(70).n1.reduce((a, b) => a + b) / 4).toBeCloseTo(77, -1);
    expect(Math.abs(channel("alt", 70) - 4560)).toBeLessThan(30);
  });

  test("the nose comes up and the airplane climbs as the airspeed falls below 100 kt", () => {
    expect(at(80).pitch).toBeGreaterThan(8);
    expect(channel("ias", 90)).toBeLessThan(100);
    expect(channel("alt", 96)).toBeGreaterThan(channel("alt", 77) + 250);
  });

  test("Lacklen: the top is 4,900 ft (the data: about 4,914 ft at 104 s)", () => {
    let top = 0,
      when = 0;
    for (const t of times(T_START, T_END)) {
      const a = channel("alt", t);
      if (a > top) [top, when] = [a, t];
    }
    expect(top).toBeGreaterThan(4890);
    expect(top).toBeLessThan(4930);
    expect(when).toBeCloseTo(104, 0);
  });

  test("Lacklen: the airspeed sat at 50 kt for 15 s, the stall beginning at 1:46", () => {
    const floor = times(T_START, T_END).filter((t) => at(t).iasFloor);
    expect(floor[0]).toBeCloseTo(102.2, 1);
    expect(floor.filter((t) => t <= 117.2).length * 0.2).toBeGreaterThanOrEqual(14);
    expect(at(106).ias).toBe(IAS_FLOOR);
  });

  test("Lacklen: “TRT” twice at 1:42 with N1 at 85%; the throttles go forward to near 100%", () => {
    for (const n of at(102).n1) expect(Math.abs(n - 85)).toBeLessThan(3);
    for (const n of at(112).n1) expect(n).toBeGreaterThanOrEqual(95);
    expect(Math.max(...at(114).n1)).toBeGreaterThan(99);
  });

  test("Lacklen at 1:55: in full stall, having lost almost 1,000 ft (the data: about 860 ft)", () => {
    const lost = channel("alt", 104) - channel("alt", 115.3);
    expect(lost).toBeGreaterThan(800);
    expect(lost).toBeLessThan(1000);
  });

  test("the AOA runs off the top of its tape (30) after the top", () => {
    expect(at(104.6).aoa).toBeGreaterThanOrEqual(29.5);
    expect(at(104.6).aoaPegged).toBe(true);
  });

  test("Lacklen at 2:06: 90° left bank, nose low, passing through 3,000 ft", () => {
    const f = at(126);
    expect(f.bank).toBeLessThan(-85);
    expect(f.pitch).toBeLessThan(0);
    expect(Math.abs(f.alt - 3000)).toBeLessThan(100);
    expect(passing(3000)).toBeGreaterThan(126);
    expect(passing(3000)).toBeLessThan(127.5);
  });

  test("the spiral reverses: 94° of right bank at 1,900 ft", () => {
    const f = at(134);
    expect(f.bank).toBeGreaterThan(90);
    expect(f.alt).toBeCloseTo(1898, -1);
  });

  test("Lacklen: visual conditions again passing 1,500 ft", () => {
    expect(at(135.6).inCloud).toBe(true);
    expect(passing(C5_DIEGO_GARCIA.cloudBaseFt)).toBeCloseTo(135.8, 0);
    expect(at(136).inCloud).toBe(false);
  });

  test("Lacklen: the pull-out held the AOA near 18 with only two degrees to spare", () => {
    for (const t of times(140, 145)) expect(at(t).aoa).toBeLessThan(19.5);
    expect(Math.max(...times(140, 145).map((t) => at(t).aoa))).toBeGreaterThan(14);
  });

  test("the lowest point is about 770 ft, at 144.2 s, at 144 kt", () => {
    let low = Infinity,
      when = 0;
    for (const t of times(104, T_END)) {
      const a = channel("alt", t);
      if (a < low) [low, when] = [a, t];
    }
    expect(low).toBeCloseTo(771, -1);
    expect(when).toBeCloseTo(144.2, 1);
    expect(at(144.2).ias).toBeGreaterThan(140);
  });
});

describe("the recorder", () => {
  test("Flying Safety, December 1998: a 45-second incident on the tape; the fall from the top to the bottom fits in it", () => {
    let top = 0,
      topT = 0,
      low = Infinity,
      lowT = 0;
    for (const t of times(T_START, T_END)) {
      const a = channel("alt", t);
      if (a > top) [top, topT] = [a, t];
    }
    for (const t of times(topT, T_END)) {
      const a = channel("alt", t);
      if (a < low) [low, lowT] = [a, t];
    }
    expect(C5_DIEGO_GARCIA.recorder.incidentS).toBe(45);
    expect(lowT - topT).toBeGreaterThan(30);
    expect(lowT - topT).toBeLessThan(C5_DIEGO_GARCIA.recorder.incidentS);
  });
});

describe("the systems the animation shows", () => {
  test("the gear handle: DOWN at 26.7 s, UP at 95.7 s", () => {
    expect(at(26.6).gear).toBe("UP");
    expect(at(26.7).gear).toBe("DOWN");
    expect(at(95.6).gear).toBe("DOWN");
    expect(at(95.7).gear).toBe("UP");
  });

  test("the slats: retract lock until 9.3 s, no lock either way until 122.3 s", () => {
    expect(at(9).slatRetLocked).toBe(true);
    expect(at(9.3).slatRetLocked).toBe(false);
    for (const t of times(9.4, 122.2)) expect(at(t).slatExtLocked).toBe(false);
    expect(at(122.3).slatExtLocked).toBe(true);
    expect(at(134.6).slatExtLocked).toBe(false);
    expect(at(143).slatExtLocked).toBe(true);
    expect(at(144).slatExtLocked).toBe(false);
    expect(at(150).slatExtLocked).toBe(true);
  });

  test("the drawn gear follows its handle over the transit time, from wherever it was", () => {
    expect(gearTravel(26)).toBe(0);
    expect(gearTravel(26.7 + GEAR_TRANSIT_S / 2)).toBeCloseTo(0.5, 5);
    expect(gearTravel(26.7 + GEAR_TRANSIT_S)).toBe(1);
    expect(gearTravel(95.7 + GEAR_TRANSIT_S / 4)).toBeCloseTo(0.75, 5);
    expect(gearTravel(95.7 + GEAR_TRANSIT_S)).toBe(0);
  });

  test("the drawn slats stop short while neither lock holds and seat while EXT shows LOCKED", () => {
    expect(slatTravel(9)).toBe(0);
    expect(slatTravel(9.3 + SLAT_TRANSIT_S)).toBeCloseTo(SLAT_SHORT, 5);
    expect(slatTravel(100)).toBeCloseTo(SLAT_SHORT, 5);
    expect(slatTravel(122.3 + SLAT_TRANSIT_S * (1 - SLAT_SHORT))).toBeCloseTo(1, 5);
    expect(slatTravel(140)).toBeCloseTo(SLAT_SHORT, 5);
    expect(slatTravel(160)).toBe(1);
  });
});

describe("the replay's data", () => {
  test("the corrected airspeed and altitude agree with what the animation's windows read", () => {
    for (const [t, v] of IAS_READINGS) expect(Math.abs(channel("ias", t) - v), `IAS at ${t} s`).toBeLessThan(1.5);
    for (const [t, v] of ALT_READINGS) expect(Math.abs(channel("alt", t) - v), `ALT at ${t} s`).toBeLessThan(15);
    for (const [t, v] of HDG_READINGS) {
      const d = Math.abs(((at(t).hdg - v + 540) % 360) - 180);
      expect(d, `HDG at ${t} s`).toBeLessThan(1.5);
    }
  });

  test("the vertical speed follows the altitude", () => {
    expect(Math.abs(at(70).vs)).toBeLessThan(300);
    expect(at(85).vs).toBeGreaterThan(500);
    expect(at(128).vs).toBeLessThan(-3000);
    expect(at(146).vs).toBeGreaterThan(0);
  });

  test("the flight path is below the nose in the stall", () => {
    const f = at(110);
    expect(f.path).toBeLessThan(f.pitch - 15);
  });

  test("the dead-reckoned track starts at the origin and has a sample for every data point", () => {
    expect(TRACK.east[0]).toBe(0);
    expect(TRACK.north[0]).toBe(0);
    expect(TRACK.east.length).toBe(Math.round((T_END - T_START) / 0.2) + 1);
    for (const a of [TRACK.east, TRACK.north, TRACK.up]) expect(a.every(Number.isFinite)).toBe(true);
  });
});

describe("the ground under the track", () => {
  const { runway } = C5_DIEGO_GARCIA.airport;
  // metres per degree on the WGS84 ellipsoid at the runway's latitude
  const lat = (runway.end31.lat * Math.PI) / 180;
  const mLat = 111132.92 - 559.82 * Math.cos(2 * lat) + 1.175 * Math.cos(4 * lat);
  const mLon = 111412.84 * Math.cos(lat) - 93.5 * Math.cos(3 * lat);
  const toEnd13 = [(runway.end13.lon - runway.end31.lon) * mLon, (runway.end13.lat - runway.end31.lat) * mLat];
  const length = Math.hypot(toEnd13[0], toEnd13[1]);
  /** Along runway 31 from its threshold, and right of its centreline, m. */
  const onRunway = (t: number) => {
    const [e, n] = groundAt(t),
      [x, y] = [toEnd13[0] / length, toEnd13[1] / length];
    return { along: e * x + n * y, right: e * y - n * x };
  };

  test("OurAirports: runway 13/31's ends are 12,003 ft apart, runway 31 on 301.7° true", () => {
    expect(length / 0.3048).toBeCloseTo(runway.lengthFt, -1);
    const bearing = ((Math.atan2(toEnd13[0], toEnd13[1]) * 180) / Math.PI + 360) % 360;
    expect(bearing).toBeCloseTo(runway.heading31T, 1);
  });

  test("the placed track passes the fitted point, and the ground's frame is its inverse", () => {
    const [e, n, u] = groundAt(PLACEMENT.t);
    expect(e).toBeCloseTo(PLACEMENT.east, 6);
    expect(n).toBeCloseTo(PLACEMENT.north, 6);
    expect(u).toBeCloseTo(trackAt(PLACEMENT.t)[2], 6);
    // the runway 31 end, put back on the track, is the ground's origin
    const g = groundFrame(),
      [e0, n0] = trackAt(PLACEMENT.t);
    const c = Math.cos(g.turn),
      s = Math.sin(g.turn);
    const [de, dn] = [g.east - e0, g.north - n0];
    expect(PLACEMENT.east + c * de + s * dn).toBeCloseTo(0, 6);
    expect(PLACEMENT.north - s * de + c * dn).toBeCloseTo(0, 6);
  });

  test("the animation's runway view: the lowest point short of runway 31 near its centreline, the data's end over it", () => {
    const low = onRunway(144.2);
    expect(low.along).toBeLessThan(-500);
    expect(low.along).toBeGreaterThan(-1500);
    expect(Math.abs(low.right)).toBeLessThan(100);
    // the threshold passes under the view's foot at about 2:32, so the airplane crosses it soon after
    const end = onRunway(T_END);
    expect(end.along).toBeGreaterThan(0);
    expect(end.along).toBeLessThan(length);
    expect(end.right).toBeGreaterThan(0);
    expect(end.right).toBeLessThan(400);
  });
});

describe("the transcript and the timeline", () => {
  test("lines are in order, within the video, and don't overlap", () => {
    let end = 0;
    for (const l of TRANSCRIPT) {
      expect(l.t, l.text).toBeGreaterThanOrEqual(end);
      expect(l.end, l.text).toBeGreaterThan(l.t);
      end = l.end;
    }
    expect(end).toBeLessThanOrEqual(DURATION);
  });

  test("Lacklen: “Terrain, terrain” as the ocean surface approaches", () => {
    const l = lineAt(139.5)!;
    expect(l.who).toBe("GPWS");
    expect(l.text).toMatch(/Terrain/);
    expect(at(l.t).alt).toBeLessThan(1500);
    expect(TRANSCRIPT[lastLineIndex(139.5)]).toBe(l);
    expect(lastLineIndex(0)).toBe(-1);
  });

  test("the timeline's moments are in order within the data", () => {
    let t = 0;
    for (const m of MOMENTS) {
      expect(m.t, m.title).toBeGreaterThanOrEqual(t);
      expect(m.t, m.title).toBeLessThanOrEqual(T_END);
      t = m.t;
    }
  });
});
