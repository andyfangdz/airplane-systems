import { Children, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { HoldButtonProps } from "@/components/ui/controls";
import { Kap140Unit } from "@/components/avionics/Kap140Unit";
import { initFlight } from "@/lib/avionics/flight";
import { kap140Init } from "@/lib/avionics/kap140";

const { buttons } = vi.hoisted(() => ({ buttons: [] as HoldButtonProps[] }));
vi.mock("@/components/ui/controls", async (original) => ({
  ...(await original<typeof import("@/components/ui/controls")>()),
  HoldButton: (props: HoldButtonProps) => {
    buttons.push(props);
    return createElement("button", null, props.children);
  },
}));
beforeEach(() => {
  buttons.length = 0;
});

function apButton(ap: boolean, onKey = vi.fn()) {
  renderToStaticMarkup(
    createElement(Kap140Unit, {
      st: { ...kap140Init(), powered: true, ready: true, on: -100, ap },
      fs: initFlight(),
      onKey,
    }),
  );
  const button = buttons.find((p) => Children.toArray(p.children)[0] === "AP")!;
  return { button, onKey };
}

it("requires the reusable hold control's 250 ms engagement threshold (S3-8)", () => {
  const { button, onKey } = apButton(false);
  expect(button.holdMs).toBe(250);
  button.onDown?.();
  button.onUp?.(false);
  expect(onKey).not.toHaveBeenCalled();
  button.onDown?.();
  button.onHold?.();
  expect(onKey).toHaveBeenCalledExactlyOnceWith("AP");
});

it("disengages immediately and a continued hold cannot re-engage it (S3-8)", () => {
  const { button, onKey } = apButton(true);
  button.onDown?.();
  expect(onKey).toHaveBeenCalledExactlyOnceWith("AP");
  button.onHold?.();
  button.onUp?.(true);
  expect(onKey).toHaveBeenCalledTimes(1);
});
