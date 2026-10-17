/** Source-backed installation data. Geometry and runtime state are projections of these definitions. */
export interface DocumentSource {
  title: string;
  edition: string;
  applicability: string;
  url?: string;
}

export interface SourceRef {
  document: string;
  locator: string;
}

export type QuantityUnit = "A" | "V" | "Ah" | "m" | "s" | "deg" | "US gal" | "psi";
export interface SourcedQuantity<U extends QuantityUnit = QuantityUnit> {
  value: number;
  unit: U;
  source: SourceRef;
  status: "published" | "digitized" | "calibrated" | "illustrative";
  /** Retain conflicting published claims and the reason this installation selects one. */
  alternatives?: readonly { value: number; source: SourceRef }[];
  decision?: string;
}

export function quantity<U extends QuantityUnit>(
  value: number,
  unit: U,
  source: SourceRef,
  detail: Partial<Pick<SourcedQuantity<U>, "status" | "alternatives" | "decision">> = {},
): Readonly<SourcedQuantity<U>> {
  if (!Number.isFinite(value)) throw new Error("Installation quantity must be finite");
  if (detail.alternatives?.length && !detail.decision) throw new Error("Conflicting sources need a model decision");
  return Object.freeze({ value, unit, source, status: "published", ...detail });
}

export interface EquipmentSpec {
  label: string;
  ports: Readonly<Record<string, "dc" | "data" | "air" | "fuel" | "mechanical">>;
  source: SourceRef;
  option?: string;
}

export type EquipmentPort<E extends Record<string, EquipmentSpec>> = {
  [K in keyof E & string]: { equipment: K; port: keyof E[K]["ports"] & string };
}[keyof E & string];

export interface InstallationConnection<E extends Record<string, EquipmentSpec>> {
  from: EquipmentPort<E>;
  to: EquipmentPort<E>;
  source: SourceRef;
  /** Stable protection identity; display text is kept in the installation's breaker table. */
  protection?: string;
}

/** Validate once when authoring modules assemble; the returned graph contains no stores, meshes or DOM. */
export function defineInstallation<
  const E extends Record<string, EquipmentSpec>,
  const C extends Record<string, InstallationConnection<E>>,
>(definition: {
  id: string;
  documents: Readonly<Record<string, DocumentSource>>;
  equipment: E;
  connections: C;
  protection?: readonly string[];
  facts?: Readonly<Record<string, SourcedQuantity>>;
}) {
  const source = (ref: SourceRef) => {
    if (!definition.documents[ref.document] || !ref.locator.trim())
      throw new Error(`${definition.id}: unresolved source ${ref.document}:${ref.locator}`);
  };
  const protections = new Set(definition.protection);
  for (const fact of Object.values(definition.facts ?? {})) {
    source(fact.source);
    for (const alternative of fact.alternatives ?? []) source(alternative.source);
  }
  for (const item of Object.values(definition.equipment)) source(item.source);
  for (const [id, edge] of Object.entries(definition.connections)) {
    source(edge.source);
    const port = (end: EquipmentPort<E>) => {
      const kind = definition.equipment[end.equipment]?.ports[end.port];
      if (!kind) throw new Error(`${definition.id}/${id}: missing port ${end.equipment}.${end.port}`);
      return kind;
    };
    if (port(edge.from) !== port(edge.to)) throw new Error(`${definition.id}/${id}: incompatible port media`);
    if (edge.protection && !protections.has(edge.protection))
      throw new Error(`${definition.id}/${id}: unknown protection ${edge.protection}`);
  }
  // Canonical ordering makes compiler output independent of declaration/import traversal order.
  const connectionIds = Object.freeze(Object.keys(definition.connections).sort() as (keyof C & string)[]);
  const frozen = new WeakSet<object>();
  const freeze = (value: unknown) => {
    if (!value || typeof value !== "object" || frozen.has(value)) return;
    frozen.add(value);
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  };
  freeze(definition);
  return Object.freeze({ ...definition, connectionIds });
}
