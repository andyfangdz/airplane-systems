"use client";
import { FleetWalkPanel, FleetWalkMarker } from "@/components/FleetWalkaround";
import { walkController } from "./walk-store";
export function WalkPanel() {
  return <FleetWalkPanel controller={walkController} />;
}
export function WalkMarker() {
  return <FleetWalkMarker controller={walkController} />;
}
