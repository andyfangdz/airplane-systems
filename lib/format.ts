/** Number formats shared by the engine and component pages and the engine model's notes. */

/** A whole number with thousands separators, as the documents print rpm, feet and pounds: 2,700. */
export const f0 = (v: number) => Math.round(v).toLocaleString("en-US");
