"use strict";
/**
 * cdt2d (lib/skin-patch.ts) only calls robust-in-sphere's 2-D in-circle test, `require("robust-in-sphere")[4]`, and only
 * reads its sign. The original evaluates every call in exact multi-precision arithmetic, which was most of the time spent
 * baking skins. robust-predicates' `incircle` is Shewchuk's adaptive test: a floating-point estimate with an error bound,
 * falling back to exact arithmetic only when the estimate cannot decide. Its sign is identical, including exact zeros for
 * cocircular grid points, so the triangulations (and the baked meshes) are unchanged. package.json overrides cdt2d's copy.
 */
const { incircle } = require("robust-predicates");

const inCircle = (a, b, c, d) => incircle(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1]);
const unsupported = (n) => () => {
  throw new Error(`robust-in-sphere: only the 2-D test (index 4) is provided, not ${n}`);
};

module.exports = [0, 1, 2, 3].map(unsupported).concat([inCircle]);
