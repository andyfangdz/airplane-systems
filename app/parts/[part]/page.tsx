import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PART_IDS, partById } from "@/parts";
import PartApp from "@/components/parts/PartApp";

// one static page per component (/parts/fuel-injector); any other id is a 404
export const dynamicParams = false;
export const generateStaticParams = () => PART_IDS.map((part) => ({ part }));

type Params = { params: Promise<{ part: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const part = partById((await params).part);
  return part ? { title: `${part.name} simulation`, description: part.lead } : {};
}

export default async function Page({ params }: Params) {
  const { part } = await params;
  if (!partById(part)) notFound();
  return <PartApp id={part} />;
}
