import { describe, expect, test } from "vitest";
import { createPartInspection, distinctParts } from "@/components/engine/part-inspection";

describe("part inspection lifetime", () => {
  test("unmounting the last mesh of a selected part clears the selection", () => {
    const store = createPartInspection();
    const part = { name: "Oil pump", note: "Pump source note", available: () => true };
    const first = store.getState().register({ ...part, id: "housing" });
    const second = store.getState().register({ ...part, id: "rotor" });
    store.getState().select("Oil pump");
    first();
    expect(store.getState().selected).toBe("Oil pump");
    second();
    expect(store.getState().selected).toBeNull();
    expect(store.getState().parts).toEqual([]);
  });

  test("animated visibility removes a hidden part and its stale selection", () => {
    const store = createPartInspection();
    let visible = true;
    store.getState().register({ id: "prop", name: "Propeller", note: "", available: () => visible });
    store.getState().select("Propeller");
    visible = false;
    store.getState().refresh();
    expect(store.getState().selected).toBeNull();
    expect(store.getState().parts).toEqual([]);
    store.getState().select("Propeller");
    expect(store.getState().selected).toBeNull();
    visible = true;
    store.getState().refresh();
    expect(store.getState().parts).toHaveLength(1);
    expect(store.getState().selected).toBeNull();
  });

  test("a stale effect cleanup cannot erase replacement metadata or another page's registry", () => {
    const firstPage = createPartInspection();
    const secondPage = createPartInspection();
    const old = firstPage.getState().register({ id: "one", name: "Pump", note: "Old note", available: () => true });
    firstPage.getState().register({ id: "one", name: "Pump", note: "Updated note", available: () => true });
    secondPage.getState().register({ id: "one", name: "Pump", note: "Other engine's note", available: () => true });
    secondPage.getState().select("Pump");
    old();
    expect(firstPage.getState().parts[0].note).toBe("Updated note");
    expect(secondPage.getState().selected).toBe("Pump");
    expect(secondPage.getState().parts[0].note).toBe("Other engine's note");
  });

  test("unchanged visibility keeps the published snapshot stable", () => {
    const store = createPartInspection();
    store.getState().register({ id: "one", name: "Pump", note: "", available: () => true });
    const state = store.getState();
    state.refresh();
    expect(store.getState()).toBe(state);
  });

  test("only model selection requests a reveal, including selecting the same part again", () => {
    const store = createPartInspection();
    store.getState().register({ id: "one", name: "Pump", note: "", available: () => true });
    store.getState().select("Pump");
    expect(store.getState().reveal).toBe(0);
    store.getState().select("Pump", true);
    store.getState().select("Pump", true);
    expect(store.getState().reveal).toBe(2);
    store.getState().select(null);
    store.getState().select("Unknown part", true);
    expect(store.getState().reveal).toBe(2);
  });

  test("search deduplicates names, preserves source notes and matches function", () => {
    const parts = [
      { id: "a", name: "Oil pump", note: "" },
      { id: "b", name: "Oil pump", note: "Supplies lubrication. Manual p. 7." },
      { id: "c", name: "Fuel pump", note: "Fuel pressure." },
    ];
    expect(distinctParts(parts).map((part) => part.name)).toEqual(["Fuel pump", "Oil pump"]);
    expect(distinctParts(parts, " LUBRICATION ")).toEqual([parts[1]]);
  });
});
