import type { SysDef } from "@/lib/systems";

export const SYS: SysDef[] = [
  {
    id: "overview",
    name: "Overview",
    pg: "3",
    ref: "Facts & Figures · p. 3 · Overview · p. 41",
    cam: [
      [31, 18.5, 36],
      [0, 0.3, 0],
    ],
    blurb: "",
  },
  {
    id: "airframe",
    name: "Airframe",
    pg: "3",
    ref: "Facts & Figures · p. 3 · Dassault external dimensions",
    cam: [
      [13.6, 37.2, 28.5],
      [0, 0, 0],
    ],
    blurb: "Swept wings and tail geometry",
  },
  {
    id: "engine",
    name: "Engines",
    pg: "7",
    ref: "EASA IM.E.096 · pp. 7–8 · Overview · p. 65",
    cam: [
      [3, 3.3, 9.4],
      [-6.7, 0.8, 0],
    ],
    blurb: "Paired aft-mounted turbofans",
  },
  {
    id: "controls",
    name: "Flight controls",
    pg: "6",
    ref: "Facts & Figures · p. 6 · Overview · pp. 60–61",
    cam: [
      [-22.8, 27.3, 22.1],
      [-2, 0, 0],
    ],
    blurb: "Digital flight controls and flaperons",
  },
  {
    id: "cabin",
    name: "Cabin",
    pg: "4–5",
    ref: "Overview · p. 12 · Global Jet LX-TIN · pp. 1–2",
    cam: [
      [5.1, 8.8, -19.4],
      [1.05, 0.15, 0],
    ],
    blurb: "Cabin layout, windows and skylight",
  },
  {
    id: "avionics",
    name: "Flight deck",
    pg: "7",
    ref: "Facts & Figures · p. 7 · Overview · pp. 57–59",
    cam: [
      [6.05, 1.08, 0],
      [9.47, 0.075, 0],
    ],
    blurb: "EASy IV avionics and FalconEye",
  },
];
