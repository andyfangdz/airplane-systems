# Components

Component simulations: one engine accessory at a time, cut away and drawn large, at `/parts/<id>`. Each runs its own
copy of one of the standalone engines (`engines/`), so what it meters, governs or fires follows a calibrated engine.

```
parts/
  index.ts          PARTS registry (picker order), PART_IDS, partById
  <id>/             the component's model (pure functions of the engine state) and SOURCES.md
components/parts/
  PartApp.tsx       picks the component's page by id
  <id>/             the page: app shell, 3D scene, panel
app/parts/[part]/page.tsx  one static page per id
```

## Adding a component

1. Add it to `PARTS` in `parts/index.ts`, to `APPS` in `components/parts/PartApp.tsx`, and to `PART_IDS` in
   `infra/cloudfront/view-rewrite.js` (a test checks the copy).
2. Run the engine with `simFor(spec, "part:<id>")` and `useEngineLoop` from `components/engine/store.ts`; the engine
   page's `StartFrom`, `Controls` and `Environment` panels, `Monitor`, `ThemeButton` and `useTheme` are exported for
   reuse.
3. Put what the component's parts are doing in a pure function of the engine state (see
   `parts/fuel-injector/model.ts`) and test it in `tests/` against the documents, citing pages.
