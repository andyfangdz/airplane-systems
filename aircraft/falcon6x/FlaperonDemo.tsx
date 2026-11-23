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
  neutral: "Flaps and ailerons align with the wing and the slats retract.",
  lift: "The six slats extend. Both inboard flaps and both flaperons lower.",
  left: "The left flaperon and aileron rise while the right pair lower.",
  right: "The right flaperon and aileron rise while the left pair lower.",
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
