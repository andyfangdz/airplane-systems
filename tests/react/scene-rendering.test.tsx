import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useSceneRendering } from "@/lib/useSceneRendering";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function Rendering() {
  const { dpr } = useSceneRendering();
  return <output>{JSON.stringify({ dpr })}</output>;
}

function current() {
  return JSON.parse(screen.getByRole("status").textContent!);
}

test("touch-only devices cap pixel density and follow a change to mouse input without remounting the scene", () => {
  let matches = true;
  const listeners = new Set<() => void>();
  const matchMedia = vi.fn(() => ({
    get matches() {
      return matches;
    },
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  }));
  vi.stubGlobal("matchMedia", matchMedia);
  const { unmount } = render(<Rendering />);
  expect(matchMedia).toHaveBeenCalledWith("(pointer: coarse) and (hover: none)");
  expect(current()).toEqual({ dpr: [1, 1.5] });
  act(() => {
    matches = false;
    listeners.forEach((listener) => listener());
  });
  expect(current()).toEqual({ dpr: [1, 2] });
  unmount();
  expect(listeners.size).toBe(0);
});

test("browsers without media-query support retain the desktop rendering limit", () => {
  vi.stubGlobal("matchMedia", undefined);
  render(<Rendering />);
  expect(current()).toEqual({ dpr: [1, 2] });
});
