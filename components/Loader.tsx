"use client";
import { useEffect } from "react";
import { useAircraft } from "@/lib/fleet";
import { skipBuild, useBuild, type BuildStage } from "@/lib/build";
import { LoadFailed } from "./LoadFailed";

const TEXT: Record<Exclude<BuildStage, "ready">, string> = {
  code: "Loading",
  airframe: "Building the airframe",
  shaders: "Compiling shaders",
  systems: "Adding systems",
};

/** Later progressive builds may fade in; a one-shot build needs visible feedback before its blocking render. */
let completedOnce = false;

/**
 * Loading overlay over the 3D view, from the first paint (it is in the static HTML) until the scene is complete: the
 * airplane's name, a spinner and the build stage; while systems are added part by part (the camera already responds) it
 * shrinks to a bar with the part count and an Add all button (the rest at once, no build-in glow). It carries `data-building`
 * while shown. If the page's code fails to download it says so and offers Retry (`LoadFailed`).
 */
export function Loader() {
  const def = useAircraft(),
    progressive = !!def.progressive;
  const { stage, done, total } = useBuild();
  useEffect(() => {
    if (stage === "ready") completedOnce = true;
  }, [stage]);
  if (stage === "ready") return null;
  const bar = stage === "systems";
  return (
    <div
      className={`loader${bar ? " loader-bar" : ""}${completedOnce && progressive ? " loader-later" : ""}`}
      role="status"
      aria-live="polite"
      data-building={stage}
    >
      <div className="loader-card">
        <span className="spinner" aria-hidden="true" />
        <span className="loader-text">
          <b>{def.name} </b>
          {TEXT[stage]}
          {bar ? ` ${done} / ${total}` : "…"}
        </span>
        {!bar && <LoadFailed name={def.name} />}
        {bar && <progress max={total} value={done} />}
        {bar && (
          <button
            type="button"
            className="loader-skip"
            onClick={skipBuild}
            aria-label="Add all the remaining parts now"
            title="Add all the remaining parts now"
          >
            Add all
          </button>
        )}
      </div>
    </div>
  );
}
