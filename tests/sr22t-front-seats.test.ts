/** Front occupants: POH 13772-007 Fig 6-3 Loading Data (PDF p. 222), FS 143.5; rear occupants FS 180. */
import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { WR, inFus, wC, wLE, wY } from "@/aircraft/sr22t/geometry";
import { FLOWS } from "@/aircraft/sr22t/flows";
import { CAPS_CABLE, CAT, OXY, YOKE_X } from "@/aircraft/sr22t/parts";
import { AC } from "@/aircraft/sr22t/parts/aircon";
import { CAPS_HANDLE_ATTACH, CAPS_HANDLE_POS, FRONT_SEAT, REAR_SEAT } from "@/aircraft/sr22t/parts/cabin";
import { BLOWER } from "@/aircraft/sr22t/parts/environment";
import type { PartSpec } from "@/lib/catalogue";
import { doorIntersects, doorSolid } from "./sr22t-door-clearance";

const named = (name: string) => CAT.parts.filter((p) => p.name === name);
/** Each seat name has two parts: the cushion first, then the reclined back (parts/cabin.ts). */
const front = [...named("Pilot seat"), ...named("Front passenger seat")];
const frontCushions = [named("Pilot seat")[0], named("Front passenger seat")[0]];
const frontBacks = [named("Pilot seat")[1], named("Front passenger seat")[1]];
const rearCushions = [named("Rear seat (2+1 bench)")[0], named("Rear seat")[0]];
// Every solid whose world placement follows the front seats: the seats and the parts placed from them.
const moved = [
  ...front,
  ...named("CAPS activation T-handle"),
  ...named("CAPS handle receptacle"),
  ...named("CAPS activation handle cover"),
  ...named("CAPS cover black forward tab"),
  ...named("GTS 800 traffic processor (optional)"),
  ...named("Cabin microphone"),
  ...named("A/C evaporator"),
  ...named("Expansion valve"),
  ...named("Recirculation check valve"),
  ...named("Blower fan assembly"),
];
/** Model x → fuselage station; 39.37 is rounded inches/metre, independent of the published fsX scale. */
const FS = (x: number) => 100 + (2.61 - x) * 39.37;

type Solid = ReturnType<typeof doorSolid>;
const solids = new Map<PartSpec, Solid>();
/** World-placed mesh: parented parts at their neutral pose, doors closed (tests/sr22t-door-clearance.ts). */
const solidOf = (p: PartSpec) => {
  if (!solids.has(p)) solids.set(p, doorSolid(p));
  return solids.get(p)!;
};
const box = (p: PartSpec) => solidOf(p).box;
const hits = (a: PartSpec, b: PartSpec) => doorIntersects(solidOf(a), solidOf(b));

describe("SR22T front occupant station", () => {
  it("ties each seat row to its POH occupant station: front FS 143.5, rear FS 180 (POH Fig 6-3, PDF p. 222)", () => {
    expect(front).toHaveLength(4);
    expect(FS(FRONT_SEAT.referenceX)).toBeCloseTo(143.5, 3);
    expect(FS(REAR_SEAT.referenceX)).toBeCloseTo(180, 3);
    for (const p of frontCushions) {
      const b = box(p);
      // The front occupant arm sits on the cushion, which mostly lies forward of it.
      expect(FRONT_SEAT.referenceX).toBeGreaterThan(b.min.x);
      expect(FRONT_SEAT.referenceX).toBeLessThan(b.max.x);
      expect(b.getCenter(new Vector3()).x).toBeGreaterThan(FRONT_SEAT.referenceX);
      expect(p.pos![0] - FRONT_SEAT.cushionOffset).toBeCloseTo(FRONT_SEAT.referenceX, 8);
      // Extent: FS ~131 to ~150.
      expect(FS(b.max.x)).toBeGreaterThan(130);
      expect(FS(b.min.x)).toBeLessThan(150.5);
    }
    // The reclined back rises from the cushion's aft edge, aft of the occupant arm (back centre FS ~150.3).
    for (const p of frontBacks) {
      expect(p.pos![0]).toBeLessThan(FRONT_SEAT.referenceX);
      expect(FS(p.pos![0])).toBeCloseTo(150.3, 0);
      expect(Math.abs(p.pos![0] - box(frontCushions[0]).min.x)).toBeLessThan(0.03);
    }
    for (const p of rearCushions) expect(p.pos![0] - REAR_SEAT.cushionOffset).toBeCloseTo(REAR_SEAT.referenceX, 8);
  });

  it("puts the main spar and the forward wing attach points under the front seats (POH 7-5, 7-6)", () => {
    const cushion = box(frontCushions[0]);
    // Spar centreline inside the fuselage (parts/structure.ts), radius 0.04.
    const sx = wLE(WR) - 0.3 * wC(WR),
      sy = wY(WR) + 0.02 * wC(WR);
    expect(sx).toBeGreaterThan(cushion.min.x);
    expect(sx).toBeLessThan(cushion.max.x);
    expect(sy + 0.04).toBeLessThan(cushion.min.y);
    // Four attach points: two under the front seats, two on the sidewall aft of the rear seats (POH 7-5).
    const all = named("Wing attach point");
    expect(all).toHaveLength(4);
    const attach = [...all].sort((a, b) => box(b).min.x - box(a).min.x).slice(0, 2);
    for (const p of attach) {
      const c = box(p).getCenter(new Vector3());
      expect(c.x).toBeGreaterThan(cushion.min.x);
      expect(c.x).toBeLessThan(cushion.max.x);
      expect(c.y).toBeLessThan(FRONT_SEAT.lift - 0.45);
    }
  });

  it("leaves a positive gap from the front seat back's aft face to the rear cushion's front edge", () => {
    expect(frontBacks.every((p) => p.pos![0] === FRONT_SEAT.referenceX + FRONT_SEAT.backOffset)).toBe(true);
    const backAft = Math.min(...frontBacks.map((p) => box(p).min.x)),
      rearFront = Math.max(...rearCushions.map((p) => box(p).max.x));
    expect(backAft - rearFront).toBeGreaterThan(0.25);
  });

  it("clears the yokes, console, rudder pedals, doors and rear cushions", () => {
    const groups: Record<string, PartSpec[]> = {
      yokes: CAT.parts.filter((p) => p.parent?.startsWith("yoke:") || p.parent?.startsWith("grip:")),
      console: [
        ...named("Center console"),
        ...named("Circuit breaker panel"),
        ...named("Armrest: egress hammer & hour meters"),
      ],
      pedals: CAT.parts.filter((p) => p.parent === "rig:pedL" || p.parent === "rig:pedR"),
      doors: CAT.parts.filter((p) => p.parent === "door:L" || p.parent === "door:R"),
      rear: rearCushions,
    };
    // The cushion's forward edge stays aft of the yoke station (FS ~123), and of every yoke and pedal part.
    const cushionFront = Math.max(...frontCushions.map((p) => box(p).max.x));
    expect(cushionFront).toBeCloseTo(
      FRONT_SEAT.referenceX + FRONT_SEAT.cushionOffset + FRONT_SEAT.cushionLength / 2,
      6,
    );
    expect(cushionFront).toBeLessThan(YOKE_X);
    for (const p of [...groups.yokes, ...groups.pedals]) expect(box(p).min.x, p.name).toBeGreaterThan(cushionFront);
    const offenders: string[] = [];
    for (const [group, parts] of Object.entries(groups)) {
      expect(parts.length, group).toBeGreaterThan(0);
      for (const seat of front)
        for (const other of parts) if (hits(seat, other)) offenders.push(`${seat.name} / ${other.name} (${group})`);
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the front seats and every part placed from them clear of all other catalogue solids", () => {
    // Over the seat-back shoulder line (POH 7-96: above the pilot's right shoulder).
    expect(CAPS_HANDLE_POS[0]).toBeCloseTo(FRONT_SEAT.referenceX + FRONT_SEAT.backOffset + 0.07, 8);
    expect(moved).toHaveLength(14);
    // The T-handle is stowed inside its receptacle, joined to its cable (POH 7-96).
    const caps = ["CAPS activation T-handle", "CAPS handle receptacle", "CAPS activation cable"];
    const offenders: string[] = [];
    for (const target of moved)
      for (const other of CAT.parts) {
        if (other === target) continue;
        // A seat's back is joined to its own cushion by design (POH 7-27).
        if (front.includes(target) && front.includes(other) && target.name === other.name) continue;
        if (caps.includes(target.name ?? "") && caps.includes(other.name ?? "")) continue;
        if (hits(target, other))
          offenders.push(`${target.name} / ${other.name ?? other.id} (${other.parent ?? "fixed"})`);
      }
    expect(offenders).toEqual([]);
  });

  it("keeps the front seats inside the cabin hull", () => {
    for (const p of frontCushions) expect(p.pos![0]).toBeCloseTo(FRONT_SEAT.referenceX + FRONT_SEAT.cushionOffset, 8);
    for (const seat of front) {
      const a = solidOf(seat).g.getAttribute("position");
      for (let i = 0; i < a.count; i++) expect(inFus(new Vector3().fromBufferAttribute(a, i)), seat.name).toBe(true);
    }
  });
  it("keeps each part placed from the front seats at its source placement", () => {
    const [lh, rh] = frontCushions.map(box);
    const over = (x: number, b: Box3) => x > b.min.x && x < b.max.x;
    // CAPS T-handle over the reclined back's top, above the pilot's right shoulder (POH 7-96; Fig 7-4 item 1).
    const back = box(frontBacks[0]);
    expect(over(CAPS_HANDLE_POS[0], back)).toBe(true);
    expect(CAPS_HANDLE_POS[1]).toBeGreaterThan(back.max.y);
    // Front reading lights above each front occupant (POH 7-59).
    const lights = named("Reading light").filter((p) => over(p.pos![0], lh));
    expect(lights.map((p) => Math.sign(p.pos![2])).sort()).toEqual([-1, 1]);
    for (const p of lights) expect(p.pos![1]).toBeGreaterThan(lh.max.y);
    // GTS 800 under the LH crew seat (POH 7-84, Fig 7-20 item 30).
    const gts = box(named("GTS 800 traffic processor (optional)")[0]).getCenter(new Vector3());
    expect(over(gts.x, lh) && gts.z > lh.min.z && gts.z < lh.max.z && gts.y < lh.min.y).toBe(true);
    // Microphone beside the centre console between the front seats, just aft of the circuit breaker panel (POH 7-88,
    // Fig 7-20 item 29).
    const mic = box(named("Cabin microphone")[0]);
    expect(over(mic.getCenter(new Vector3()).x, lh)).toBe(true);
    expect(mic.max.x).toBeLessThan(box(named("Circuit breaker panel")[0]).min.x);
    // A/C evaporator and its bolted blower under the RH crew seat (POH 7-64; AMM 21-50 PDF pp. 496, 504), forward of the
    // main spar.
    const spar = wLE(WR) - 0.3 * wC(WR);
    for (const name of ["A/C evaporator", "Blower fan assembly"]) {
      const c = box(named(name)[0]).getCenter(new Vector3());
      expect(over(c.x, rh) && c.z > 0 && c.y < rh.min.y, name).toBe(true);
      expect(c.x, name).toBeGreaterThan(spar);
    }
    expect(BLOWER[0]).toBe(AC.evaporator[0]);
    // The refrigerant, air and drain runs still start and end on the evaporator group (POH 7-65).
    const pts = (key: string) => FLOWS.find((f) => f.key === key)!.pts.map((p) => new Vector3(...(p as number[])));
    const at = (p: Vector3, q: readonly number[]) => p.distanceTo(new Vector3(...q));
    expect(at(pts("acLiquid2").at(-1)!, AC.expansion)).toBeLessThan(1e-9);
    for (const key of ["acSuction", "acEvapDuct", "acDrain"])
      expect(at(pts(key)[0], AC.evaporator), key).toBeLessThan(1e-9);
    for (const key of ["acCoupler", "acRecirc"]) expect(at(pts(key).at(-1)!, AC.evaporator), key).toBeLessThan(1e-9);
    expect(at(pts("fanDuct")[0], BLOWER)).toBeLessThan(0.1);
  });

  it("keeps the overhead oxygen console at the cabin centre, aft of the CAPS cover and forward of the speaker", () => {
    // The CAPS handle sits over the front occupants' shoulder line (POH 7-96); the console stays on the dome light at the
    // approximate centre of the cabin (POH 7-59; AFMS Fig 1), one grouped panel carrying all five outlets.
    const unit = box(named("Overhead distribution manifold")[0]);
    for (const name of ["CAPS activation handle cover", "CAPS handle receptacle", "CAPS cover black forward tab"])
      expect(unit.max.x, name).toBeLessThan(box(named(name)[0]).min.x);
    expect(unit.min.x).toBeGreaterThan(box(named("Cabin speaker")[0]).max.x);
    expect(OXY.outlets).toHaveLength(5);
    for (const p of OXY.outlets) expect(unit.distanceToPoint(new Vector3(...p))).toBeLessThan(0.03);
  });

  it("runs the CAPS activation cable from the moved handle, clear of the overhead console and speaker", () => {
    // Handle → roof → igniter (AMM Fig 95-00-1, PDF p. 2853); the run turns outboard over the shoulder-line handle.
    expect(CAPS_CABLE[0]).toEqual(CAPS_HANDLE_ATTACH);
    expect(CAPS_CABLE[2][2]).toBeCloseTo(-0.12, 9);
    const cable = named("CAPS activation cable")[0];
    for (const name of ["Overhead distribution manifold", "Dome light", "Cabin speaker"])
      expect(hits(cable, named(name)[0]), name).toBe(false);
  });
});
