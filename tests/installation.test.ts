import { describe, expect, it } from "vitest";
import { defineInstallation, quantity } from "@/lib/installation";

const source = { document: "poh", locator: "Figure 7-10" };
const definition = () => ({
  id: "test-aircraft",
  documents: { poh: { title: "POH", edition: "A1", applicability: "Test installation" } },
  equipment: {
    bus: { label: "Bus", ports: { output: "dc" as const }, source },
    display: { label: "Display", ports: { power: "dc" as const, data: "data" as const }, source },
  },
  protection: ["pfdA"],
  connections: {
    pfdA: {
      from: { equipment: "bus" as const, port: "output" as const },
      to: { equipment: "display" as const, port: "power" as const },
      protection: "pfdA",
      source,
    },
  },
});

describe("installation assembly", () => {
  it("rejects a connection between different physical media", () => {
    const d = definition();
    expect(() =>
      defineInstallation({
        ...d,
        connections: { link: { ...d.connections.pfdA, to: { equipment: "display", port: "data" } } },
      }),
    ).toThrow("incompatible port media");
  });
  it("rejects unresolved protection and source references", () => {
    const d = definition();
    expect(() => defineInstallation({ ...d, protection: [] })).toThrow("unknown protection");
    expect(() => defineInstallation({ ...d, documents: {} })).toThrow("unresolved source");
  });
  it("retains an explicit decision when published values disagree", () => {
    const alternatives = [{ value: 60, source: { document: "poh", locator: "Figure 7-10" } }];
    expect(() => quantity(80, "A", source, { alternatives })).toThrow("model decision");
    const rating = quantity(80, "A", source, { alternatives, decision: "Use POH text." });
    expect(rating).toMatchObject({ value: 80, unit: "A", status: "published", alternatives });
    expect(() => quantity(Infinity, "V", source)).toThrow("finite");
  });
  it("makes assembled equipment immutable and sorts connection identities", () => {
    const d = definition();
    const graph = defineInstallation({
      ...d,
      facts: { voltage: quantity(28, "V", { document: "poh", locator: "7-49" }) },
      connections: { z: d.connections.pfdA, a: d.connections.pfdA },
    });
    expect(graph.connectionIds).toEqual(["a", "z"]);
    expect(Object.isFrozen(graph.equipment.display.ports)).toBe(true);
    expect(Object.isFrozen(graph.facts!.voltage.source)).toBe(true);
  });
});
