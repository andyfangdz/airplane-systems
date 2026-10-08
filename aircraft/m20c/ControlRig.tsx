"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { Links, type LinkSpec } from "@/components/scene/Links";
import { Parts } from "@/components/scene/Part";
import { live } from "./model";
import { CAT } from "./parts";
import { ARMS, PIVOTS, WHEEL, linkPoints, rigPose } from "./rig";
import { useM20C } from "./store";

const P = ({ parent }: { parent: string }) => <Parts cat={CAT} parent={parent} />;
const ail = { chan: "aileron" as const, sys: ["controls" as const] };
const el = { chan: "elevator" as const, sys: ["controls" as const] };
const rud = { chan: "rudder" as const, sys: ["controls" as const] };

/** Rods whose two ends move every frame (all push-pull tubes with rod-end bearings, OM p. 8). */
const LINKS: Record<string, LinkSpec> = {
  shaftL: {
    ...el,
    name: "Wheel shaft",
    note: "The control-wheel shaft slides through the panel: push for nose down, pull for nose up; it turns for the ailerons.",
    r: 0.012,
  },
  shaftR: { ...el, name: "Wheel shaft", note: "Co-pilot's wheel shaft (dual controls, Ranger 1-3).", r: 0.012 },
  elev1: {
    ...el,
    name: "Elevator push-pull tube (cabin)",
    note: "From the torque-tube lever under the panel aft under the floor (routing inferred).",
    r: 0.009,
  },
  elev2: {
    ...el,
    name: "Elevator push-pull tube (tail cone)",
    note: "Long tube through the tail cone to the bellcrank at the tail-cone bulkhead.",
    r: 0.009,
  },
  elev3: {
    ...el,
    name: "Elevator rod",
    note: "Short rod from the tail-cone bellcrank to the elevator horn, crossing the empennage pivot.",
    r: 0.008,
  },
  ailDrop: {
    ...ail,
    name: "Aileron drop link",
    note: "Wheel rotation to the forward bellcrank under the floor (inferred).",
    r: 0.006,
  },
  ailAft: {
    ...ail,
    name: "Aileron push-pull tube (cabin)",
    note: "Fore-aft tube under the front seats to the centre bellcrank at the main spar.",
    r: 0.008,
  },
  ailWR: {
    ...ail,
    name: "Aileron push-pull tube (right wing)",
    note: "Spanwise tube behind the main spar to the wing bellcrank (OM p. 8).",
    r: 0.008,
  },
  ailWL: {
    ...ail,
    name: "Aileron push-pull tube (left wing)",
    note: "Spanwise tube behind the main spar to the wing bellcrank; the PC roll servo acts on it.",
    r: 0.008,
  },
  ailHR: {
    ...ail,
    name: "Aileron rod with rod ends",
    note: "Self-aligning rod-end bearings to the aileron horn (OM p. 8).",
    r: 0.006,
  },
  ailHL: {
    ...ail,
    name: "Aileron rod with rod ends",
    note: "Self-aligning rod-end bearings to the aileron horn (OM p. 8).",
    r: 0.006,
  },
  pcRoll: {
    chan: "aileron",
    sys: ["controls", "autopilot"],
    name: "PC roll servo link",
    note: "Bellows servo to the aileron tube — easily overpowered by the pilot (OM p. 8).",
    r: 0.005,
    color: "#C8399F",
  },
  pedBarL: {
    chan: "rudder",
    sys: ["controls", "gear"],
    name: "Left pedal cross tube",
    note: "Links the pilot's and co-pilot's left pedals.",
    r: 0.008,
  },
  pedBarR: {
    chan: "rudder",
    sys: ["controls", "gear"],
    name: "Right pedal cross tube",
    note: "Links the pilot's and co-pilot's right pedals.",
    r: 0.008,
  },
  rud1: {
    ...rud,
    name: "Rudder push-pull tube",
    note: "From the pedal lever aft down the right side to the tail-cone bellcrank (OM p. 8).",
    r: 0.009,
  },
  rud2: {
    ...rud,
    name: "Rudder rod",
    note: "Tail-cone bellcrank to the rudder horn, crossing the empennage pivot.",
    r: 0.007,
  },
  steer: {
    chan: "rudder",
    sys: ["controls", "gear"],
    name: "Nose-wheel steering rod",
    note: "The nose gear is linked directly to the rudder pedals (OM p. 15); retraction disconnects and centres it (Ranger 2-12).",
    r: 0.007,
  },
  pcYaw: {
    chan: "rudder",
    sys: ["controls", "autopilot"],
    name: "PC rudder servo link",
    note: "Bellows servo to the rudder tube.",
    r: 0.005,
    color: "#C8399F",
  },
  trimTube: {
    ...el,
    name: "Trim torque tube",
    note: "Gear reduction at the trim wheel → torque tube aft along the floor to the jack screw (OM p. 9).",
    r: 0.009,
    color: "#9F85E6",
  },
  jack: {
    ...el,
    name: "Jack screw",
    note: "Raises and lowers the empennage about its pivot (OM p. 6, 9).",
    r: 0.012,
    color: "#9F85E6",
  },
};

const pose = () => rigPose(live.eff, useM20C.getState().s.ctrl.trim);
const points = () => linkPoints(pose());

/** Wheels, pedals, bellcranks and push-pull tubes, animated from the effective controls. */
export function ControlRig() {
  const g = useRef<Record<string, THREE.Object3D | null>>({});
  const set = (k: string) => (o: THREE.Object3D | null) => {
    g.current[k] = o;
  };

  useFrame(() => {
    const p = pose(),
      G = g.current;
    const psi = -Math.asin(Math.max(-1, Math.min(1, (ARMS.a * Math.sin(p.b * 0.35)) / 0.06)));
    ["wheelP:L", "wheelP:R"].forEach((k) => {
      if (G[k]) G[k]!.position.x = p.a;
    });
    ["wheelR:L", "wheelR:R"].forEach((k) => {
      if (G[k]) G[k]!.rotation.x = p.b;
    });
    ["eIdle", "eTail"].forEach((k) => {
      if (G[k]) G[k]!.rotation.z = (p.a / WHEEL.pitchTravel) * 0.5;
    });
    ["aFwd", "aCtr"].forEach((k) => {
      if (G[k]) G[k]!.rotation.y = p.b * 0.35;
    });
    ["wbR", "wbL"].forEach((k) => {
      if (G[k]) G[k]!.rotation.y = psi;
    });
    if (G.rFwd) G.rFwd.rotation.y = p.pedal * 4;
    if (G.pedL) G.pedL.position.x = -p.pedal;
    if (G.pedR) G.pedR.position.x = p.pedal;
  });

  const wbR = PIVOTS.wbR(),
    wbL = PIVOTS.wbL();
  return (
    <>
      {(["L", "R"] as const).map((sd) => (
        <group key={sd} ref={set("wheelP:" + sd)}>
          <group ref={set("wheelR:" + sd)} position={[WHEEL.x, WHEEL.y, (sd === "L" ? -1 : 1) * WHEEL.z]}>
            <P parent={"wheel:" + sd} />
          </group>
        </group>
      ))}
      <group ref={set("eIdle")} position={PIVOTS.eIdle}>
        <P parent="rig:eIdle" />
      </group>
      <group ref={set("eTail")} position={PIVOTS.eTail}>
        <P parent="rig:eTail" />
      </group>
      <group ref={set("aFwd")} position={PIVOTS.aFwd}>
        <P parent="rig:aFwd" />
      </group>
      <group ref={set("aCtr")} position={PIVOTS.aCtr}>
        <P parent="rig:aCtr" />
      </group>
      <group ref={set("wbR")} position={[wbR.x, wbR.y, wbR.z]}>
        <P parent="rig:wbR" />
      </group>
      <group ref={set("wbL")} position={[wbL.x, wbL.y, wbL.z]}>
        <P parent="rig:wbL" />
      </group>
      <group ref={set("rFwd")} position={PIVOTS.rFwd}>
        <P parent="rig:rFwd" />
      </group>
      <group ref={set("pedL")}>
        <P parent="rig:pedL" />
      </group>
      <group ref={set("pedR")}>
        <P parent="rig:pedR" />
      </group>
      <Links links={LINKS} points={points} />
    </>
  );
}
