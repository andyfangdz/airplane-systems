import { DA40 } from "@/aircraft/da40";
import { DA40_META } from "@/aircraft/da40/meta";
import App from "@/components/App";
import { airplaneMetadata, routeSys, systemParams, type AirplaneProps } from "../../airplane-route";

// /da40 and /da40/<system>, one static page each; the page ships the DA40 alone (see ../../airplane-route.ts)
export const dynamicParams = false;
export const generateStaticParams = systemParams(DA40_META);
export const metadata = airplaneMetadata(DA40_META);

export default async function Page(props: AirplaneProps) {
  return <App def={DA40} sys={await routeSys(DA40_META, props)} />;
}
