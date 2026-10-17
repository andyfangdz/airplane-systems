import { C182T } from "@/aircraft/c182t";
import { C182T_META } from "@/aircraft/c182t/meta";
import App from "@/components/App";
import { airplaneMetadata, routeSys, systemParams, type AirplaneProps } from "../../airplane-route";

// /c182t and /c182t/<system>, one static page each; the page ships the C182T alone (see ../../airplane-route.ts)
export const dynamicParams = false;
export const generateStaticParams = systemParams(C182T_META);
export const metadata = airplaneMetadata(C182T_META);

export default async function Page(props: AirplaneProps) {
  return <App def={C182T} sys={await routeSys(C182T_META, props)} />;
}
