import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FDR_IDS, fdrById } from "@/fdr";
import FdrPage from "@/components/fdr/FdrPage";

// one static page per replay (/fdr/c5-diego-garcia); any other id is a 404
export const dynamicParams = false;
export const generateStaticParams = () => FDR_IDS.map((replay) => ({ replay }));

type Params = { params: Promise<{ replay: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const r = fdrById((await params).replay);
  return r ? { title: `${r.name}: flight data replay`, description: r.lead } : {};
}

export default async function Page({ params }: Params) {
  const r = fdrById((await params).replay);
  if (!r) notFound();
  return <FdrPage id={r.id} />;
}
