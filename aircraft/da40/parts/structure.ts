import * as THREE from "three";
import { V, toVec3 } from "@/lib/math";
import { mergeGeos } from "@/lib/geometry";
import {
  BAG_FRAME,
  FW,
  ROLLBAR_X,
  WJ,
  box,
  botY,
  fRing,
  fs,
  loft,
  planeRing,
  sph,
  topY,
  tubeGeo,
  cyl,
} from "../geometry";
import {
  FRONT_SPAR,
  REAR_SPAR,
  insideWing,
  mainBulkhead,
  rearWeb,
  rootRibs,
  controlRib,
  wingEndRib,
  sparMember,
  sparStub,
  tankRib,
} from "../wing-installation";
import { AILERON_HORN_Z, FLAP_HORN_Z, flapBellcrank, PIVOTS } from "../rig";
import { part } from "./catalogue";

/* ---------- structure ---------- */
part(() => planeRing(FW), ["airframe", "engine"], {
  id: "parts.structure.firewall.001",
  plate: true,
  pin: true,
  pinIn: ["airframe"],
  name: "Firewall",
  note: "Fire-resistant matting covered with stainless-steel cladding on the engine side (AFM 7-3). Station not given in the documents (≈ FS 1.35 here).",
});
part(() => planeRing(BAG_FRAME), ["airframe", "cabin"], {
  id: "parts.structure.baggage-compartment-frame.002",
  plate: true,
  pin: true,
  name: "Baggage compartment frame",
  note: "Rear of the standard baggage compartment; the baggage tube and extension lie behind it. Cabin air leaves through holes in this frame (AMM21-00-00p3).",
});
part(
  () => tubeGeo(fRing(ROLLBAR_X, 0.93, 30, -0.1, Math.PI + 0.1, false), 0.025),
  ["airframe", "cabin", "environment"],
  {
    id: "parts.structure.roll-bar.003",
    color: "#4E5961",
    name: "Roll bar",
    note: "Cabin roll bar behind the front seats; carries the spherical ventilation nozzles beside the front seats (AFM 7-12). Structural details not in the AFM.",
    pin: true,
  },
);
// AMM 53-10 and 57-10. Composite colors distinguish the caps, webs and fittings in X-ray.
for (const [token, position, chord] of [
  ["member-1", "Front", FRONT_SPAR],
  ["member-2", "Rear", REAR_SPAR],
] as const) {
  part(() => mainBulkhead(chord), ["airframe"], {
    id: "parts.structure.part.004",
    instance: [token],
    name: position + " main bulkhead",
    note: "The box-section bulkhead receives the wing spar stubs. Carbon reinforcement runs along the top and bottom of the glass-fiber box (AMM 53-10-00, Fig. 2).",
    color: "#698278",
    pin: true,
  });
  for (const side of [1, -1]) {
    part(() => sparMember(side, chord, "web"), ["airframe"], {
      id: "parts.structure.spar-web",
      instance: [token, side],
      name: position + " spar shear web",
      note: "Glass-fiber skins enclose the foam shear web between the upper and lower carbon caps (AMM 57-10-00 p. 3).",
      color: "#9B986E",
      pin: side === (position === "Front" ? 1 : -1),
    });
    part(() => mergeGeos([sparMember(side, chord, "upper"), sparMember(side, chord, "lower")]), ["airframe"], {
      id: "parts.structure.spar-caps",
      instance: [token, side],
      name: position + " spar caps",
      note: "Unidirectional carbon layers form the two caps of the I-section. The number of layers decreases toward the tip (AMM 57-10-00 p. 3).",
      color: "#374952",
    });
    part(() => sparStub(side, chord), ["airframe"], {
      id: "parts.structure.spar-stub",
      instance: [token, side],
      name: position + " spar stub",
      note: "The spar continues inboard past the root rib as a glass-wrapped box. Bushes and main bolts transfer wing bending loads into the center section (AMM 57-10-00 p. 3, Fig. 3).",
      color: "#566865",
    });
    for (const [bolt, span] of [
      ["inner", 0.68],
      ["outer", 0.98],
    ] as const) {
      part(() => cyl(0.017, 0.115, "x"), ["airframe"], {
        id: "parts.structure.wing-main-bolt",
        instance: [token, side, bolt],
        name: "Wing main bolt",
        pos: toVec3(insideWing(side * span, chord, 0)),
        color: "#CBD2D2",
        note: "A main bolt passes through bushes in the bulkhead and spar stub (AMM 57-10-00 Fig. 3).",
      });
    }
  }
}

for (const side of [1, -1]) {
  part(() => rootRibs(side), ["airframe"], {
    instance: [side],
    id: "parts.structure.root-rib-wing-joint.005",
    color: "#8B947A",
    name: "Root rib / wing joint",
    note: "The front and rear root ribs carry the A- and B-bolts. The middle rib has an oval access opening through which the tank assembly can pass (AMM 57-10-00 p. 4).",
    pin: side > 0,
  });
  for (const [bolt, chord] of [
    ["A", 0.09],
    ["B", 0.585],
  ] as const) {
    part(() => cyl(0.013, 0.08, "z"), ["airframe"], {
      id: "parts.structure.root-rib-bolt",
      instance: [side, bolt],
      name: bolt + "-bolt",
      pos: toVec3(insideWing(side * WJ, chord, 0)),
      color: "#BBC4C7",
      note: "This root-rib fitting transmits lift into the center section (AMM 57-10-00 p. 4).",
    });
  }
  for (const [rib, span] of [
    ["first", 1.35],
    ["second", 1.95],
    ["third", 2.28],
    ["fourth", 2.83],
    ["fifth", 3.37],
  ] as const) {
    part(() => tankRib(side * span), ["airframe", "fuel"], {
      id: "parts.structure.tank-support-rib",
      instance: [side, rib],
      name: "Fuel tank support rib",
      note: "An open glass-fiber rib supports the removable aluminum tank between the spars. The rib stays with the wing when the tank is withdrawn (AMM 57-10-00 p. 4, 05-25-00 pp. 3–4). Rib stations are illustrative.",
      color: "#9F9E7A",
      pin: side > 0 && rib === "fourth",
      pinIn: ["airframe"],
    });
  }
  for (const [system, control, pivot] of [
    ["flaps", "Flap", flapBellcrank(side)],
    ["controls", "Aileron", side > 0 ? PIVOTS.wbR() : PIVOTS.wbL()],
  ] as const) {
    part(() => controlRib(pivot), ["airframe", system], {
      id: "parts.structure.control-rib",
      instance: [side, system],
      color: "#8D957C",
      name: control + " control rib",
      note: "This rib joins the rear spar to the trailing-edge web. Its reinforced bend supports the wing bellcrank (AMM 57-10-00 p. 4).",
    });
  }
  part(() => wingEndRib(side), ["airframe"], {
    id: "parts.structure.end-rib",
    instance: [side],
    name: "Wing end rib",
    color: "#89947E",
    note: "The end rib closes the wing and carries the attachments for the removable tip (AMM 57-10-00 p. 4).",
  });
  part(() => rearWeb(side, FLAP_HORN_Z, AILERON_HORN_Z), ["airframe"], {
    id: "parts.structure.rear-web",
    instance: [side],
    name: "Trailing-edge web",
    note: "The rear web closes the fixed wing aft of the rear spar and carries the flap and aileron hinge attachments (AMM 57-10-00 p. 4).",
    color: "#808B80",
  });
}
[1, -1].forEach((s) =>
  part(() => sph(0.03), ["airframe", "gear"], {
    instance: [s],
    id: "parts.structure.jack-point.006",
    pos: [fs(2.41), botY(fs(2.41)) - 0.02, s * 0.35],
    color: "#E0522B",
    name: "Jack point",
    note: "Lower fuselage at the left and right root ribs (FS 2410), plus the tail fin (FS 7312) (AFM 8-7; SMM Fig. 2-6).",
    pin: s > 0,
    ext: true,
  }),
);
part(() => box(0.15, 0.025, 0.04), ["airframe"], {
  id: "parts.structure.levelling-wedge-position.007",
  pos: [fs(6.0), topY(fs(6.0)) - 0.022, 0],
  color: "#E0B040",
  name: "Levelling wedge position",
  note: "Place a 600:31 wedge here, on top of the tail boom in front of the fin: with its top level, the Datum Plane is vertical (AFM 6-3).",
  pin: true,
});
// ventral fin with tail skid
part(
  () => {
    const S = (h: number, le: number, te: number) => {
      const c = le - te;
      const pts: THREE.Vector3[] = [];
      for (const [x, z] of [
        [0, 0],
        [0.3, 0.012],
        [0.7, 0.008],
        [1, 0],
        [0.7, -0.008],
        [0.3, -0.012],
      ])
        pts.push(V(le - x * c, h, z));
      return pts;
    };
    return loft([S(-0.69, fs(6.95), fs(7.3)), S(-0.6, fs(6.7), fs(7.32)), S(-0.5, fs(6.5), fs(7.34))]);
  },
  ["airframe"],
  {
    id: "parts.structure.lower-fin-and-tail-skid.008",
    color: "#E6E9EB",
    name: "Lower fin and tail skid",
    note: "Small ventral fin with the tail skid underneath — walk-around item 'tail skid and lower fin' (AFM 4A-7).",
    ext: true,
    pin: true,
  },
);
