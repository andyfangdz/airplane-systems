"use client";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type * as THREE from "three";
import { Links, type LinkSpec } from "@/components/scene/Links";
import { Parts } from "@/components/scene/Part";
import { live } from "./model";
import { CAT } from "./parts";
import { ARMS, FLAP_TUBE, PIVOTS, STICK, linkPoints, rigPose } from "./rig";

const P = ({ parent }: { parent: string }) => <Parts cat={CAT} parent={parent} />;
const ail = { chan: "aileron" as const, sys: ["controls" as const] };
const el = { chan: "elevator" as const, sys: ["controls" as const] };

/** Rods whose two ends move every frame. */
const LINKS: Record<string, LinkSpec> = {
  elev1: { ...el, name: "Elevator push rod (cabin)", note: "Steel push rod from the stick torque-tube lever aft under the seats (AFM 7.3: elevator by control rods; routing inferred).", r: 0.008 },
  elev2: { ...el, name: "Elevator push rod (tail boom)", note: "Long steel push rod through the tail boom to the bellcrank at the fin base.", r: 0.008 },
  elev3: { ...el, name: "Elevator push rod (fin)", note: "Runs up inside the fin from the fin-base bellcrank to the elevator horn at the top of the rudder (AFM 7-7).", r: 0.008 },
  pServo: { chan: "elevator", sys: ["controls", "autopilot"], name: "Pitch servo link", note: "GFC 700 pitch servo connection to the elevator push rod (position approximate).", r: 0.005, color: "#C8399F" },
  ailLat: { ...ail, name: "Stick interconnect rod", note: "Ties the two sticks together in roll (inferred).", r: 0.006 },
  ailAft: { ...ail, name: "Aileron push rod (cabin)", note: "Fore-aft push rod under the front seats — seats are removable to inspect the control runs (AFM 7-15).", r: 0.007 },
  rServo: { chan: "aileron", sys: ["controls", "autopilot"], name: "Roll servo link", note: "GFC 700 roll servo connection to the aileron push rod (position approximate).", r: 0.005, color: "#C8399F" },
  ailWR: { ...ail, name: "Aileron push rod (right wing)", note: "Spanwise steel push rod behind the rear spar to the wing bellcrank (inferred).", r: 0.007 },
  ailWL: { ...ail, name: "Aileron push rod (left wing)", note: "Spanwise steel push rod behind the rear spar to the wing bellcrank (inferred).", r: 0.007 },
  ailHR: { ...ail, name: "Aileron push rod with rod-end", note: "Rod-end bearing screwed into a steel push rod, locked by a nut with locking varnish; bolted to the aluminium horn (AFM 7-4).", r: 0.006 },
  ailHL: { ...ail, name: "Aileron push rod with rod-end", note: "Rod-end bearing screwed into a steel push rod, locked by a nut with locking varnish; bolted to the aluminium horn (AFM 7-4).", r: 0.006 },
  pedBarL: { chan: "rudder", sys: ["controls", "gear"], name: "Left pedal cross tube", note: "Links the pilot's and co-pilot's left pedals.", r: 0.008 },
  pedBarR: { chan: "rudder", sys: ["controls", "gear"], name: "Right pedal cross tube", note: "Links the pilot's and co-pilot's right pedals.", r: 0.008 },
  flapRodR: { sys: ["flaps"], name: "Flap push rod", note: "Steel push rod with rod-end from the torsion tube to the flap control horn (AFM 7-5).", r: 0.008, color: "#9F85E6" },
  flapRodL: { sys: ["flaps"], name: "Flap push rod", note: "Steel push rod with rod-end from the torsion tube to the flap control horn (AFM 7-5).", r: 0.008, color: "#9F85E6" },
  flapAct: { sys: ["flaps"], name: "Flap actuator rod", note: "The electric actuator turns the torsion tube.", r: 0.01, color: "#7C57CF" },
};

const pose = () => rigPose(live.eff, live.afcs.trim, live.flapAng);
const points = () => linkPoints(pose());

/** Sticks, pedals, bellcranks, flap torsion tube and push rods, animated from the effective controls. */
export function ControlRig() {
  const g = useRef<Record<string, THREE.Object3D | null>>({});
  const set = (k: string) => (o: THREE.Object3D | null) => { g.current[k] = o; };

  useFrame(() => {
    const p = pose(), G = g.current;
    const psi = -Math.asin(Math.max(-1, Math.min(1, (ARMS.a * Math.sin(p.b)) / 0.06)));
    ["stickP:L", "stickP:R", "ett", "eIdle", "eFin"].forEach((k) => { if (G[k]) G[k]!.rotation.z = p.a; });
    ["stickR:L", "stickR:R"].forEach((k) => { if (G[k]) G[k]!.rotation.x = p.b; });
    ["aFwd", "aAft"].forEach((k) => { if (G[k]) G[k]!.rotation.y = p.b; });
    ["wbR", "wbL"].forEach((k) => { if (G[k]) G[k]!.rotation.y = psi; });
    if (G.flapTube) G.flapTube.rotation.z = p.flapTube;
    if (G.pedL) G.pedL.position.x = -p.pedal;
    if (G.pedR) G.pedR.position.x = p.pedal;
  });

  const wbR = PIVOTS.wbR(), wbL = PIVOTS.wbL();
  return (
    <>
      {(["L", "R"] as const).map((sd) => (
        <group key={sd} ref={set("stickP:" + sd)} position={[STICK.x, STICK.y, (sd === "L" ? -1 : 1) * STICK.z]}>
          <group ref={set("stickR:" + sd)}><P parent={"stick:" + sd} /></group>
        </group>
      ))}
      <group ref={set("ett")} position={[STICK.x, STICK.y, 0]}><P parent="rig:ett" /></group>
      <group ref={set("eIdle")} position={PIVOTS.eIdle}><P parent="rig:eIdle" /></group>
      <group ref={set("eFin")} position={PIVOTS.eFin}><P parent="rig:eFin" /></group>
      <group ref={set("aFwd")} position={PIVOTS.aFwd}><P parent="rig:aFwd" /></group>
      <group ref={set("aAft")} position={PIVOTS.aAft}><P parent="rig:aAft" /></group>
      <group ref={set("wbR")} position={[wbR.x, wbR.y, wbR.z]}><P parent="rig:wbR" /></group>
      <group ref={set("wbL")} position={[wbL.x, wbL.y, wbL.z]}><P parent="rig:wbL" /></group>
      <group ref={set("flapTube")} position={[FLAP_TUBE.x, FLAP_TUBE.y, 0]}><P parent="rig:flapTube" /></group>
      <group ref={set("pedL")}><P parent="rig:pedL" /></group>
      <group ref={set("pedR")}><P parent="rig:pedR" /></group>
      <Links links={LINKS} points={points} />
    </>
  );
}
