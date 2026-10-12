import * as THREE from "three";
import * as C172 from "@/aircraft/c172s/geometry";
import * as C182 from "@/aircraft/c182t/geometry";
import * as DA40 from "@/aircraft/da40/geometry";
import * as M20C from "@/aircraft/m20c/geometry";
import { af } from "@/lib/geometry";

export type ExpandedAircraft = "c172s" | "c182t" | "da40" | "m20c";

interface HorizontalEnvelope {
  span: readonly [number, number];
  le: (z: number) => number;
  chord: (z: number) => number;
  point: (z: number, chord: number, side: number) => THREE.Vector3;
}

/** Independent physical oracle for the model's skin, not surveyed installation dimensions. */
function horizontalInside(p: THREE.Vector3, surface: HorizontalEnvelope, margin: number) {
  const z = Math.abs(p.z);
  if (z < surface.span[0] + margin || z > surface.span[1] - margin) return false;
  const chord = surface.chord(p.z);
  const fraction = (surface.le(p.z) - p.x) / chord;
  if (fraction < 0 || fraction > 1) return false;
  return p.y >= surface.point(p.z, fraction, -1).y + margin && p.y <= surface.point(p.z, fraction, 1).y - margin;
}

const cessna = (g: typeof C172 | typeof C182) => ({
  fuselage: g.FUSE,
  wing: { span: [g.AF.rootZ, g.tipZ] as const, le: g.wLE, chord: g.wC, point: g.wingP },
  tail: { span: [0, g.stZ] as const, le: g.sLE, chord: g.sC, point: g.AF.STAB.p },
  fin: g.AF.FIN,
  finLE: g.fLE,
  finChord: g.fC,
  finThickness: (y: number) => Math.min(0.12, 0.09 / Math.max(g.fC(y), 0.3)),
});

const envelopes = {
  c172s: cessna(C172),
  c182t: cessna(C182),
  da40: {
    fuselage: DA40.FUSE,
    wing: { span: [DA40.WR, DA40.WTIP] as const, le: DA40.wLE, chord: DA40.wC, point: DA40.wingP },
    tail: { span: [0, DA40.SSPAN] as const, le: DA40.sLE, chord: DA40.sC, point: DA40.stab.p },
    fin: DA40.FIN,
    finLE: DA40.fLE,
    finChord: DA40.fC,
    finThickness: (y: number) => Math.min(0.12, 0.085 / Math.max(DA40.fC(y), 0.3)),
  },
  m20c: {
    fuselage: M20C.FUSE,
    wing: { span: [M20C.WR, M20C.WTIP] as const, le: M20C.wLE, chord: M20C.wC, point: M20C.wingP },
    tail: { span: [0, M20C.SSPAN] as const, le: M20C.sLE, chord: M20C.sC, point: M20C.stab.p },
    fin: M20C.FIN,
    finLE: M20C.fLE,
    finChord: M20C.fC,
    finThickness: (y: number) => Math.min(0.12, 0.09 / Math.max(M20C.fC(y), 0.4)),
  },
};

/** Union of fuselage, complete wing, stabilizer and fin in the neutral ground pose. */
export function insideFleetAirframe(id: ExpandedAircraft, p: THREE.Vector3, margin = 0) {
  const e = envelopes[id];
  if (e.fuselage.inside(p, margin)) return true;
  if (horizontalInside(p, e.wing, margin) || horizontalInside(p, e.tail, margin)) return true;
  if (p.y < e.fin[0][0] + margin || p.y > e.fin.at(-1)![0] - margin) return false;
  const chord = e.finChord(p.y);
  const fraction = (e.finLE(p.y) - p.x) / chord;
  return fraction >= 0 && fraction <= 1 && Math.abs(p.z) + margin <= af(fraction, e.finThickness(p.y), 0)[0] * chord;
}
