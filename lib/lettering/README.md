# Paint glyph outlines

`sans-glyphs.json` contains only the glyphs used by the fleet's markings. The rounded oblique outlines derive from **Liberation Sans Bold Italic**, and the smaller wordmarks from **Liberation Sans Regular**, version 2.1.5. These are visual substitutes fitted to the photos, not claims about the original decal manufacturers' fonts. Attribution and the SIL Open Font License are in [OFL.txt](OFL.txt).

The outlines were extracted with fontTools `SVGPathPen` from `LiberationSans-BoldItalic.ttf` and `LiberationSans-Regular.ttf`. Each outline is transformed by `(100 / OS2.sCapHeight, 0, 0, -100 / OS2.sCapHeight, 0, 100)` into downward-positive canvas coordinates; `advance` is the scaled horizontal metric and `bounds` contains the transformed ink bounds. Coordinates are rounded to three decimal places. No font loading, system font lookup or fontTools dependency is needed at runtime.

The Cessna block outlines in `../lettering.ts` are original polygon reconstructions of the angular registration letters visible in the photographs. The C172 applies a slant; N8050J's new-paint lettering is upright. Rectangles in `aircraft/liveries.ts` fit each marking's overall width and height independently, including the Diamond's condensed proportions.
