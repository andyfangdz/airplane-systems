import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { COMPONENT_IDS, componentById } from "@/engines/components";
import ComponentPage from "@/components/engine/ComponentPage";

// one static page per component (/components/carburetor); any other id is a 404
export const dynamicParams = false;
export const generateStaticParams = () => COMPONENT_IDS.map((component) => ({ component }));

type Params = { params: Promise<{ component: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const c = componentById((await params).component);
  return c ? { title: `${c.name} simulation`, description: c.lead } : {};
}

export default async function Page({ params }: Params) {
  const c = componentById((await params).component);
  if (!c) notFound();
  return <ComponentPage id={c.id} />;
}
