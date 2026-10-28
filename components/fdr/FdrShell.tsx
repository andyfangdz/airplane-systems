"use client";
/** The page around one flight data replay (/fdr/<id>): the component pages' layout, with the replay in the picker. */
import { fdrById, type FdrId } from "@/fdr";
import { SimulationShell, simulationGroups, type ShellParts } from "../engine/ComponentShell";

export function FdrShell({ id, ...parts }: ShellParts & { id: FdrId }) {
  return (
    <SimulationShell
      id={id}
      current={fdrById(id)!}
      kind="replay"
      groups={simulationGroups({ replay: id })}
      {...parts}
    />
  );
}
