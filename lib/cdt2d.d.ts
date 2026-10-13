declare module "cdt2d" {
  /** Constrained Delaunay triangulation; edges are closed outer/inner boundary loops. */
  export default function cdt2d(points: number[][], edges: number[][], options: { exterior: boolean }): number[][];
}
