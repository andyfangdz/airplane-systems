# Source Sans 3

`SourceSans3VF-Upright.woff2` is Adobe's unmodified upright variable TrueType WOFF2 font, vendored from
[`adobe-fonts/source-sans`, commit `87b37a2daaed80fcb8e8ccb0085c4d72ddade12e`](https://github.com/adobe-fonts/source-sans/blob/87b37a2daaed80fcb8e8ccb0085c4d72ddade12e/WOFF2/VF/SourceSans3VF-Upright.ttf.woff2).
Its SIL Open Font License is included in `SourceSans3-LICENSE.txt`.

SHA-256: `5f16566f7a40d39b339ad26be151fa5a1ab1f0c2574c7a2e619765584a1acbd8`.

The layout loads this file with `next/font/local` at the existing 400, 600 and 700 weights. This avoids the
`next/font/google queries have exactly one entry` error from Turbopack when resolving Google's generated
Source Sans 3 font URLs during a clean build. The full font retains its non-Latin glyph coverage.
