import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ENGINE_IDS, engineById } from "@/engines";
import EngineApp from "@/components/engine/EngineApp";

// one static page per engine (/engines/io390); any other id is a 404
export const dynamicParams = false;
export const generateStaticParams = () => ENGINE_IDS.map((engine) => ({ engine }));

type Params = { params: Promise<{ engine: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const spec = engineById((await params).engine);
  return spec ? { title: `${spec.model} engine simulation`, description: spec.lead } : {};
}

export default async function Page({ params }: Params) {
  const { engine } = await params;
  if (!engineById(engine)) notFound();
  return <EngineApp id={engine} />;
}
