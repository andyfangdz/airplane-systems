import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { prefersReducedMotion, useReducedMotion } from "@/lib/useReducedMotion";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("all scene consumers follow live OS motion changes with one listener and release it on unmount", () => {
  const listeners = new Set<() => void>();
  const media = {
    matches: true,
    addEventListener: vi.fn((_: string, listener: () => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_: string, listener: () => void) => listeners.delete(listener)),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => media),
  );
  function Consumer() {
    return <output>{useReducedMotion() ? "still" : "moving"}</output>;
  }
  const mounted = render(
    <>
      <Consumer />
      <Consumer />
    </>,
  );
  expect(screen.getAllByText("still")).toHaveLength(2);
  expect(listeners.size).toBe(1);
  expect(media.addEventListener).toHaveBeenCalledTimes(1);
  act(() => {
    media.matches = false;
    listeners.forEach((listener) => listener());
  });
  expect(screen.getAllByText("moving")).toHaveLength(2);
  expect(prefersReducedMotion()).toBe(false);
  mounted.unmount();
  expect(listeners.size).toBe(0);
  expect(media.removeEventListener).toHaveBeenCalledTimes(1);
});
