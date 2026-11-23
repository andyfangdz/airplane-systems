"use client";
import { BtnRow, Ctl, H3, ScenarioButton, Small } from "@/components/ui/controls";
import { useFlaperonStudy, type FlaperonPose } from "./flaperons";

const examples: { pose: FlaperonPose; label: string }[] = [
  { pose: "neutral", label: "Neutral" },
  { pose: "lift", label: "High lift" },
  { pose: "left", label: "Roll left" },
  { pose: "right", label: "Roll right" },
];
const motion = {
  neutral: "Both trailing edges align with the wing.",
  lift: "Both trailing edges move down to increase lift and drag.",
  left: "The left trailing edge rises and the right trailing edge lowers to roll left.",
  right: "The right trailing edge rises and the left trailing edge lowers to roll right.",
};

export function FlaperonDemo() {
  const pose = useFlaperonStudy((s) => s.pose);
  return (
    <>
      <H3>Compare flaperon motion</H3>
      <Ctl>
        <BtnRow>
          {examples.map(({ pose, label }) => (
            <ScenarioButton
              key={pose}
              mark={pose === "lift" ? "falcon6x-high-lift" : undefined}
              onClick={() => useFlaperonStudy.setState({ pose })}
            >
              {label}
            </ScenarioButton>
          ))}
        </BtnRow>
        <Small>Illustrative deflection. {motion[pose]}</Small>
      </Ctl>
    </>
  );
}
