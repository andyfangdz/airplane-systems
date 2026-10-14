// `import.meta.glob`, which Vite (and so Vitest) compiles, without vite/client's asset module declarations.
interface ImportMeta {
  readonly glob: import("vite").ImportGlobFunction;
}
