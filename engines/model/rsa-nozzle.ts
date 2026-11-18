import type { InjectedFuel } from "../types";

/** Lycoming IO-390-C IOM Fig. C-2 identifies the tested injector as RSA-5AD1. */
export const RSA5_NOZZLE: InjectedFuel["nozzle"] = {
  curve: "Fuel flow vs nozzle pressure, C-12855B (IOM Figure C-2)",
  points: [
    [0, 0],
    [0.5, 22],
    [1, 33],
    [2, 49.5],
    [3, 60],
    [4, 70],
    [5, 79],
    [6, 87],
    [7, 94],
    [8, 100.5],
    [9, 106],
    [10, 111.5],
    [11, 117],
    [11.5, 120],
  ],
};
