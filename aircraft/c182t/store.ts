"use client";
import { createSimStore } from "@/lib/simStore";
import { initialSim, solve } from "./model";

/** C182T systems state (switches, levers, failures, quantities) and its solved electrical/fuel picture. */
export const useC182 = createSimStore(initialSim, solve);
