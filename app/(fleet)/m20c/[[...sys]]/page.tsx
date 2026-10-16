import { M20C } from "@/aircraft/m20c";
import { M20C_META } from "@/aircraft/m20c/meta";
import App from "@/components/App";
import { airplaneMetadata, routeSys, systemParams, type AirplaneProps } from "../../airplane-route";

// /m20c and /m20c/<system>, one static page each; the page ships the M20C alone (see ../../airplane-route.ts)
export const dynamicParams = false;
export const generateStaticParams = systemParams(M20C_META);
export const metadata = airplaneMetadata(M20C_META);

export default async function Page(props: AirplaneProps) {
  return <App def={M20C} sys={await routeSys(M20C_META, props)} />;
}
