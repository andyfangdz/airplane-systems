# SR22T G6 geometry audit references

The existing geometry checks cite POH 13772-007 Fig. 1-2 and 7-26/7-31 for the doors, and AMM
13773-002 Rev. 7 chapter 52 for their hardware and clearances. The exhaust layout cites POH 7-38
and AMM Fig. 78-20-4. Individual parts and tests retain their detailed references and approximation notes.

## Curved-skin tessellation audit

The station profiles, source-traced cabin/baggage outlines and installation anchors are unchanged by the shared
`lib/skin-patch.ts` triangulator. Constrained boundaries, interior seeds and loft-station splits replace dense triangle
fans; refinement uses a 0.4 mm sampled chord tolerance (a rendering choice, not a continuous or certified dimensional
bound). The existing analytic normals and paint projection remain independent of tessellation. Exhaust apertures
now clip exactly to the existing illustrative exit envelope instead of discarding whole intersecting triangles, so
rims no longer enlarge with coarse faces. Door, cowl, exhaust and strut-clearance tests remain the acceptance checks.
Measured asset costs and the fleet coverage audit are in [MODELING.md](../../MODELING.md).
