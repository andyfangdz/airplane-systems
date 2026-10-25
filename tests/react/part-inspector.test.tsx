import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, expect, test } from "vitest";
import { PartInspectionProvider, PartInspector, usePartInspectionStore } from "@/components/engine/PartInspector";

afterEach(cleanup);

function RegisteredParts({ model }: { model: string }) {
  const store = usePartInspectionStore();
  useLayoutEffect(() => {
    const removePump = store.getState().register({
      id: "pump",
      name: `${model} pump`,
      note: "Supplies lubrication. Existing manual note.",
      available: () => true,
    });
    const removeValve = store.getState().register({
      id: "valve",
      name: `${model} valve`,
      note: "Controls the flow.",
      available: () => true,
    });
    return () => {
      removePump();
      removeValve();
    };
  }, [model, store]);
  return null;
}

function Page({ model }: { model: string }) {
  return (
    <PartInspectionProvider key={model}>
      <RegisteredParts model={model} />
      <PartInspector />
    </PartInspectionProvider>
  );
}

test("search and native buttons expose a persistent explanation that can be dismissed", () => {
  render(<Page model="Engine" />);
  fireEvent.click(screen.getByText("Inspect a part"));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a part" }), { target: { value: "lubrication" } });
  const list = screen.getByRole("list", { name: "Parts in this view" });
  expect(within(list).getAllByRole("button")).toHaveLength(1);
  const pump = within(list).getByRole("button", { name: "Engine pump" });
  pump.focus();
  expect(document.activeElement).toBe(pump);
  act(() => fireEvent.click(pump));
  expect(pump.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("heading", { name: "Engine pump" })).toBeDefined();
  expect(screen.getByText("Supplies lubrication. Existing manual note.")).toBeDefined();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "valve" } });
  expect(screen.getByRole("heading", { name: "Engine pump" })).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Clear selected part" }));
  expect(screen.queryByRole("heading", { name: "Engine pump" })).toBeNull();
});

test("switching model clears selection and the previous search", () => {
  const page = render(<Page model="First" />);
  fireEvent.click(screen.getByText("Inspect a part"));
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "pump" } });
  fireEvent.click(screen.getByRole("button", { name: "First pump" }));
  page.rerender(<Page model="Second" />);
  expect(screen.queryByRole("heading", { name: "First pump" })).toBeNull();
  fireEvent.click(screen.getByText("Inspect a part"));
  expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("");
  expect(screen.getByRole("button", { name: "Second pump" })).toBeDefined();
});
