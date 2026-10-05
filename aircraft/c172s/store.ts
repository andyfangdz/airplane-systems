"use client";
import { createSimStore } from "@/lib/simStore";
import { initialSim, solve } from "./model";

/** C172S systems state (switches, levers, failures, quantities) and its solved electrical/fuel picture. */
export const useC172 = createSimStore(initialSim, solve);
