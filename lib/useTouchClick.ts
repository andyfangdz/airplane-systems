"use client";
import { useRef, type TouchEvent } from "react";

/** Activate a completed tap even when Safari omits its compatibility click. Scrolling keeps native handling. */
export function useTouchClick() {
  const gesture = useRef<{ id: number; x: number; y: number; time: number } | null>(null);
  return {
    onTouchStart(event: TouchEvent<HTMLButtonElement>) {
      gesture.current = null;
      if (event.currentTarget.disabled || event.defaultPrevented || event.touches.length !== 1) return;
      const touch = event.touches[0];
      gesture.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: event.timeStamp };
    },
    onTouchMove(event: TouchEvent<HTMLButtonElement>) {
      const start = gesture.current;
      const touch = event.touches[0];
      if (
        !start ||
        event.touches.length !== 1 ||
        touch.identifier !== start.id ||
        Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10
      )
        gesture.current = null;
    },
    onTouchCancel() {
      gesture.current = null;
    },
    onTouchEnd(event: TouchEvent<HTMLButtonElement>) {
      const start = gesture.current;
      gesture.current = null;
      const touch = event.changedTouches[0];
      const button = event.currentTarget;
      if (
        !start ||
        button.disabled ||
        event.defaultPrevented ||
        !event.cancelable ||
        event.touches.length !== 0 ||
        event.changedTouches.length !== 1 ||
        touch.identifier !== start.id ||
        event.timeStamp - start.time >= 500 ||
        Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 10
      )
        return;
      const box = button.getBoundingClientRect();
      if (
        touch.clientX < box.left ||
        touch.clientX > box.right ||
        touch.clientY < box.top ||
        touch.clientY > box.bottom
      )
        return;
      // Unlike pointerup, canceling touchend suppresses the browser's compatibility mouse/click sequence.
      event.preventDefault();
      button.click();
    },
  };
}
